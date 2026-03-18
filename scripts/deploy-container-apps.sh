#!/usr/bin/env bash
set -euo pipefail

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command az
require_command docker
require_command curl

az config set extension.use_dynamic_install=yes_without_prompt >/dev/null

subscription_id="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
name_suffix="$(printf "%s" "$subscription_id" | tr -cd '[:alnum:]' | tr '[:upper:]' '[:lower:]' | cut -c1-8)"

resource_group="${AZURE_RESOURCE_GROUP:-macro-front-rg}"
acr_name="${AZURE_ACR_NAME:-macrofront${name_suffix}acr}"
container_app_name="${AZURE_CONTAINER_APP_NAME:-macro-front-app}"
container_image_name="${CONTAINER_IMAGE_NAME:-macro-front}"
container_port="${CONTAINER_PORT:-3000}"
health_path="${HEALTH_PATH:-/api/health}"
image_tag="${IMAGE_TAG:-${GITHUB_SHA:-local-$(date -u +%Y%m%d%H%M%S)}}"

if ! az acr show --name "$acr_name" --resource-group "$resource_group" >/dev/null 2>&1; then
  echo "Azure Container Registry $acr_name was not found in $resource_group." >&2
  echo "Run ./scripts/ensure-container-apps.sh once with a privileged Azure login before using the deploy workflow." >&2
  exit 1
fi

if ! az containerapp show --name "$container_app_name" --resource-group "$resource_group" >/dev/null 2>&1; then
  echo "Container App $container_app_name was not found in $resource_group." >&2
  echo "Run ./scripts/ensure-container-apps.sh once with a privileged Azure login before using the deploy workflow." >&2
  exit 1
fi

acr_login_server="$(az acr show --name "$acr_name" --resource-group "$resource_group" --query loginServer -o tsv)"
image_ref="${acr_login_server}/${container_image_name}:${image_tag}"

echo "Logging in to ACR ${acr_name}"
az acr login --name "$acr_name" >/dev/null

echo "Building image ${image_ref}"
docker build --platform linux/amd64 --tag "$image_ref" .

echo "Pushing image ${image_ref}"
docker push "$image_ref"

echo "Updating Container App ${container_app_name}"
az containerapp update \
  --name "$container_app_name" \
  --resource-group "$resource_group" \
  --image "$image_ref" \
  --min-replicas 0 \
  --max-replicas 1 \
  --set-env-vars NODE_ENV=production HOSTNAME=0.0.0.0 PORT="$container_port" \
  >/dev/null

fqdn="$(az containerapp show --name "$container_app_name" --resource-group "$resource_group" --query properties.configuration.ingress.fqdn -o tsv)"
health_url="https://${fqdn}${health_path}"

echo "Verifying deployment at ${health_url}"
for attempt in {1..24}; do
  if curl --fail --silent --show-error "$health_url" >/dev/null; then
    active_revision="$(
      az containerapp revision list \
        --name "$container_app_name" \
        --resource-group "$resource_group" \
        --query "[?properties.active].name | [0]" \
        -o tsv
    )"
    echo "Deployment verified."
    echo "Active revision: ${active_revision}"
    echo "Application URL: https://${fqdn}"
    exit 0
  fi

  sleep 10
done

echo "Deployment did not become healthy within the expected time window." >&2
echo "Check Azure Container Apps logs for ${container_app_name} in ${resource_group}." >&2
exit 1
