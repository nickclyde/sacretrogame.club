#!/usr/bin/env bash
# Creates the GCP project and a server-side Maps key restricted to the two APIs
# the site uses. Safe to re-run. Requires: gcloud auth login.
#
#   scripts/gcp-setup.sh [project-id]
#
# Writes GOOGLE_MAPS_API_KEY to .env.local. The key is never printed.
set -euo pipefail

PROJECT="${1:-sac-retro-game-club}"
KEY_NAME="sacretrogame-server"
APIS=(geocoding-backend.googleapis.com routes.googleapis.com apikeys.googleapis.com)

if ! gcloud projects describe "$PROJECT" >/dev/null 2>&1; then
  gcloud projects create "$PROJECT" --name="Sac Retro Game Club"
fi

if [[ "$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)')" != "True" ]]; then
  BILLING="$(gcloud billing accounts list --filter=open=true --format='value(name)' --limit=1)"
  if [[ -z "$BILLING" ]]; then
    echo "No open billing account. Create one at https://console.cloud.google.com/billing and re-run." >&2
    exit 1
  fi
  gcloud billing projects link "$PROJECT" --billing-account="$BILLING"
fi

gcloud services enable "${APIS[@]}" --project="$PROJECT"

KEY_ID="$(gcloud services api-keys list --project="$PROJECT" --filter="displayName=$KEY_NAME" --format='value(name)' --limit=1)"
if [[ -z "$KEY_ID" ]]; then
  gcloud services api-keys create --project="$PROJECT" --display-name="$KEY_NAME" \
    --api-target=service=geocoding-backend.googleapis.com \
    --api-target=service=routes.googleapis.com >/dev/null 2>&1  # the result includes the key string
  KEY_ID="$(gcloud services api-keys list --project="$PROJECT" --filter="displayName=$KEY_NAME" --format='value(name)' --limit=1)"
fi

KEY="$(gcloud services api-keys get-key-string "$KEY_ID" --format='value(keyString)')"
touch .env.local
grep -v '^GOOGLE_MAPS_API_KEY=' .env.local > .env.local.tmp || true
echo "GOOGLE_MAPS_API_KEY=$KEY" >> .env.local.tmp
mv .env.local.tmp .env.local
echo "Wrote GOOGLE_MAPS_API_KEY to .env.local for project $PROJECT."

# Daily caps so a leaked or abused key cannot run up a bill. One drive time
# lookup is 1 geocode plus 18 matrix elements. Needs: gcloud components install alpha
cap() { # service metric value
  gcloud alpha services quota update --service="$1" --consumer="projects/$PROJECT" \
    --metric="$1/$2" --unit='1/d/{project}' --value="$3" --force >/dev/null
}
cap routes.googleapis.com compute_route_matrix_elements 360
cap routes.googleapis.com compute_routes_requests 1
cap geocoding-backend.googleapis.com billable_default 50
echo "Daily caps set: 360 matrix elements, 50 geocodes."
