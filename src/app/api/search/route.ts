import { NextResponse } from "next/server";

import { buildMacroContext, streamSearch } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json(
        {
          error: "Missing query",
        },
        {
          status: 400,
        },
      );
    }

    const context = await buildMacroContext();
    const geminiStream = await streamSearch(query, context);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of geminiStream) {
            const text = chunk.text;

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown search error";

    return NextResponse.json(
      {
        error: "Failed to run Gemini search",
        message,
      },
      {
        status: 500,
      },
    );
  }
}
