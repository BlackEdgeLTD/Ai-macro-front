import { NextResponse } from "next/server";

import { fetchRegionDashboard } from "@/lib/cbs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    region: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { region } = await context.params;

  try {
    const payload = await fetchRegionDashboard(decodeURIComponent(region));

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CBS error";
    const status = message.startsWith("Unknown region") ? 404 : 500;

    return NextResponse.json(
      {
        error: "Failed to load CBS region dashboard",
        message,
      },
      {
        status,
      },
    );
  }
}
