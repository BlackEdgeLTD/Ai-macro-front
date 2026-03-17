import { ClientSecretCredential } from '@azure/identity';
import sql from 'mssql';

const FABRIC_SQL_SCOPE = 'https://database.windows.net/.default';
const FABRIC_API_SCOPE = 'https://api.fabric.microsoft.com/.default';
const FABRIC_BOOTSTRAP_URL = 'https://api.fabric.microsoft.com/v1/workspaces';

const tenantId = process.env.FABRIC_TENANT_ID;
const clientId = process.env.FABRIC_CLIENT_ID;
const clientSecret = process.env.FABRIC_CLIENT_SECRET;
const server = process.env.FABRIC_SERVER;
const database = process.env.FABRIC_DATABASE;

function requiredValue(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isEnabled(value, defaultValue) {
  if (!value) {
    return defaultValue;
  }

  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

function summarizeBootstrapFailure(status, body) {
  const compactBody = body.replace(/\s+/g, ' ').trim().slice(0, 300);
  const statusText = `${status}${compactBody ? `: ${compactBody}` : ''}`;

  return [
    `Fabric REST API bootstrap failed (${statusText}).`,
    'Ensure the tenant setting "Service principals can use Fabric APIs" is enabled,',
    'and confirm the service principal has access to the target workspace or item.',
  ].join(' ');
}

async function bootstrapFabricControlPlane(credential) {
  if (!isEnabled(process.env.FABRIC_BOOTSTRAP_API, true)) {
    return;
  }

  console.log('Bootstrapping Fabric REST API access...');
  const tokenResponse = await credential.getToken(FABRIC_API_SCOPE);

  if (!tokenResponse?.token) {
    const message = 'Failed to acquire a Fabric REST API token for service principal bootstrap.';

    if (isEnabled(process.env.FABRIC_BOOTSTRAP_REQUIRED, false)) {
      throw new Error(message);
    }

    console.warn(`${message} Continuing with direct SQL connection.`);
    return;
  }

  const response = await fetch(FABRIC_BOOTSTRAP_URL, {
    headers: {
      Authorization: `Bearer ${tokenResponse.token}`,
    },
  });

  if (response.ok) {
    console.log('Fabric REST API bootstrap succeeded.');
    return;
  }

  const message = summarizeBootstrapFailure(response.status, await response.text());

  if (isEnabled(process.env.FABRIC_BOOTSTRAP_REQUIRED, false)) {
    throw new Error(message);
  }

  console.warn(`${message} Continuing with direct SQL connection.`);
}

async function main() {
  requiredValue('FABRIC_TENANT_ID', tenantId);
  requiredValue('FABRIC_CLIENT_ID', clientId);
  requiredValue('FABRIC_CLIENT_SECRET', clientSecret);
  requiredValue('FABRIC_SERVER', server);

  console.log('Getting Azure AD tokens...');
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  await bootstrapFabricControlPlane(credential);
  const tokenResponse = await credential.getToken(FABRIC_SQL_SCOPE);
  console.log('SQL token acquired!');

  const config = {
    server,
    database,
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token: tokenResponse.token },
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
      connectTimeout: 30000,
      requestTimeout: 30000,
    },
  };

  console.log('Connecting to Fabric...');
  const pool = await sql.connect(config);
  console.log('Connected!');

  const dbResult = await pool.request().query(`SELECT name FROM sys.databases`);
  console.log('\n=== DATABASES ===');
  for (const row of dbResult.recordset) {
    console.log(' -', row.name);
  }

  const tableResult = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE 
    FROM INFORMATION_SCHEMA.TABLES 
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);
  console.log('\n=== TABLES ===');
  for (const row of tableResult.recordset) {
    console.log(` - ${row.TABLE_SCHEMA}.${row.TABLE_NAME} (${row.TABLE_TYPE})`);
  }

  for (const row of tableResult.recordset) {
    try {
      const cols = await pool.request().query(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${row.TABLE_SCHEMA}' AND TABLE_NAME='${row.TABLE_NAME}' ORDER BY ORDINAL_POSITION`
      );
      console.log(`\n=== COLUMNS: ${row.TABLE_SCHEMA}.${row.TABLE_NAME} ===`);
      for (const c of cols.recordset) {
        console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);
      }
      const sample = await pool.request().query(
        `SELECT TOP 3 * FROM [${row.TABLE_SCHEMA}].[${row.TABLE_NAME}]`
      );
      console.log(`--- Sample rows ---`);
      console.log(JSON.stringify(sample.recordset, null, 2));
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  await pool.close();
}

main().catch(err => {
  console.error('Error:', err.message);
});
