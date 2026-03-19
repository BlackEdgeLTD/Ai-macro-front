import { BlobServiceClient } from "@azure/storage-blob";

import type { UserProfile } from "@/lib/user-types";

const CONTAINER_NAME = "user-profiles";

declare global {
  var __blobServiceClient: BlobServiceClient | undefined;
}

function getBlobServiceClient() {
  if (!global.__blobServiceClient) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
    if (!connectionString) {
      throw new Error(
        "Missing required environment variable: AZURE_STORAGE_CONNECTION_STRING",
      );
    }
    global.__blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
  }
  return global.__blobServiceClient;
}

function getContainerClient() {
  return getBlobServiceClient().getContainerClient(CONTAINER_NAME);
}

function blobName(oid: string) {
  return `${oid}.json`;
}

export async function getUserProfile(
  oid: string,
): Promise<UserProfile | null> {
  try {
    const blob = getContainerClient().getBlobClient(blobName(oid));
    const response = await blob.download();
    const body = await streamToString(response.readableStreamBody!);
    return JSON.parse(body) as UserProfile;
  } catch (error: unknown) {
    if (
      error instanceof Object &&
      "statusCode" in error &&
      (error as { statusCode: number }).statusCode === 404
    ) {
      return null;
    }
    throw error;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const blob = getContainerClient().getBlockBlobClient(blobName(profile.oid));
  const data = JSON.stringify(profile);
  await blob.upload(data, Buffer.byteLength(data), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

export async function ensureUserProfile(
  oid: string,
  displayName: string,
  email: string,
): Promise<UserProfile> {
  const existing = await getUserProfile(oid);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const profile: UserProfile = {
    oid,
    displayName,
    email,
    createdAt: now,
    updatedAt: now,
    preferences: {
      defaultView: "home",
      boiDateRange: null,
      cbsDateRange: null,
      selectedRegion: null,
    },
    customDashboards: [],
    searchHistory: [],
  };

  await saveUserProfile(profile);
  return profile;
}

async function streamToString(
  stream: NodeJS.ReadableStream,
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
