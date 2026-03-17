import { NextResponse } from "next/server";

import { fetchBoiDashboardSummary } from "@/lib/boi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await fetchBoiDashboardSummary();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BOI error";

    return NextResponse.json(
      {
        error: "Failed to load BOI dashboard summary",
        message,
      },
      {
        status: 500,
      },
    );
  }
}
