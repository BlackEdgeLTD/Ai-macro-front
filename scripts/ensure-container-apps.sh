#!/usr/bin/env bash
set -euo pipefail

VERIFY_ONLY=0

if [[ "${1:-}" == "--verify-only" ]]; then
  VERIFY_ONLY=1
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command az

az config set extension.use_dynamic_install=yes_without_prompt >/dev/null

subscription_id="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
name_suffix="$(printf "%s" "$subscription_id" | tr -cd '[:alnum:]' | tr '[:upper:]' '[:lower:]' | cut -c1-8)"

resource_group="${AZURE_RESOURCE_GROUP:-macro-front-rg}"
location="${AZURE_LOCATION:-westeurope}"
acr_name="${AZURE_ACR_NAME:-macrofront${name_suffix}acr}"
containerapps_environment="${AZURE_CONTAINERAPPS_ENVIRONMENT:-macro-front-env}"
container_app_name="${AZURE_CONTAINER_APP_NAME:-macro-front-app}"
container_image_name="${CONTAINER_IMAGE_NAME:-macro-front}"
container_port="${CONTAINER_PORT:-3000}"
health_path="${HEALTH_PATH:-/api/health}"
placeholder_image="${PLACEHOLDER_IMAGE:-mcr.microsoft.com/azuredocs/containerapps-helloworld:latest}"

echo "Azure subscription: $subscription_id"
echo "Resource group: $resource_group"
echo "Location: $location"
echo "ACR name: $acr_name"
echo "Container Apps environment: $containerapps_environment"
echo "Container App name: $container_app_name"

if [[ "$VERIFY_ONLY" -eq 1 ]]; then
  az group show --name "$resource_group" >/dev/null
  az acr show --name "$acr_name" --resource-group "$resource_group" >/dev/null
  az containerapp env show --name "$containerapps_environment" --resource-group "$resource_group" >/dev/null
  az containerapp show --name "$container_app_name" --resource-group "$resource_group" >/dev/null

  echo "Existing Container Apps target verified."
  exit 0
fi

az group create \
  --name "$resource_group" \
  --location "$location" \
  --tags app=macro-front managed-by=codex \
  >/dev/null

if ! az acr show --name "$acr_name" --resource-group "$resource_group" >/dev/null 2>&1; then
  az acr create \
    --name "$acr_name" \
    --resource-group "$resource_group" \
    --location "$location" \
    --sku Basic \
    --admin-enabled false \
    >/dev/null
fi

if ! az containerapp env show --name "$containerapps_environment" --resource-group "$resource_group" >/dev/null 2>&1; then
  az containerapp env create \
    --name "$containerapps_environment" \
    --resource-group "$resource_group" \
    --location "$location" \
    >/dev/null
fi

if ! az containerapp show --name "$container_app_name" --resource-group "$resource_group" >/dev/null 2>&1; then
  az containerapp create \
    --name "$container_app_name" \
    --resource-group "$resource_group" \
    --environment "$containerapps_environment" \
    --image "$placeholder_image" \
    --target-port "$container_port" \
    --ingress external \
    --min-replicas 0 \
    --max-replicas 1 \
    --system-assigned \
    --env-vars NODE_ENV=production HOSTNAME=0.0.0.0 PORT="$container_port" \
    >/dev/null
else
  az containerapp identity assign \
    --name "$container_app_name" \
    --resource-group "$resource_group" \
    --system-assigned \
    >/dev/null

  az containerapp update \
    --name "$container_app_name" \
    --resource-group "$resource_group" \
    --target-port "$container_port" \
    --ingress external \
    --min-replicas 0 \
    --max-replicas 1 \
    --set-env-vars NODE_ENV=production HOSTNAME=0.0.0.0 PORT="$container_port" \
    >/dev/null
fi

acr_id="$(az acr show --name "$acr_name" --resource-group "$resource_group" --query id -o tsv)"
acr_login_server="$(az acr show --name "$acr_name" --resource-group "$resource_group" --query loginServer -o tsv)"
principal_id="$(az containerapp show --name "$container_app_name" --resource-group "$resource_group" --query identity.principalId -o tsv)"

existing_pull_assignment="$(
  az role assignment list \
    --assignee-object-id "$principal_id" \
    --scope "$acr_id" \
    --query "[?roleDefinitionName=='AcrPull'] | length(@)" \
    -o tsv
)"

if [[ "$existing_pull_assignment" == "0" ]]; then
  az role assignment create \
    --assignee-object-id "$principal_id" \
    --assignee-principal-type ServicePrincipal \
    --role AcrPull \
    --scope "$acr_id" \
    >/dev/null
fi

az containerapp registry set \
  --name "$container_app_name" \
  --resource-group "$resource_group" \
  --server "$acr_login_server" \
  --identity system \
  >/dev/null

fqdn="$(az containerapp show --name "$container_app_name" --resource-group "$resource_group" --query properties.configuration.ingress.fqdn -o tsv)"

echo "Bootstrap complete."
echo "Image repository: ${acr_login_server}/${container_image_name}"
echo "Health endpoint: https://${fqdn}${health_path}"
