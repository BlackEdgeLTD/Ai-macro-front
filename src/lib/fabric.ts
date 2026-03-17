import { ClientSecretCredential } from "@azure/identity";
import sql, { type ConnectionPool, type config as SqlConfig } from "mssql";

const FABRIC_SQL_SCOPE = "https://database.windows.net/.default";
const FABRIC_API_SCOPE = "https://api.fabric.microsoft.com/.default";
const FABRIC_BOOTSTRAP_URL = "https://api.fabric.microsoft.com/v1/workspaces";

type FabricEnvironment = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  server: string;
  database?: string;
};

declare global {
  var __fabricPoolPromise: Promise<ConnectionPool> | undefined;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isEnabled(value: string | undefined, defaultValue: boolean) {
  if (!value) {
    return defaultValue;
  }

  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

function summarizeBootstrapFailure(status: number, body: string) {
  const compactBody = body.replace(/\s+/g, " ").trim().slice(0, 300);
  const statusText = `${status}${compactBody ? `: ${compactBody}` : ""}`;

  return [
    `Fabric REST API bootstrap failed (${statusText}).`,
    'Ensure the tenant setting "Service principals can use Fabric APIs" is enabled,',
    "and confirm the service principal has access to the target workspace or item.",
  ].join(" ");
}

async function bootstrapFabricControlPlane(credential: ClientSecretCredential) {
  if (!isEnabled(process.env.FABRIC_BOOTSTRAP_API, true)) {
    return;
  }

  const token = await credential.getToken(FABRIC_API_SCOPE);

  if (!token?.token) {
    const message =
      "Failed to acquire a Fabric REST API token for service principal bootstrap.";

    if (isEnabled(process.env.FABRIC_BOOTSTRAP_REQUIRED, false)) {
      throw new Error(message);
    }

    console.warn(message);
    return;
  }

  const response = await fetch(FABRIC_BOOTSTRAP_URL, {
    headers: {
      Authorization: `Bearer ${token.token}`,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return;
  }

  const message = summarizeBootstrapFailure(
    response.status,
    await response.text(),
  );

  if (isEnabled(process.env.FABRIC_BOOTSTRAP_REQUIRED, false)) {
    throw new Error(message);
  }

  console.warn(`${message} Continuing with direct SQL connection.`);
}

function readFabricEnvironment(): FabricEnvironment {
  return {
    tenantId: requiredEnv("FABRIC_TENANT_ID"),
    clientId: requiredEnv("FABRIC_CLIENT_ID"),
    clientSecret: requiredEnv("FABRIC_CLIENT_SECRET"),
    server: requiredEnv("FABRIC_SERVER"),
    database: process.env.FABRIC_DATABASE?.trim() || undefined,
  };
}

async function createPool() {
  const environment = readFabricEnvironment();
  const credential = new ClientSecretCredential(
    environment.tenantId,
    environment.clientId,
    environment.clientSecret,
  );
  await bootstrapFabricControlPlane(credential);

  const token = await credential.getToken(FABRIC_SQL_SCOPE);

  if (!token?.token) {
    throw new Error("Failed to acquire an access token for Microsoft Fabric");
  }

  const config: SqlConfig = {
    server: environment.server,
    database: environment.database,
    authentication: {
      type: "azure-active-directory-access-token",
      options: {
        token: token.token,
      },
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
      connectTimeout: 30_000,
      requestTimeout: 30_000,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };

  const pool = new sql.ConnectionPool(config);
  return pool.connect();
}

async function getPool() {
  if (!global.__fabricPoolPromise) {
    global.__fabricPoolPromise = createPool().catch((error) => {
      global.__fabricPoolPromise = undefined;
      throw error;
    });
  }

  return global.__fabricPoolPromise;
}

export async function runFabricQuery<T extends Record<string, unknown>>(query: string) {
  const pool = await getPool();
  const result = await pool.request().query<T>(query);
  return result.recordset;
}
