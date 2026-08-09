import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('privacy state transitions', () => {
  it('rejects delayed Privacy Activity responses from a prior owner or request', () => {
    const source = read('components/privacy-activity.tsx');
    expect(source).toContain('const ownerRef = useRef(ownerId)');
    expect(source).toContain('const requestGenerationRef = useRef(0)');
    expect(source).toContain('ownerRef.current !== requestedOwner');
    expect(source).toContain('requestGenerationRef.current !== requestGeneration');
    expect(source).toContain('requestGenerationRef.current += 1');
  });

  it('shares only the last persisted partner-preference snapshot', () => {
    for (const path of [
      'components/partner-support-preferences.tsx',
      'mobile/components/PartnerSupportPreferences.tsx',
    ]) {
      const source = read(path);
      expect(source).toContain('const [savedDraft, setSavedDraft]');
      expect(source).toContain('setSavedDraft(null)');
      expect(source).toContain('if (!savedDraft || saving || loadingPreferences) return');
      expect(source).toContain('savedDraft.support_style');
      expect(source).not.toContain('${draft.');
    }
  });

  it('clears local AI state only after online deletion succeeds', () => {
    const web = read('app/settings/page.tsx');
    const mobile = read('mobile/app/settings.tsx');
    const webDelete = web.indexOf("'/api/data/delete'");
    const mobileDelete = mobile.indexOf("'/api/data/delete'");
    expect(webDelete).toBeGreaterThanOrEqual(0);
    expect(web.indexOf('clearLocalPrivacyState(consentSubjectId)', webDelete)).toBeGreaterThan(webDelete);
    expect(mobileDelete).toBeGreaterThanOrEqual(0);
    expect(web).toContain('{ expectedUserId: expectedOwnerId }');
    expect(mobile).toContain('{ expectedUserId: expectedOwnerId }');
    expect(web).toContain('{ accessToken: current.session.access_token }');
    expect(mobile).toContain('{ accessToken }');
    expect(mobile.indexOf('resetAiDataSharingConsent(consentSubjectId)', mobileDelete)).toBeGreaterThan(mobileDelete);
    for (const cleanup of [
      'clearFullContextPreference(consentSubjectId)',
      'clearContextSelections(consentSubjectId)',
    ]) {
      expect(mobile).toContain(cleanup);
    }
  });
});
