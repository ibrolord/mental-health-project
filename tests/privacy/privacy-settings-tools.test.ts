import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { generateVisitBrief } from '../../lib/wellbeing/visit-brief';
import type { VisitBriefDatabaseSnapshot } from '../../components/visit-brief-builder';

type VisitBriefModule = typeof import('../../components/visit-brief-builder');
type PrivacyActivityModule = typeof import('../../components/privacy-activity');

let visitBriefModule: VisitBriefModule;
let privacyActivityModule: PrivacyActivityModule;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  [visitBriefModule, privacyActivityModule] = await Promise.all([
    import('../../components/visit-brief-builder'),
    import('../../components/privacy-activity'),
  ]);
});

function snapshot(): VisitBriefDatabaseSnapshot {
  return {
    activityPlans: [
      {
        id: 'activity-1',
        plan_date: '2026-08-06',
        title: 'Morning reset',
        details: 'Start small.',
      },
    ],
    activitySteps: [
      {
        plan_id: 'activity-1',
        action: 'Put on shoes',
        timing: 'After breakfast',
        location: 'Home',
        estimated_minutes: 2,
        position: 1,
        completed: false,
      },
    ],
    safetyPlan: { id: 'safety-1' },
    safetyItems: [
      {
        plan_id: 'safety-1',
        item_kind: 'warning_sign',
        label: 'What I notice',
        details: 'I stop replying',
        position: 0,
      },
      {
        plan_id: 'safety-1',
        item_kind: 'support_contact',
        label: 'Alex',
        details: 'Trusted friend',
        position: 1,
      },
    ],
    stayingWellPlan: { id: 'well-1' },
    stayingWellItems: [
      {
        plan_id: 'well-1',
        item_kind: 'protective_routine',
        label: 'Breakfast',
        details: 'Before work',
        position: 0,
      },
    ],
    sleepEntries: [
      {
        id: 'sleep-incomplete',
        entry_date: '2026-08-05',
        went_to_bed_at: '2026-08-05T22:00:00.000Z',
        tried_to_sleep_at: null,
        fell_asleep_at: null,
        woke_up_at: '2026-08-06T06:00:00.000Z',
        got_out_of_bed_at: null,
        awakenings: 1,
        awake_minutes: 15,
        nap_minutes: 0,
        timezone_offset_minutes: 0,
        timezone_name: 'UTC',
        notes: 'Must not be guessed into a complete entry.',
      },
    ],
    supportPreferences: {
      support_style: 'listening',
      check_in_frequency: 'weekly',
      advice_mode: 'ask_first',
      celebrate_progress: true,
      gentle_reminders: false,
      acknowledge_setbacks: true,
    },
  };
}

describe('Visit Brief database adapter', () => {
  it('builds only allowlisted user-entered sources and marks incomplete sleep data', () => {
    const source = visitBriefModule.adaptVisitBriefRows(snapshot());

    expect(Object.keys(source).sort()).toEqual([
      'activityPlans',
      'safetyPlan',
      'sleepDiary',
      'stayingWellPlan',
      'supportPreferences',
    ]);
    expect(source.sleepDiary?.value[0]).toMatchObject({
      date: '2026-08-05',
      wentToBedAt: '22:00',
      finalWakeAt: '06:00',
      recordedAwakeningCount: 1,
      recordedMinutesAwake: 15,
      recordedNapMinutes: 0,
    });
    const sleepBrief = generateVisitBrief({
      selection: { sleepDiary: true },
      source,
    });
    expect(sleepBrief.preview).toContain('tried to sleep not entered');
    expect(sleepBrief.preview).toContain('got out of bed not entered');
    expect(source).not.toHaveProperty('journal');
    expect(source).not.toHaveProperty('chat');
    expect(source).not.toHaveProperty('assessments');
    expect(source).not.toHaveProperty('moodNotes');
    for (const section of Object.values(source)) {
      expect(section?.provenance).toBe('user-entered');
    }
  });

  it('keeps every section off by default and requires a separate safety opt-in', () => {
    const source = visitBriefModule.adaptVisitBriefRows(snapshot());
    const defaultBrief = generateVisitBrief({ source });
    expect(defaultBrief.preview).toBe('Visit brief');
    expect(defaultBrief.preview).not.toContain('I stop replying');

    const activityOnly = generateVisitBrief({
      selection: { activityPlans: true },
      source,
    });
    expect(activityOnly.preview).toContain('Morning reset');
    expect(activityOnly.preview).not.toContain('I stop replying');

    const safetyBrief = generateVisitBrief({
      selection: { safetyPlan: true },
      source,
    });
    expect(safetyBrief.preview).toContain('I stop replying');
  });

  it('uses the exact same text for preview, clipboard, and download', () => {
    const source = visitBriefModule.adaptVisitBriefRows(snapshot());
    const brief = generateVisitBrief({
      selection: { activityPlans: true, supportPreferences: true },
      source,
    });
    const transfer = visitBriefModule.createVisitBriefTransfer(
      brief,
      '2026-08-05'
    );

    expect(transfer.previewText).toBe(brief.preview);
    expect(transfer.clipboardText).toBe(transfer.previewText);
    expect(transfer.downloadText).toBe(transfer.previewText);
    expect(transfer.filename).toBe('mhtoolkit-visit-brief-2026-08-05.txt');
  });
});

describe('Privacy Activity metadata boundary', () => {
  it('keeps only allowlisted short metadata and removes possible content fields', () => {
    expect(
      privacyActivityModule.sanitizePrivacyMetadata({
        method: 'privacy_settings',
        app_version: '1.2.3',
        journal_entry: 'private journal content',
        chat_message: 'private chat content',
        email: 'person@example.com',
        policy_version: 'x'.repeat(33),
      })
    ).toEqual({
      method: 'privacy_settings',
      app_version: '1.2.3',
    });
    expect(
      privacyActivityModule.sanitizePrivacyMetadata({
        setting: 'journal_content',
        method: 'free_form_method',
      })
    ).toEqual({});
  });

  it('normalizes only known event types and platforms', () => {
    expect(
      privacyActivityModule.normalizePrivacyEvent({
        id: 'event-1',
        event_type: 'export_requested',
        platform: 'web',
        metadata: { method: 'privacy_settings', content: 'private' },
        occurred_at: '2026-08-05T10:00:00.000Z',
      })
    ).toEqual({
      id: 'event-1',
      eventType: 'export_requested',
      platform: 'web',
      metadata: { method: 'privacy_settings' },
      occurredAt: '2026-08-05T10:00:00.000Z',
    });
    expect(
      privacyActivityModule.normalizePrivacyEvent({
        id: 'event-2',
        event_type: 'journal_viewed',
        platform: 'web',
        occurred_at: '2026-08-05T10:00:00.000Z',
      })
    ).toBeNull();
  });

  it('uses explicit owner filters and Settings-only integration', () => {
    const activitySource = readFileSync(
      resolve(process.cwd(), 'components/privacy-activity.tsx'),
      'utf8'
    );
    const briefSource = readFileSync(
      resolve(process.cwd(), 'components/visit-brief-builder.tsx'),
      'utf8'
    );
    const settingsSource = readFileSync(
      resolve(process.cwd(), 'app/settings/page.tsx'),
      'utf8'
    );

    expect(activitySource).toContain(".eq('user_id', requestedOwner)");
    expect(activitySource).toContain(
      ".select('id, event_type, platform, metadata, occurred_at')"
    );
    expect(briefSource).not.toContain(".from('journal_entries')");
    expect(briefSource).not.toContain(".from('chat_history')");
    expect(briefSource).not.toContain(".from('assessments')");
    expect(briefSource).not.toContain(".from('moods')");
    expect(settingsSource).toContain('key={`visit-brief-${user?.id ?? \'signed-out\'}`}');
    expect(settingsSource).toContain('key={`privacy-activity-${user?.id ?? \'signed-out\'}`}');
  });
});
