#!/usr/bin/env bash
set -euo pipefail

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

generate_auth_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi

  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr -d '-'
    return
  fi

  echo "Unable to generate AUTH_SECRET automatically. Install openssl or uuidgen." >&2
  exit 1
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp

  tmp="$(mktemp)"

  if [[ -f "$file" ]]; then
    awk -v key="$key" -v value="$value" '
      BEGIN { found = 0 }
      index($0, key "=") == 1 {
        print key "=" value
        found = 1
        next
      }
      { print }
      END {
        if (!found) {
          print key "=" value
        }
      }
    ' "$file" >"$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >"$tmp"
  fi

  mv "$tmp" "$file"
}

require_command az

az config set extension.use_dynamic_install=yes_without_prompt >/dev/null

subscription_id="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
tenant_id="${AZURE_TENANT_ID:-$(az account show --query tenantId -o tsv)}"
name_suffix="$(printf "%s" "$subscription_id" | tr -cd '[:alnum:]' | tr '[:upper:]' '[:lower:]' | cut -c1-8)"

resource_group="${AZURE_RESOURCE_GROUP:-macro-front-rg}"
location="${AZURE_LOCATION:-westeurope}"
container_app_name="${AZURE_CONTAINER_APP_NAME:-macro-front-app}"
app_registration_name="${AZURE_APP_REGISTRATION_NAME:-macro-front-auth}"
storage_account_name="${AZURE_STORAGE_ACCOUNT_NAME:-macrofront${name_suffix}st}"
storage_container_name="${AZURE_STORAGE_CONTAINER_NAME:-user-profiles}"
env_file="${ENV_FILE_PATH:-.env.local}"

local_callback_url="${LOCAL_REDIRECT_URI:-http://localhost:3000/api/auth/callback/microsoft-entra-id}"

if ! [[ "$storage_account_name" =~ ^[a-z0-9]{3,24}$ ]]; then
  echo "Storage account name must be 3-24 characters of lowercase letters and numbers: $storage_account_name" >&2
  exit 1
fi

echo "Azure subscription: $subscription_id"
echo "Azure tenant: $tenant_id"
echo "Resource group: $resource_group"
echo "Location: $location"
echo "Container App: $container_app_name"
echo "App registration: $app_registration_name"
echo "Storage account: $storage_account_name"
echo "Storage container: $storage_container_name"

az group create \
  --name "$resource_group" \
  --location "$location" \
  --tags app=macro-front managed-by=codex \
  >/dev/null

existing_client_id="$(
  az ad app list \
    --display-name "$app_registration_name" \
    --query '[0].appId' \
    -o tsv
)"

if [[ -n "$existing_client_id" ]]; then
  client_id="$existing_client_id"
  echo "Using existing app registration: $client_id"
else
  client_id="$(
    az ad app create \
      --display-name "$app_registration_name" \
      --sign-in-audience AzureADMyOrg \
      --query appId \
      -o tsv
  )"
  echo "Created app registration: $client_id"
fi

client_secret="$(
  az ad app credential reset \
    --id "$client_id" \
    --append \
    --display-name "codex-$(date -u +%Y%m%d%H%M%S)" \
    --years 2 \
    --query password \
    -o tsv
)"

prod_fqdn="$(
  az containerapp show \
    --name "$container_app_name" \
    --resource-group "$resource_group" \
    --query properties.configuration.ingress.fqdn \
    -o tsv 2>/dev/null || true
)"

redirect_uris=("$local_callback_url")
if [[ -n "$prod_fqdn" ]]; then
  redirect_uris+=("https://${prod_fqdn}/api/auth/callback/microsoft-entra-id")
fi

az ad app update \
  --id "$client_id" \
  --web-redirect-uris "${redirect_uris[@]}" \
  >/dev/null

if ! az storage account show --name "$storage_account_name" --resource-group "$resource_group" >/dev/null 2>&1; then
  az storage account create \
    --name "$storage_account_name" \
    --resource-group "$resource_group" \
    --location "$location" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --allow-blob-public-access false \
    --min-tls-version TLS1_2 \
    >/dev/null
fi

storage_key="$(
  az storage account keys list \
    --account-name "$storage_account_name" \
    --resource-group "$resource_group" \
    --query '[0].value' \
    -o tsv
)"

az storage container create \
  --name "$storage_container_name" \
  --account-name "$storage_account_name" \
  --account-key "$storage_key" \
  --auth-mode key \
  >/dev/null

storage_connection_string="$(
  az storage account show-connection-string \
    --name "$storage_account_name" \
    --resource-group "$resource_group" \
    --query connectionString \
    -o tsv
)"

auth_secret="${AUTH_SECRET:-$(generate_auth_secret)}"

upsert_env_var "$env_file" "AUTH_SECRET" "$auth_secret"
upsert_env_var "$env_file" "AUTH_URL" "http://localhost:3000"
upsert_env_var "$env_file" "NEXTAUTH_URL" "http://localhost:3000"
upsert_env_var "$env_file" "AUTH_MICROSOFT_ENTRA_ID_ID" "$client_id"
upsert_env_var "$env_file" "AUTH_MICROSOFT_ENTRA_ID_SECRET" "$client_secret"
upsert_env_var "$env_file" "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID" "$tenant_id"
upsert_env_var "$env_file" "AUTH_TRUST_HOST" "true"
upsert_env_var "$env_file" "AZURE_STORAGE_CONNECTION_STRING" "$storage_connection_string"

if az containerapp show --name "$container_app_name" --resource-group "$resource_group" >/dev/null 2>&1; then
  auth_url="https://${prod_fqdn}"

  az containerapp secret set \
    --name "$container_app_name" \
    --resource-group "$resource_group" \
    --secrets \
      auth-secret="$auth_secret" \
      entra-client-secret="$client_secret" \
      azure-storage-connection-string="$storage_connection_string" \
    >/dev/null

  az containerapp update \
    --name "$container_app_name" \
    --resource-group "$resource_group" \
    --replace-env-vars \
      NODE_ENV=production \
      HOSTNAME=0.0.0.0 \
      PORT=3000 \
      AUTH_URL="$auth_url" \
      NEXTAUTH_URL="$auth_url" \
      AUTH_SECRET=secretref:auth-secret \
      AUTH_MICROSOFT_ENTRA_ID_ID="$client_id" \
      AUTH_MICROSOFT_ENTRA_ID_SECRET=secretref:entra-client-secret \
      AUTH_MICROSOFT_ENTRA_ID_TENANT_ID="$tenant_id" \
      AUTH_TRUST_HOST=true \
      AZURE_STORAGE_CONNECTION_STRING=secretref:azure-storage-connection-string \
    >/dev/null
fi

echo
echo "Bootstrap complete."
echo "Client ID: $client_id"
echo "Tenant ID: $tenant_id"
echo "Storage account: $storage_account_name"
echo "Storage container: $storage_container_name"
echo "Local env file updated: $env_file"
echo "Local redirect URI: $local_callback_url"
if [[ -n "$prod_fqdn" ]]; then
  echo "Production redirect URI: https://${prod_fqdn}/api/auth/callback/microsoft-entra-id"
  echo "Container App secrets updated: $container_app_name"
else
  echo "Production redirect URI skipped because Container App $container_app_name was not found in $resource_group."
fi
