This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Health endpoint:

```bash
curl http://localhost:3000/api/health
```

## Delivery Pipeline

The repository is wired for:

- Docker-based production builds
- GitHub Actions CI on pull requests and `main`
- GitHub Actions CD to Azure Container Apps on `main`

### One-time Azure bootstrap

Run this locally with an Azure login that can create resources and role assignments:

```bash
chmod +x scripts/ensure-container-apps.sh scripts/deploy-container-apps.sh
./scripts/ensure-container-apps.sh
```

Default Azure names:

- resource group: `macro-front-rg`
- container app environment: `macro-front-env`
- container app: `macro-front-app`
- image name: `macro-front`
- location: `westeurope`
- registry: `macrofront<subscription-suffix>acr`

You can override any of them with environment variables before running the scripts:

```bash
AZURE_LOCATION=swedencentral \
AZURE_RESOURCE_GROUP=macro-front-prod-rg \
AZURE_CONTAINER_APP_NAME=macro-front-prod \
./scripts/ensure-container-apps.sh
```

### GitHub Actions OIDC wiring

Configure these GitHub repository variables before enabling production deploys:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Optional repository variables:

- `AZURE_RESOURCE_GROUP`
- `AZURE_LOCATION`
- `AZURE_ACR_NAME`
- `AZURE_CONTAINERAPPS_ENVIRONMENT`
- `AZURE_CONTAINER_APP_NAME`
- `CONTAINER_IMAGE_NAME`
- `CONTAINER_PORT`
- `HEALTH_PATH`

Recommended Azure role assignments for the GitHub deployment identity after bootstrap:

- `Contributor` on the resource group
- `AcrPush` on the Azure Container Registry

The one-time bootstrap script configures the Container App's managed identity with `AcrPull`. The recurring GitHub deploy workflow only needs to build, push, and update revisions.

### Manual deployment

After bootstrap, you can deploy manually with:

```bash
IMAGE_TAG=manual-$(date -u +%Y%m%d%H%M%S) ./scripts/deploy-container-apps.sh
```

## BOI Fabric Setup

Copy `.env.example` to `.env.local` and fill in the Fabric values.

Required Fabric-side setup for service principals:

1. Create or identify the Microsoft Entra service principal and capture its tenant ID, client ID, and client secret.
2. In the Fabric admin portal, enable the tenant setting `Service principals can use Fabric APIs` for the service principal or its security group.
3. Grant the service principal workspace or item access to the warehouse, then grant the required SQL permissions inside the warehouse.
4. Copy the warehouse SQL connection string from Fabric Settings > SQL endpoint. Use the host as `FABRIC_SERVER` and the warehouse name as `FABRIC_DATABASE`.

`BOI_FABRIC_QUERY` must return these SQL aliases:

- `series_key`
- `series_label`
- `observation_date`
- `value`
- `unit` (optional)
- `category` (optional)

Example query:

```sql
SELECT
  series_key,
  series_label,
  observation_date,
  value,
  unit,
  category
FROM dbo.your_boi_view
ORDER BY series_key, observation_date;
```

Optional service-principal bootstrap flags:

- `FABRIC_BOOTSTRAP_API=true` makes the app call the Fabric REST API before opening the SQL connection. This initializes the Fabric control-plane token for non-interactive principals.
- `FABRIC_BOOTSTRAP_REQUIRED=false` keeps bootstrap best-effort. Set it to `true` if you want startup to fail immediately when Fabric REST API access is misconfigured.

You can inspect the Fabric warehouse structure with:

```bash
node fabric-discover.mjs
```

If the discovery script fails with a Fabric REST API bootstrap error, the usual causes are:

- the Fabric tenant setting for service principals is disabled
- the service principal is not in an allowed security group
- the service principal has not been granted workspace or warehouse access
- `FABRIC_SERVER` or `FABRIC_DATABASE` does not match the warehouse connection string

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
