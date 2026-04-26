#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IPA_PATH=""
EXPECTED_BUILD=""
RUN_ISOLATED_DOCTOR=1

usage() {
  cat <<'USAGE'
Usage: npm run review:ios -- --ipa /path/to/app.ipa [--build-number 22] [--skip-isolated-doctor]

Runs the App Review pre-submit checks that caught prior MHtoolkit issues:
- TypeScript compile
- Expo Doctor in a mobile-only temp checkout
- EAS production env variable presence
- live support/privacy URL and contact email checks
- IPA Info.plist and bundle inspection
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ipa)
      IPA_PATH="${2:-}"
      shift 2
      ;;
    --build-number)
      EXPECTED_BUILD="${2:-}"
      shift 2
      ;;
    --skip-isolated-doctor)
      RUN_ISOLATED_DOCTOR=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

failures=0

pass() {
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}

require_file() {
  if [ ! -f "$1" ]; then
    fail "$2 missing: $1"
    return 1
  fi
}

check_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
    return 1
  fi
}

check_command node
check_command npm
check_command curl
check_command unzip
check_command grep
check_command /usr/libexec/PlistBuddy

cd "$ROOT_DIR"

if npx tsc --noEmit; then
  pass "TypeScript compile"
else
  fail "TypeScript compile"
fi

if [ "$RUN_ISOLATED_DOCTOR" -eq 1 ]; then
  TMP_PROJECT="$(mktemp -d /tmp/mhtoolkit-mobile-review.XXXXXX)"
  cleanup_tmp() {
    rm -rf "$TMP_PROJECT"
  }
  trap cleanup_tmp EXIT

  rsync -a \
    --exclude node_modules \
    --exclude ios \
    --exclude android \
    --exclude .expo \
    "$ROOT_DIR/" "$TMP_PROJECT/mobile/"

  if (cd "$TMP_PROJECT/mobile" && npm ci && npx expo-doctor); then
    pass "Expo Doctor in isolated mobile checkout"
  else
    fail "Expo Doctor in isolated mobile checkout"
  fi
fi

if npx eas env:list --environment production --non-interactive 2>/tmp/mhtoolkit-eas-env.err | grep -Eq 'EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY'; then
  if npx eas env:list --environment production --non-interactive 2>/dev/null | grep -q 'EXPO_PUBLIC_SUPABASE_URL' &&
    npx eas env:list --environment production --non-interactive 2>/dev/null | grep -q 'EXPO_PUBLIC_SUPABASE_ANON_KEY'; then
    pass "EAS production Supabase env names are present"
  else
    fail "EAS production Supabase env names are incomplete"
  fi
else
  fail "Could not verify EAS production env names"
fi

SUPPORT_HTML="$(mktemp -t mhtoolkit-support)"
PRIVACY_HTML="$(mktemp -t mhtoolkit-privacy)"

support_code="$(curl -L -s -o "$SUPPORT_HTML" -w '%{http_code}' https://mhtoolkit.vercel.app/support || true)"
privacy_code="$(curl -L -s -o "$PRIVACY_HTML" -w '%{http_code}' https://mhtoolkit.vercel.app/privacy || true)"

if [ "$support_code" = "200" ]; then
  pass "Support URL returns 200"
else
  fail "Support URL returned HTTP $support_code"
fi

if [ "$privacy_code" = "200" ]; then
  pass "Privacy URL returns 200"
else
  fail "Privacy URL returned HTTP $privacy_code"
fi

if grep -q 'bolajiag10@gmail.com' "$SUPPORT_HTML" && grep -q 'bolajiag10@gmail.com' "$PRIVACY_HTML"; then
  pass "Support/privacy pages include current contact email"
else
  fail "Support/privacy pages do not both include bolajiag10@gmail.com"
fi

if grep -Eq 'support@mhtoolkit\.com|princebolajibreeze@gmail\.com' "$SUPPORT_HTML" "$PRIVACY_HTML"; then
  fail "Support/privacy pages contain stale support email"
else
  pass "Support/privacy pages omit stale support emails"
fi

if [ -n "$IPA_PATH" ]; then
  if require_file "$IPA_PATH" "IPA"; then
    IPA_TMP="$(mktemp -d /tmp/mhtoolkit-ipa-review.XXXXXX)"
    unzip -q -o "$IPA_PATH" -d "$IPA_TMP"
    APP_DIR="$(find "$IPA_TMP/Payload" -maxdepth 2 -name '*.app' -type d | head -1)"
    BUNDLE_PATH="$(find "$APP_DIR" -maxdepth 2 -name 'main.jsbundle' -type f | head -1)"
    EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_DIR/Info.plist")"

    bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_DIR/Info.plist")"
    build_number="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_DIR/Info.plist")"
    full_screen="$(/usr/libexec/PlistBuddy -c 'Print :UIRequiresFullScreen' "$APP_DIR/Info.plist")"
    encryption="$(/usr/libexec/PlistBuddy -c 'Print :ITSAppUsesNonExemptEncryption' "$APP_DIR/Info.plist")"
    device_family="$(/usr/libexec/PlistBuddy -c 'Print :UIDeviceFamily' "$APP_DIR/Info.plist")"

    if [ "$bundle_id" = "com.mhtoolkit.app" ]; then
      pass "IPA bundle identifier is com.mhtoolkit.app"
    else
      fail "IPA bundle identifier is $bundle_id"
    fi

    if [ -z "$EXPECTED_BUILD" ] || [ "$build_number" = "$EXPECTED_BUILD" ]; then
      pass "IPA build number is ${build_number}"
    else
      fail "IPA build number is $build_number, expected $EXPECTED_BUILD"
    fi

    if printf '%s\n' "$device_family" | grep -q '1' && ! printf '%s\n' "$device_family" | grep -q '2'; then
      pass "IPA UIDeviceFamily is iPhone-only"
    else
      fail "IPA UIDeviceFamily is not iPhone-only: $device_family"
    fi

    if [ "$full_screen" = "true" ]; then
      pass "IPA requires fullscreen for iPad compatibility mode"
    else
      fail "IPA UIRequiresFullScreen is not true"
    fi

    if [ "$encryption" = "false" ]; then
      pass "IPA encryption flag is false"
    else
      fail "IPA encryption flag is $encryption"
    fi

    if [ -n "$BUNDLE_PATH" ] && grep -aFq '.supabase.co' "$BUNDLE_PATH"; then
      pass "IPA bundle embeds production Supabase URL"
    else
      fail "IPA bundle does not embed Supabase URL"
    fi

    if grep -aFq 'ExpoPushTokenManager' "$BUNDLE_PATH" ||
      grep -aFq 'expo-notifications' "$BUNDLE_PATH" ||
      grep -aFq 'expo-device' "$BUNDLE_PATH" ||
      strings "$APP_DIR/$EXECUTABLE" | grep -Eq 'ExpoPushTokenManager|EXNotifications|ExpoNotifications|expo-notifications|expo-device|ExpoDevice'; then
      fail "IPA still contains excluded notifications/device native symbols"
    else
      pass "IPA omits excluded notifications/device native symbols"
    fi

    if grep -aEq 'support@mhtoolkit\.com|princebolajibreeze@gmail\.com' "$BUNDLE_PATH"; then
      fail "IPA bundle contains stale support email"
    else
      pass "IPA bundle omits stale support emails"
    fi
  fi
else
  echo "WARN IPA inspection skipped; pass --ipa /path/to/app.ipa before App Review submission"
fi

if [ "$failures" -gt 0 ]; then
  echo "Review verification failed with $failures failure(s)." >&2
  exit 1
fi

echo "Review verification passed."
