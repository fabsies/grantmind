import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { writeScore } from "@/lib/oracle";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",                          // Fix 5: correct model
  generationConfig: {
    temperature: 0.2,
    responseMimeType: "application/json",
  },
  systemInstruction: `You are an objective grant evaluator for a Web3 DAO.
Evaluate grant proposals across four dimensions with these exact weights:
- Innovation & Originality: 25%
- Technical Feasibility: 30%
- Ecosystem Alignment (Polkadot/Web3): 25%
- Team Credibility: 20%

Compute a weighted composite and return ONLY a valid JSON object.
No markdown, no code fences, no prose outside the JSON.

Return exactly this shape:
{
  "score": <integer 1-100, never 0, never a float>,
  "summary": "<1-3 sentences, plain English, under 500 characters>",
  "breakdown": {
    "innovation": <integer, weighted contribution>,
    "feasibility": <integer, weighted contribution>,
    "ecosystemAlignment": <integer, weighted contribution>,
    "teamCredibility": <integer, weighted contribution>
  }
}`
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposalId, title, description, requestedAmount, recipientAddress, links } = body;

    // Validate required fields
    const missing = [];
    if (proposalId === undefined) missing.push("proposalId");
    if (!title) missing.push("title");
    if (!description) missing.push("description");
    if (!requestedAmount) missing.push("requestedAmount");
    if (!recipientAddress) missing.push("recipientAddress");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Missing required fields", missing },
        { status: 400 }
      );
    }

    // Fix 1: accept string or number, convert to BigInt
    let proposalIdBigInt: bigint;
    try {
      proposalIdBigInt = BigInt(proposalId);
    } catch {
      return NextResponse.json({ error: "Invalid proposalId" }, { status: 400 });
    }

    // Call Gemini
    const isMock = process.env.MOCK_ORACLE === 'true';

    let score: number;
    let summary: string;
    let breakdown: object;

    if (isMock) {
      // Deterministic hash: same proposalId always yields the same score
      const idStr = proposalIdBigInt.toString();
      const hash = Array.from(idStr).reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);

      // Map to 62–94 range — realistic, always above MIN_AI_SCORE gate of 50
      score = 62 + (Math.abs(hash) % 33);

      const mockEntries = [
        {
          summary: `Strong technical foundation with clear Polkadot ecosystem fit. The proposal demonstrates solid feasibility and a credible team track record. Recommended for community vote.`,
          breakdown: { innovation: 20, feasibility: 26, ecosystemAlignment: 21, teamCredibility: 16 }
        },
        {
          summary: `Innovative approach to a real DAO coordination problem. Technical scope is well-scoped and ecosystem alignment is evident. Team credentials support execution confidence.`,
          breakdown: { innovation: 23, feasibility: 25, ecosystemAlignment: 22, teamCredibility: 17 }
        },
        {
          summary: `Proposal shows originality in its governance design. Feasibility is high given the defined scope. Moderate team credibility — would benefit from more on-chain history.`,
          breakdown: { innovation: 22, feasibility: 27, ecosystemAlignment: 20, teamCredibility: 14 }
        },
        {
          summary: `Clear ecosystem alignment with Polkadot tooling priorities. Technical plan is coherent and funding request is proportionate. Innovation is incremental but practical.`,
          breakdown: { innovation: 18, feasibility: 28, ecosystemAlignment: 23, teamCredibility: 16 }
        },
        {
          summary: `High innovation score offset by moderate feasibility concerns around timeline. Ecosystem fit is strong. Recommend vote with milestone-based disbursement consideration.`,
          breakdown: { innovation: 24, feasibility: 22, ecosystemAlignment: 22, teamCredibility: 15 }
        },
      ];

      // Pick entry deterministically, then scale breakdown to match actual score
      const entry = mockEntries[Math.abs(hash) % mockEntries.length];
      const baseSum = Object.values(entry.breakdown).reduce((a, b) => a + b, 0);
      const scale = score / baseSum;
      breakdown = {
        innovation: Math.round(entry.breakdown.innovation * scale),
        feasibility: Math.round(entry.breakdown.feasibility * scale),
        ecosystemAlignment: Math.round(entry.breakdown.ecosystemAlignment * scale),
        teamCredibility: Math.round(entry.breakdown.teamCredibility * scale),
      };
      summary = entry.summary;
    } else {
      const userContent = `PROPOSAL TITLE: ${title}
  DESCRIPTION: ${description}
  REQUESTED FUNDING: ${requestedAmount}
  RECIPIENT WALLET: ${recipientAddress}
  SUPPORTING LINKS: ${links ?? "None provided"}`;

      const result = await model.generateContent(userContent);
      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

      let parsed: { score: number; summary: string; breakdown: object };
      try {
        parsed = JSON.parse(responseText);
      } catch {
        console.error("Gemini returned unparseable response:", responseText);
        return NextResponse.json(
          { error: "AI scoring failed", detail: "GEMINI_PARSE_ERROR: unparseable response" },
          { status: 422 }
        );
      }

      score = parsed.score;
      summary = parsed.summary;
      breakdown = parsed.breakdown;
    }

    console.log('MOCK_ORACLE:', process.env.MOCK_ORACLE, '| isMock:', isMock);

    // Fix 7: score must be 1-100, not 0-100
    if (!Number.isInteger(score) || score < 1 || score > 100) {
      return NextResponse.json(
        { error: "AI scoring failed", detail: "GEMINI_PARSE_ERROR: score out of valid range (1-100)" },
        { status: 422 }
      );
    }

    if (!summary || typeof summary !== "string" || summary.length > 500) {
      return NextResponse.json(
        { error: "AI scoring failed", detail: "GEMINI_PARSE_ERROR: invalid or oversized summary" },
        { status: 422 }
      );
    }

    // Fix 2, 3, 4: use writeScore() from oracle.ts — correct function name, correct ABI, no duplicate logic
    let txHash: string;
    let blockNumber: string;

    try {
      const receipt = await writeScore({ proposalId: proposalIdBigInt, score, summary });
      txHash = receipt.txHash.toString();
      blockNumber = receipt.blockNumber.toString();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      if (message === "PROPOSAL_NOT_FOUND") {
        return NextResponse.json({ error: "Proposal not found on-chain" }, { status: 404 });
      }
      if (message === "PROPOSAL_ALREADY_SCORED") {
        return NextResponse.json({ error: "Proposal already scored" }, { status: 409 });
      }

      console.error("On-chain write failed:", message);
      return NextResponse.json(
        { error: "On-chain write failed", detail: message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      proposalId: proposalId.toString(),
      score,
      summary,
      breakdown,
      txHash,
      blockNumber,
    });

  } catch (error) {
    console.error("Oracle route error:", error);
    return NextResponse.json({
      error: "Internal server error",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
