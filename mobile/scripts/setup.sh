#!/bin/bash
set -e

echo "========================================="
echo "  MHtoolkit Mobile - Setup & Build"
echo "========================================="
echo ""

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# ---- Step 1: Run Supabase Migration ----
echo "Step 1: Running Supabase migration..."
echo ""

SUPABASE_URL="https://msnlubqlmowcelfkpgah.supabase.co"
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY "$PROJECT_ROOT/../.env.local" 2>/dev/null | cut -d= -f2-)

if [ -z "$SERVICE_KEY" ]; then
  SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY "$PROJECT_ROOT/../.env" 2>/dev/null | cut -d= -f2-)
fi

if [ -z "$SERVICE_KEY" ]; then
  echo "  Warning: Could not find SUPABASE_SERVICE_ROLE_KEY"
  echo "  Please run the migration manually in the Supabase SQL editor:"
  echo "  File: supabase/migrations/004_fix_rls_and_streaks.sql"
  echo ""
else
  SQL_FILE="$PROJECT_ROOT/../supabase/migrations/004_fix_rls_and_streaks.sql"
  if [ -f "$SQL_FILE" ]; then
    # Use Supabase's SQL API endpoint
    HTTP_CODE=$(curl -s -o /tmp/supabase_migration_result.json -w "%{http_code}" \
      "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
      -H "apikey: ${SERVICE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"sql_query\": $(python3 -c "import json,sys; print(json.dumps(open('$SQL_FILE').read()))")}" \
      2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
      echo "  Migration executed successfully!"
    else
      echo "  Could not run migration via API (HTTP $HTTP_CODE)."
      echo "  Please run it manually in the Supabase SQL editor."
      echo "  File: supabase/migrations/004_fix_rls_and_streaks.sql"
    fi
  fi
fi

echo ""

# ---- Step 2: Check EAS login ----
echo "Step 2: Checking EAS CLI..."
if ! command -v eas &> /dev/null; then
  echo "  Installing EAS CLI..."
  npm install -g eas-cli
fi

echo "  Checking EAS login status..."
if ! eas whoami 2>/dev/null; then
  echo ""
  echo "  You need to log in to EAS. Running login..."
  eas login
fi

echo ""

# ---- Step 3: Link EAS project ----
echo "Step 3: Linking EAS project..."
EAS_PROJECT_ID=$(grep -o '"projectId": "[^"]*"' app.json 2>/dev/null | head -1 | cut -d'"' -f4)

if [ -z "$EAS_PROJECT_ID" ] || [ "$EAS_PROJECT_ID" = "" ]; then
  echo "  No EAS project ID found. Initializing..."
  eas init
fi

echo ""

# ---- Step 4: Build ----
echo "Step 4: Building for iOS..."
echo ""
echo "Choose build type:"
echo "  1) Development (simulator build for testing)"
echo "  2) Preview (internal distribution for real devices)"
echo "  3) Production (TestFlight / App Store)"
echo ""
read -p "Enter choice [1-3]: " BUILD_CHOICE

case $BUILD_CHOICE in
  1) eas build --platform ios --profile development ;;
  2) eas build --platform ios --profile preview ;;
  3) eas build --platform ios --profile production ;;
  *) echo "Invalid choice. Running development build..." && eas build --platform ios --profile development ;;
esac

echo ""
echo "========================================="
echo "  Build submitted! Check status at:"
echo "  https://expo.dev"
echo "========================================="
