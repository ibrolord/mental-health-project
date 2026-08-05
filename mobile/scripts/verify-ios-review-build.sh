#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IPA_PATH=""
EXPECTED_BUILD=""
RUN_ISOLATED_DOCTOR=1
MIC_PERMISSION="MHtoolkit uses the microphone only during a live voice session so the AI can hear and respond to you."
AI_CONSENT_TITLE="AI Data Sharing Consent"
AI_PROVIDER_COPY="Google Gemini, Anthropic Claude, or OpenAI"

usage() {
  cat <<'USAGE'
Usage: npm run review:ios -- --ipa /path/to/app.ipa [--build-number 22] [--skip-isolated-doctor]

Runs the App Review pre-submit checks that caught prior MHtoolkit issues:
- TypeScript compile
- Expo Doctor in a mobile-only temp checkout
- EAS production env variable presence
- live Google/Apple provider and redirect readiness
- live support/privacy URL and contact email checks
- IPA Info.plist, entitlement, and bundle inspection
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

if command -v eas >/dev/null 2>&1; then
  EAS_CMD=(eas)
else
  EAS_CMD=(npx --yes eas-cli)
fi

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

EAS_ENV_OUTPUT="$(CI=1 "${EAS_CMD[@]}" env:list --environment production 2>/tmp/mhtoolkit-eas-env.err || true)"
if printf '%s\n' "$EAS_ENV_OUTPUT" | grep -Eq 'EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY'; then
  if printf '%s\n' "$EAS_ENV_OUTPUT" | grep -q 'EXPO_PUBLIC_SUPABASE_URL' &&
    printf '%s\n' "$EAS_ENV_OUTPUT" | grep -q 'EXPO_PUBLIC_SUPABASE_ANON_KEY'; then
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

SUPPORT_SOURCE="$ROOT_DIR/lib/support.ts"
SETTINGS_SOURCE="$ROOT_DIR/app/settings.tsx"
if grep -Fq "bolajiag10@gmail.com" "$SUPPORT_SOURCE" &&
  grep -Fq "https://mhtoolkit.vercel.app/support" "$SUPPORT_SOURCE" &&
  grep -Fq "import { SUPPORT_EMAIL, SUPPORT_EMAIL_URL, SUPPORT_URL } from '@/lib/support';" "$SETTINGS_SOURCE" &&
  grep -Fq "Email Support & Feedback" "$SETTINGS_SOURCE" &&
  grep -Fq "openSupportLink(SUPPORT_EMAIL_URL, 'Email')" "$SETTINGS_SOURCE" &&
  grep -Fq "View Support & Crisis Resources" "$SETTINGS_SOURCE" &&
  grep -Fq "openSupportLink(SUPPORT_URL, 'Support Page')" "$SETTINGS_SOURCE"; then
  pass "Mobile Settings wires support email, feedback, and crisis resources"
else
  fail "Mobile Settings support and feedback path is incomplete"
fi

if (cd "$ROOT_DIR/.." && node scripts/verify-resource-links.mjs >/tmp/mhtoolkit-resource-links.log 2>&1); then
  pass "Every /resources link is reachable"
else
  fail "One or more /resources links are unreachable (see /tmp/mhtoolkit-resource-links.log)"
fi

ACCOUNT_DELETE_ROUTE="$ROOT_DIR/../app/api/account/delete/route.ts"
if [ -f "$ACCOUNT_DELETE_ROUTE" ] &&
  grep -q 'deleteUser' "$ACCOUNT_DELETE_ROUTE" &&
  grep -q 'Delete Account' "$ROOT_DIR/app/settings.tsx" &&
  grep -q 'result?.deleted' "$ROOT_DIR/lib/auth-context.tsx"; then
  pass "Mobile app exposes verified server-side account deletion"
else
  fail "Mobile verified server-side account deletion path is missing"
fi

if grep -Fq "$MIC_PERMISSION" "$ROOT_DIR/app.json"; then
  pass "Microphone permission purpose string is specific"
else
  fail "Microphone permission purpose string is missing or too generic"
fi

if (cd "$ROOT_DIR/.." && npm run verify:social-auth); then
  pass "Google and Apple production auth configuration"
else
  fail "Google or Apple production auth configuration is incomplete"
fi

if grep -Fq '"usesAppleSignIn": true' "$ROOT_DIR/app.json" &&
  grep -Fq '"expo-apple-authentication"' "$ROOT_DIR/app.json" &&
  grep -Fq '"scheme": "mhtoolkit"' "$ROOT_DIR/app.json"; then
  pass "Mobile source configures Apple capability and OAuth callback scheme"
else
  fail "Mobile Apple capability or OAuth callback scheme is missing"
fi

if grep -Fq "$AI_CONSENT_TITLE" "$ROOT_DIR/lib/ai-consent.ts" &&
  grep -Fq "$AI_PROVIDER_COPY" "$ROOT_DIR/app/settings.tsx" &&
  grep -Fq 'ensureAiDataSharingConsent' "$ROOT_DIR/app/(tabs)/chat.tsx" &&
  grep -Fq 'ensureAiDataSharingConsent' "$ROOT_DIR/app/voice.tsx" &&
  grep -Fq 'ensureAiDataSharingConsent' "$ROOT_DIR/app/affirmations.tsx"; then
  pass "Mobile AI features require explicit data-sharing consent"
else
  fail "Mobile AI consent gate is missing from one or more AI features"
fi

if grep -Fq 'AI data sharing consent' "$ROOT_DIR/app/settings.tsx" &&
  grep -Fq 'Revoke AI Consent' "$ROOT_DIR/app/settings.tsx"; then
  pass "Mobile Settings exposes AI consent status and revocation"
else
  fail "Mobile Settings does not expose AI consent status and revocation"
fi

if grep -Fq 'Before your first AI request' "$ROOT_DIR/../app/privacy/page.tsx" &&
  grep -Fq 'Google Gemini' "$ROOT_DIR/../app/privacy/page.tsx" &&
  grep -Fq 'Anthropic Claude' "$ROOT_DIR/../app/privacy/page.tsx" &&
  grep -Fq 'OpenAI' "$ROOT_DIR/../app/privacy/page.tsx" &&
  grep -Fq 'AI consent' "$ROOT_DIR/../app/privacy/page.tsx"; then
  pass "Privacy policy source explains AI providers, data categories, and consent"
else
  fail "Privacy policy source does not fully explain AI data sharing and consent"
fi

if grep -R -F 'AI Data Sharing Consent' "$ROOT_DIR/../lib/ai-consent.ts" >/dev/null 2>&1 &&
  grep -R -F 'Google Gemini, Anthropic Claude, and OpenAI' "$ROOT_DIR/../lib/ai-consent.ts" >/dev/null 2>&1; then
  pass "Web AI consent source names consent and AI providers"
else
  fail "Web AI consent source does not name consent and AI providers"
fi

COPY_PATHS=(
  "$ROOT_DIR/app"
  "$ROOT_DIR/lib"
  "$ROOT_DIR/../app"
  "$ROOT_DIR/../components"
  "$ROOT_DIR/../lib"
)
if grep -R -F 'We never sell or share your data' "${COPY_PATHS[@]}" >/dev/null 2>&1 ||
  grep -R -F 'We never sell or share your personal data' "${COPY_PATHS[@]}" >/dev/null 2>&1; then
  fail "App/support/privacy copy still contains absolute no-sharing wording"
else
  pass "App/support/privacy copy avoids absolute no-sharing wording"
fi

if [ -f "$ROOT_DIR/fastlane/screenshots/en-US/01_dashboard.png" ] &&
  [ -f "$ROOT_DIR/fastlane/screenshots/en-US/02_library.png" ] &&
  [ -f "$ROOT_DIR/fastlane/screenshots/en-US/03_chat.png" ] &&
  [ -f "$ROOT_DIR/fastlane/screenshots/en-US/04_assessments.png" ] &&
  [ -f "$ROOT_DIR/fastlane/screenshots/en-US/05_journal.png" ] &&
  [ -f "$ROOT_DIR/fastlane/screenshots/en-US/06_ground.png" ] &&
  [ -f "$ROOT_DIR/fastlane/screenshots/en-US/07_focus.png" ] &&
  [ -f "$ROOT_DIR/fastlane/screenshots/en-US/08_habits.png" ] &&
  [ -f "$ROOT_DIR/fastlane/screenshots/en-US/09_meditation.png" ]; then
  pass "Fastlane screenshots cover the current nine-feature store set"
else
  fail "Fastlane screenshots are missing one or more current feature screens"
fi

promo_chars="$(wc -m < "$ROOT_DIR/fastlane/metadata/en-US/promotional_text.txt" | tr -d ' ')"
if [ "$promo_chars" -le 170 ]; then
  pass "Promotional text is within App Store length limit"
else
  fail "Promotional text is $promo_chars characters, over the 170-character App Store limit"
fi

if grep -q 'Please pause and check your safety' "$ROOT_DIR/app/assessments/[type].tsx" &&
  grep -q "hasPositivePhq9SafetyResponse" "$ROOT_DIR/app/assessments/[type].tsx" &&
  grep -q 'Please pause and check your safety' "$ROOT_DIR/../app/assessments/[type]/page.tsx" &&
  grep -q "hasPositivePhq9SafetyResponse" "$ROOT_DIR/../app/assessments/[type]/page.tsx"; then
  pass "PHQ-9 self-harm response shows immediate crisis support"
else
  fail "PHQ-9 self-harm response does not show immediate crisis support"
fi

if grep -R -i -E 'AI CHAT THERAPIST|clinical-grade|clinician-grade|voice therapy|conversation therapy' "$ROOT_DIR/fastlane/metadata/en-US" >/dev/null 2>&1; then
  fail "App Store metadata contains high-risk therapy/clinical overclaim wording"
else
  pass "App Store metadata avoids high-risk therapy/clinical overclaim wording"
fi

if grep -Fq "Seek a doctor's advice" "$ROOT_DIR/fastlane/metadata/en-US/description.txt" &&
  grep -Fq "before making medical decisions" "$ROOT_DIR/fastlane/metadata/en-US/description.txt"; then
  pass "App Store description includes required medical decision disclaimer"
else
  fail "App Store description does not include the required doctor/medical decision disclaimer"
fi

if grep -R -i -E 'CBT-informed|Use Cognitive Behavioral Therapy \(CBT\) techniques|AI therapist|voice therapy|conversation therapy|clinical-grade|clinician-grade|Text HELLO|HELLO to 741741' \
  "$ROOT_DIR/../app" "$ROOT_DIR/../components" "$ROOT_DIR/../lib/ai" "$ROOT_DIR/app" "$ROOT_DIR/lib" >/dev/null 2>&1; then
  fail "App source contains high-risk therapy/clinical overclaim wording"
else
  pass "App source avoids high-risk therapy/clinical overclaim wording"
fi

if grep -Fq 'https://pubmed.ncbi.nlm.nih.gov/11556941/' "$ROOT_DIR/lib/assessments/definitions.ts" &&
  grep -Fq 'https://pubmed.ncbi.nlm.nih.gov/16717171/' "$ROOT_DIR/lib/assessments/definitions.ts" &&
  grep -Fq 'https://nfa.dk/media/hl5nbers/cbi-first-edition.pdf' "$ROOT_DIR/lib/assessments/definitions.ts" &&
  grep -Fq 'https://pubmed.ncbi.nlm.nih.gov/11556941/' "$ROOT_DIR/../lib/assessments/definitions.ts" &&
  grep -Fq 'https://pubmed.ncbi.nlm.nih.gov/16717171/' "$ROOT_DIR/../lib/assessments/definitions.ts" &&
  grep -Fq 'https://nfa.dk/media/hl5nbers/cbi-first-edition.pdf' "$ROOT_DIR/../lib/assessments/definitions.ts"; then
  pass "Assessment definitions include clinical source citations"
else
  fail "Assessment definitions are missing clinical source citations"
fi

if grep -Fq 'If you checked off any problems, how difficult have these problems made it for you' "$ROOT_DIR/lib/assessments/definitions.ts" &&
  grep -Fq 'The daily-life impact answer is not added to the score' "$ROOT_DIR/lib/assessments/definitions.ts" &&
  grep -Fq 'If you checked off any problems, how difficult have these problems made it for you' "$ROOT_DIR/../lib/assessments/definitions.ts" &&
  grep -Fq 'The daily-life impact answer is not added to the score' "$ROOT_DIR/../lib/assessments/definitions.ts"; then
  pass "PHQ-9 and GAD-7 include the unscored functioning follow-up"
else
  fail "PHQ-9 or GAD-7 is missing the unscored functioning follow-up"
fi

if grep -Fq "orderedAnswers(responses, 6, [0, 25, 50, 75, 100])" "$ROOT_DIR/lib/assessments/definitions.ts" &&
  grep -Fq "Math.round(answers.reduce((total, value) => total + value, 0) / answers.length)" "$ROOT_DIR/lib/assessments/definitions.ts" &&
  grep -Fq "orderedAnswers(responses, 6, [0, 25, 50, 75, 100])" "$ROOT_DIR/../lib/assessments/definitions.ts" &&
  grep -Fq "Math.round(answers.reduce((total, value) => total + value, 0) / answers.length)" "$ROOT_DIR/../lib/assessments/definitions.ts"; then
  pass "CBI personal burnout score uses the published item average"
else
  fail "CBI personal burnout score does not use the published item average"
fi

if grep -Fq "PSS4" "$ROOT_DIR/lib/assessments/definitions.ts" ||
  grep -Fq "PSS4" "$ROOT_DIR/../lib/assessments/definitions.ts"; then
  fail "PSS-4 remains exposed without documented instrument permission"
else
  pass "PSS-4 is not exposed without documented instrument permission"
fi

if grep -Fq 'Before you begin' "$ROOT_DIR/app/assessments/[type].tsx" &&
  grep -Fq 'Read the published source' "$ROOT_DIR/app/assessments/[type].tsx" &&
  grep -Fq 'Important limitation' "$ROOT_DIR/app/assessments/[type].tsx"; then
  pass "Mobile assessment screens render medical limitations and citations"
else
  fail "Mobile assessment screens do not render medical limitations and citations"
fi

if grep -Fq 'Before you begin' "$ROOT_DIR/../app/assessments/[type]/page.tsx" &&
  grep -Fq 'Read the published source' "$ROOT_DIR/../app/assessments/[type]/page.tsx" &&
  grep -Fq 'Important limitation' "$ROOT_DIR/../app/assessments/[type]/page.tsx"; then
  pass "Web assessment screens render medical limitations and citations"
else
  fail "Web assessment screens do not render medical limitations and citations"
fi

if grep -R -E "level: '(Minimal|Mild|Moderate|Moderately Severe|Severe) (Anxiety|Depression|Stress|Burnout)'" \
  "$ROOT_DIR/lib/assessments/definitions.ts" "$ROOT_DIR/../lib/assessments/definitions.ts" >/dev/null 2>&1; then
  fail "Assessment levels still read like diagnostic labels instead of symptom ranges"
else
  pass "Assessment levels use non-diagnostic symptom/range wording"
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
    mic_description="$(/usr/libexec/PlistBuddy -c 'Print :NSMicrophoneUsageDescription' "$APP_DIR/Info.plist")"
    ENTITLEMENTS_PATH="$IPA_TMP/entitlements.plist"
    if codesign -d --entitlements - "$APP_DIR" >"$ENTITLEMENTS_PATH" 2>/dev/null; then
      apple_sign_in_entitlement="$(grep -A3 -F 'com.apple.developer.applesignin' "$ENTITLEMENTS_PATH" || true)"
    else
      apple_sign_in_entitlement=""
    fi

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

    if [ "$mic_description" = "$MIC_PERMISSION" ]; then
      pass "IPA microphone permission string is specific"
    else
      fail "IPA microphone permission string is not the expected specific text"
    fi

    if printf '%s\n' "$apple_sign_in_entitlement" | grep -q 'Default'; then
      pass "IPA contains the Sign in with Apple entitlement"
    else
      fail "IPA is missing the Sign in with Apple entitlement"
    fi

    if [ -n "$BUNDLE_PATH" ] && grep -aFq '.supabase.co' "$BUNDLE_PATH"; then
      pass "IPA bundle embeds production Supabase URL"
    else
      fail "IPA bundle does not embed Supabase URL"
    fi

    if grep -aFq 'ExpoPushTokenManager' "$BUNDLE_PATH" ||
      grep -aFq 'expo-notifications' "$BUNDLE_PATH" ||
      grep -aFq 'expo-device' "$BUNDLE_PATH" ||
      strings "$APP_DIR/$EXECUTABLE" | grep -Eq 'ExpoPushTokenManager|EXNotifications|ExpoNotifications|expo-notifications|expo-device|ExpoDevice|EXDeviceModule'; then
      fail "IPA still contains excluded notifications/device native symbols"
    else
      pass "IPA omits excluded notifications/device native symbols"
    fi

    if grep -aFq 'Delete Account' "$BUNDLE_PATH" &&
      grep -aFq '/api/account/delete' "$BUNDLE_PATH" &&
      grep -aFq 'Please pause and check your safety' "$BUNDLE_PATH"; then
      pass "IPA includes account deletion and PHQ-9 crisis UI"
    else
      fail "IPA does not include account deletion and PHQ-9 crisis UI"
    fi

    if grep -aFq 'with Google' "$BUNDLE_PATH" &&
      grep -aFq 'AppleAuthenticationButton' "$BUNDLE_PATH" &&
      grep -aFq 'mhtoolkit://auth/callback' "$BUNDLE_PATH"; then
      pass "IPA includes Google, Apple, and exact OAuth callback paths"
    else
      fail "IPA is missing Google, Apple, or OAuth callback code"
    fi

    if grep -aFq "$AI_CONSENT_TITLE" "$BUNDLE_PATH" &&
      grep -aFq "$AI_PROVIDER_COPY" "$BUNDLE_PATH" &&
      grep -aFq 'Revoke AI Consent' "$BUNDLE_PATH"; then
      pass "IPA includes explicit AI data-sharing consent and revocation UI"
    else
      fail "IPA does not include explicit AI data-sharing consent and revocation UI"
    fi

    if grep -aEiq 'CBT-informed|Use Cognitive Behavioral Therapy \(CBT\) techniques|AI Therapist|Voice Therapy|voice therapy|clinical-grade|clinician-grade|conversation therapy|Text HELLO|HELLO to 741741' "$BUNDLE_PATH"; then
      fail "IPA bundle contains high-risk therapy/clinical overclaim wording"
    else
      pass "IPA bundle avoids high-risk therapy/clinical overclaim wording"
    fi

    if grep -aFq 'Before you begin' "$BUNDLE_PATH" &&
      grep -aFq 'Important limitation' "$BUNDLE_PATH" &&
      grep -aFq 'Read the published source' "$BUNDLE_PATH" &&
      grep -aFq "before making medical decisions" "$BUNDLE_PATH" &&
      grep -aFq 'https://pubmed.ncbi.nlm.nih.gov/11556941/' "$BUNDLE_PATH" &&
      grep -aFq 'https://pubmed.ncbi.nlm.nih.gov/16717171/' "$BUNDLE_PATH" &&
      grep -aFq 'https://nfa.dk/media/hl5nbers/cbi-first-edition.pdf' "$BUNDLE_PATH"; then
      pass "IPA includes Guideline 1.4.1 limitations and assessment citations"
    else
      fail "IPA does not include Guideline 1.4.1 limitations and assessment citations"
    fi

    if grep -aEq 'support@mhtoolkit\.com|princebolajibreeze@gmail\.com' "$BUNDLE_PATH"; then
      fail "IPA bundle contains stale support email"
    else
      pass "IPA bundle omits stale support emails"
    fi

    if grep -aFq 'bolajiag10@gmail.com' "$BUNDLE_PATH" &&
      grep -aFq 'Email Support & Feedback' "$BUNDLE_PATH" &&
      grep -aFq 'View Support & Crisis Resources' "$BUNDLE_PATH"; then
      pass "IPA includes the current support and feedback UI strings"
    else
      fail "IPA does not include the current support and feedback UI strings"
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
