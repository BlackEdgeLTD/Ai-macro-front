import { NextResponse } from "next/server";

import { fetchDashboardSummary } from "@/lib/cbs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await fetchDashboardSummary();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CBS error";

    return NextResponse.json(
      {
        error: "Failed to load CBS dashboard summary",
        message,
      },
      {
        status: 500,
      },
    );
  }
}
