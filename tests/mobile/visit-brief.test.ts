import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  adaptVisitBriefRows,
  createVisitBriefSelection,
  createVisitBriefTransfer,
  generateVisitBrief,
} from '../../mobile/lib/visit-brief';

const activityRows = {
  activityPlans: [
    { id: 'later', plan_date: '2026-08-07', title: 'Call a friend', details: '' },
    { id: 'first', plan_date: '2026-08-06', title: 'Short walk', details: 'Start small' },
  ],
  activitySteps: [
    { plan_id: 'later', action: 'Send a message', timing: '', location: '', estimated_minutes: 5, position: 1 },
    { plan_id: 'first', action: 'Put on shoes', timing: 'Morning', location: 'Home', estimated_minutes: 2, position: 1 },
  ],
};

describe('mobile Visit Brief', () => {
  it('starts with every section off', () => {
    expect(createVisitBriefSelection()).toEqual({
      activityPlans: false,
      stayingWellPlan: false,
      sleepDiary: false,
      supportPreferences: false,
      safetyPlan: false,
    });
  });

  it('renders selected user-entered content in deterministic order', () => {
    const source = adaptVisitBriefRows(activityRows);
    const selection = { ...createVisitBriefSelection(), activityPlans: true };
    const brief = generateVisitBrief(selection, source);

    expect(brief.preview.indexOf('Short walk')).toBeLessThan(
      brief.preview.indexOf('Call a friend')
    );
    expect(brief.preview).toContain('Step 1: Put on shoes | when: Morning | where: Home | estimated minutes: 2');
  });

  it('requires a separate explicit Safety Plan selection', () => {
    const source = adaptVisitBriefRows({
      safetyPlan: { id: 'safety-1' },
      safetyItems: [
        {
          plan_id: 'safety-1',
          item_kind: 'warning_sign',
          label: 'I stop replying',
          details: '',
          position: 0,
        },
      ],
    });

    expect(generateVisitBrief(createVisitBriefSelection(), source).preview).not.toContain(
      'I stop replying'
    );
    expect(
      generateVisitBrief(
        { ...createVisitBriefSelection(), safetyPlan: true },
        source
      ).preview
    ).toContain('I stop replying');
  });

  it('uses the exact preview as the shared payload', () => {
    const source = adaptVisitBriefRows(activityRows);
    const brief = generateVisitBrief(
      { ...createVisitBriefSelection(), activityPlans: true },
      source
    );
    const transfer = createVisitBriefTransfer(brief);

    expect(transfer.sharedText).toBe(transfer.previewText);
    expect(transfer.previewText).toBe(brief.preview);
  });

  it('retains incomplete sleep rows and contact details without guessing', () => {
    const source = adaptVisitBriefRows({
      sleepEntries: [{
        id: 'partial', entry_date: '2026-08-05', went_to_bed_at: null,
        tried_to_sleep_at: null, fell_asleep_at: null, woke_up_at: null,
        got_out_of_bed_at: null, awakenings: null, awake_minutes: null,
        nap_minutes: null, timezone_offset_minutes: null, timezone_name: null, notes: 'Rough night',
      }],
      safetyPlan: { id: 'safety-1' },
      safetyItems: [{
        plan_id: 'safety-1', item_kind: 'professional_support', label: 'Clinic',
        details: 'Ask for the after-hours duty clinician.', position: 0,
      }],
    });
    const brief = generateVisitBrief(
      { ...createVisitBriefSelection(), sleepDiary: true, safetyPlan: true },
      source
    );
    expect(brief.preview).toContain('went to bed not entered');
    expect(brief.preview).toContain(
      'Clinic (details: Ask for the after-hours duty clinician.)'
    );
  });

  it('does not query or model excluded private content', () => {
    const component = readFileSync(
      new URL('../../mobile/components/VisitBriefBuilder.tsx', import.meta.url),
      'utf8'
    );
    for (const forbidden of [
      'journal_entries',
      'chat_messages',
      'assessment_results',
      'mood_entries',
      'mood_notes',
    ]) {
      expect(component).not.toContain(forbidden);
    }
  });

  it('treats missing brief content as a single empty state, not repeated errors', () => {
    const component = readFileSync(
      new URL('../../mobile/components/VisitBriefBuilder.tsx', import.meta.url),
      'utf8'
    );

    expect(component).toContain('Nothing to add yet');
    expect(component).toContain('Options will appear after you save a plan');
    expect(component).toContain('Could not load your options');
    expect(component).toContain('Nothing has been added to your brief');
    expect(component).toContain('Try again');
    expect(component).toContain('Profile unavailable');
    expect(component).toContain('VISIT_BRIEF_LOAD_TIMEOUT_MS');
    expect(component).not.toContain('No saved content for this section.');
  });

  it('does not preload full Safety Plan content before explicit selection', () => {
    const component = readFileSync(
      new URL('../../mobile/components/VisitBriefBuilder.tsx', import.meta.url),
      'utf8'
    );
    const catalogLoader = component.slice(
      component.indexOf('async function loadCatalogEntry'),
      component.indexOf('async function loadSection')
    );

    expect(catalogLoader).toContain("section === 'safetyPlan'");
    expect(catalogLoader).toContain('hasSafetyPlan(ownerId)');
    expect(catalogLoader).not.toContain('safety_plan_items');
  });
});
