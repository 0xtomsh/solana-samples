import { NextResponse } from "next/server";

const JUPITER_API_BASE =
  process.env.JUPITER_API_BASE_URL ?? "https://lite-api.jup.ag/swap/v1";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const required = ["inputMint", "outputMint", "amount", "slippageBps"];
  const missing = required.filter((key) => !searchParams.get(key));

  if (missing.length) {
    return NextResponse.json(
      { error: `Missing query parameters: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const quoteParams = new URLSearchParams({
    inputMint: searchParams.get("inputMint") ?? "",
    outputMint: searchParams.get("outputMint") ?? "",
    amount: searchParams.get("amount") ?? "",
    slippageBps: searchParams.get("slippageBps") ?? "50",
    swapMode: "ExactIn",
    restrictIntermediateTokens: "true",
    instructionVersion: "V2",
  });

  const response = await fetch(`${JUPITER_API_BASE}/quote?${quoteParams}`, {
    headers: jupiterHeaders(),
    next: { revalidate: 0 },
  });
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}

function jupiterHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (process.env.JUPITER_API_KEY) {
    headers["x-api-key"] = process.env.JUPITER_API_KEY;
  }

  return headers;
}
