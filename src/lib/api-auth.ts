import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.oid) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}
