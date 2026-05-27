import { NextResponse } from "next/server";

const JUPITER_API_BASE =
  process.env.JUPITER_API_BASE_URL ?? "https://lite-api.jup.ag/swap/v1";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body?.quoteResponse || !body?.userPublicKey) {
    return NextResponse.json(
      { error: "quoteResponse and userPublicKey are required." },
      { status: 400 }
    );
  }

  const response = await fetch(`${JUPITER_API_BASE}/swap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...jupiterHeaders(),
    },
    body: JSON.stringify({
      quoteResponse: body.quoteResponse,
      userPublicKey: body.userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          priorityLevel: "high",
          maxLamports: 1_000_000,
          global: false,
        },
      },
    }),
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
