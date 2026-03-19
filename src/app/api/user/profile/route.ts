import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { getUserProfile, saveUserProfile } from "@/lib/user-storage";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const profile = await getUserProfile(session!.user.oid);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const profile = await getUserProfile(session!.user.oid);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const updates = (await request.json()) as Record<string, unknown>;

  if (updates.preferences && typeof updates.preferences === "object") {
    profile.preferences = { ...profile.preferences, ...updates.preferences };
  }
  if (Array.isArray(updates.customDashboards)) {
    profile.customDashboards = updates.customDashboards;
  }
  if (Array.isArray(updates.searchHistory)) {
    profile.searchHistory = updates.searchHistory;
  }

  profile.updatedAt = new Date().toISOString();
  await saveUserProfile(profile);

  return NextResponse.json(profile);
}
