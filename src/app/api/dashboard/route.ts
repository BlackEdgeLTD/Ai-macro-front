import { NextResponse } from "next/server";

import { fetchMacroDashboardSummary } from "@/lib/macro-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await fetchMacroDashboardSummary();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dashboard error";

    return NextResponse.json(
      {
        error: "Failed to load macro dashboard summary",
        message,
      },
      {
        status: 500,
      },
    );
  }
}
