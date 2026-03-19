import { NextResponse } from "next/server";

import { buildCustomDashboard } from "@/lib/custom-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json(
        {
          error: "Missing prompt",
        },
        {
          status: 400,
        },
      );
    }

    const payload = await buildCustomDashboard(prompt);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown custom dashboard error";

    return NextResponse.json(
      {
        error: "Failed to build custom dashboard",
        message,
      },
      {
        status: 500,
      },
    );
  }
}
