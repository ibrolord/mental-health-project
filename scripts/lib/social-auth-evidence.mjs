export const SOCIAL_AUTH_REQUIRED_CHECKS = [
  'redirectMobile',
  'redirectWeb',
  'redirectConfirmation',
  'manualLinking',
  'appleNativeAudience',
  'googleClientIdConfigured',
];

export const SOCIAL_AUTH_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

export function validateSocialAuthDashboardEvidence(
  evidence,
  { projectRef, now = Date.now(), maxAgeMs = SOCIAL_AUTH_EVIDENCE_MAX_AGE_MS } = {}
) {
  const errors = [];
  if (evidence?.schemaVersion !== 1) {
    errors.push('Dashboard evidence schemaVersion must be 1.');
  }
  if (evidence?.method !== 'supabase-dashboard') {
    errors.push('Dashboard evidence method must be supabase-dashboard.');
  }
  if (!projectRef || evidence?.projectRef !== projectRef) {
    errors.push('Dashboard evidence does not match the production project ref.');
  }

  const observedAt = Date.parse(evidence?.observedAt ?? '');
  if (!Number.isFinite(observedAt)) {
    errors.push('Dashboard evidence observedAt must be a valid ISO timestamp.');
  } else {
    const ageMs = now - observedAt;
    if (ageMs < -5 * 60 * 1_000) {
      errors.push('Dashboard evidence observedAt is in the future.');
    } else if (ageMs > maxAgeMs) {
      errors.push('Dashboard evidence is older than 24 hours.');
    }
  }

  for (const check of SOCIAL_AUTH_REQUIRED_CHECKS) {
    if (evidence?.checks?.[check] !== true) {
      errors.push(`Dashboard evidence check ${check} is not confirmed.`);
    }
  }
  return errors;
}
