import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { grantRegistryAbi } from "@/lib/abis/GrantRegistry";

const passetHub = defineChain({
  id: 420420417,
  name: "Polkadot Hub Testnet",
  nativeCurrency: { name: "PAS", symbol: "PAS", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL!] },
  },
});

export async function POST(req: NextRequest) {
  try {
    const { proposalId, title, description, requestedAmount } = await req.json();

    if (proposalId === undefined || !title || !description || !requestedAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof proposalId !== "number") {
      return NextResponse.json({ error: "Invalid proposalId" }, { status: 400 });
    }

    // 2. Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are an expert grant evaluator for a Web3 ecosystem fund.
Evaluate the following grant proposal and return ONLY a valid JSON object.
No markdown, no backticks, no explanation outside the JSON.

Proposal Title: ${title}
Proposal Description: ${description}
Requested Amount (in wei): ${requestedAmount}

Score the proposal from 0 to 100 across these dimensions:
- Innovation and originality
- Technical feasibility
- Ecosystem alignment with Polkadot and Web3
- Team credibility based on submitted evidence

Return exactly this JSON shape:
{
  "score": <integer 0-100>,
  "summary": "<2-3 sentence plain English evaluation>"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    let parsed: { score: number; summary: string };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error("Gemini returned unparseable response:", responseText);
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    const score = Math.round(parsed.score);
    const summary = parsed.summary;

    if (typeof score !== "number" || score < 0 || score > 100) {
      return NextResponse.json({ error: "AI returned invalid score" }, { status: 500 });
    }

    if (!summary || typeof summary !== "string") {
      return NextResponse.json({ error: "AI returned invalid summary" }, { status: 500 });
    }

    const account = privateKeyToAccount(`0x${process.env.ORACLE_PRIVATE_KEY!}`);

    const walletClient = createWalletClient({
      account,
      chain: passetHub,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL!),
    });

    const publicClient = createPublicClient({
      chain: passetHub,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL!),
    });

    const txHash = await walletClient.writeContract({
      address: process.env.GRANT_REGISTRY_ADDRESS as `0x${string}`,
      abi: grantRegistryAbi,
      functionName: "fulfillAIReview",
      args: [BigInt(proposalId), score, summary],
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return NextResponse.json({ proposalId, score, summary, txHash });

  } catch (error) {
    console.error("Oracle route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
