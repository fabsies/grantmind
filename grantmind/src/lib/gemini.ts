import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    temperature: 0.2,
    responseMimeType: 'application/json',
  },
  systemInstruction: `You are an objective grant evaluator for a Web3 DAO, not a creative writer.
Evaluate the proposal across four dimensions with the following exact weights:
- Innovation & Originality (25%)
- Technical Feasibility (30%)
- Ecosystem Alignment (Polkadot/Web3) (25%)
- Team Credibility (20%)

Your output must be a JSON object only — no markdown, no code fences, no prose outside the JSON.
"score" must be a whole integer between 1 and 100 (never 0, never a float).
"summary" must be 1–3 sentences, plain English, under 500 characters.

Return exactly this shape:
{
  "score": 87,
  "summary": "One to three sentence plain-English rationale",
  "breakdown": {
    "innovation": 22,
    "feasibility": 26,
    "ecosystemAlignment": 21,
    "teamCredibility": 18
  }
}`
});

export type ProposalInput = {
  title: string;
  description: string;
  requestedAmount: string;
  recipientAddress: string;
  links?: string;
};

export type ScoringResult = {
  score: number;
  summary: string;
  breakdown: {
    innovation: number;
    feasibility: number;
    ecosystemAlignment: number;
    teamCredibility: number;
  };
};

export async function scoreProposal(input: ProposalInput): Promise<ScoringResult> {
  const prompt = `PROPOSAL TITLE: ${input.title}
DESCRIPTION: ${input.description}
REQUESTED FUNDING: ${input.requestedAmount}
RECIPIENT WALLET: ${input.recipientAddress}
SUPPORTING LINKS: ${input.links || "None provided"}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;

    let text = "";
    if (
      response.candidates &&
      response.candidates[0] &&
      response.candidates[0].content &&
      response.candidates[0].content.parts &&
      response.candidates[0].content.parts[0]
    ) {
      text = response.candidates[0].content.parts[0].text || "";
    } else {
      throw new Error("GEMINI_PARSE_ERROR: Missing expected response structure");
    }

    text = text.trim();
    if (!text) {
      throw new Error("GEMINI_PARSE_ERROR: Empty response generated");
    }

    // Fix 1: use unknown instead of any
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("GEMINI_PARSE_ERROR: Could not parse response as JSON");
    }

    // Narrow the parsed unknown to a plain object before field access
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error("GEMINI_PARSE_ERROR: Response is not a JSON object");
    }

    const obj = parsed as Record<string, unknown>;

    // Validate score
    if (
      typeof obj.score !== 'number' ||
      !Number.isInteger(obj.score) ||
      obj.score < 1 ||
      obj.score > 100
    ) {
      throw new Error(`GEMINI_PARSE_ERROR: Invalid score: ${obj.score}. Must be integer between 1 and 100.`);
    }

    // Validate summary
    if (
      typeof obj.summary !== 'string' ||
      obj.summary.trim() === '' ||
      obj.summary.length >= 500
    ) {
      throw new Error("GEMINI_PARSE_ERROR: Invalid summary length or format. Must be a string under 500 characters.");
    }

    const defaultBreakdown = {
      innovation: 0,
      feasibility: 0,
      ecosystemAlignment: 0,
      teamCredibility: 0
    };

    const breakdown =
      typeof obj.breakdown === 'object' && obj.breakdown !== null
        ? (obj.breakdown as ScoringResult['breakdown'])
        : defaultBreakdown;

    return {
      score: obj.score,
      summary: obj.summary,
      breakdown
    };

  // Fix 2: remove error: any, use instanceof narrowing
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('GEMINI_PARSE_ERROR:')) {
      throw error;
    }
    throw new Error(`GEMINI_PARSE_ERROR: ${error instanceof Error ? error.message : String(error)}`);
  }
}