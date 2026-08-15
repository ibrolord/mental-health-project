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
      moodHistory: false,
      moodNotes: false,
      assessmentScores: false,
      goals: false,
      habits: false,
      activityPlans: false,
      stayingWellPlan: false,
      sleepDiary: false,
      appleHealth: false,
      supportPreferences: false,
      journalEntries: false,
      savedAiConversations: false,
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

  it('makes every professional-sharing category available as an explicit toggle', () => {
    const component = readFileSync(
      new URL('../../mobile/components/VisitBriefBuilder.tsx', import.meta.url),
      'utf8'
    );
    for (const category of [
      'Mood history',
      'Mood notes',
      'Assessment scores',
      'Goals and milestones',
      'Habits',
      'Apple Health summary',
      'Journal entries',
      'Saved AI conversations',
    ]) {
      expect(component).toContain(category);
    }
    expect(component).toContain('Everything starts off.');
    expect(component).toContain('Health and private records');
    expect(component).toContain('Choose what to include');
    expect(component).toContain('selectedItems.journalEntries');
    expect(component).toContain('selectedItems.savedAiConversations');
  });

  it('renders selected professional context while excluding assessment answers and system prompts', () => {
    const source = adaptVisitBriefRows({
      moods: [{
        id: 'mood-1', emoji: '🙂', note: 'More settled after the walk',
        tags: ['calm'], local_date: '2026-08-14', created_at: '2026-08-14T12:00:00Z',
      }],
      assessments: [{
        id: 'assessment-1', type: 'GAD7', score: 8, max_score: 21,
        created_at: '2026-08-13T12:00:00Z',
      }],
      goals: [{
        id: 'goal-1', content: 'Return to work gradually', status: 'pending',
        priority: 'big', notes: 'Discuss reduced hours', reflection: null,
        due_at: '2026-09-01T12:00:00Z', updated_at: '2026-08-14T12:00:00Z',
      }],
      goalMilestones: [{
        goal_id: 'goal-1', content: 'Email manager', position: 0,
        due_at: '2026-08-20T12:00:00Z', completed_at: null,
      }],
      goalAttachments: [{ goal_id: 'goal-1', file_name: 'return-plan.pdf' }],
      habits: [{
        id: 'habit-1', name: 'Morning walk', description: 'Ten minutes outside',
        frequency: 'daily', streak_count: 3, best_streak: 7, total_completions: 18,
        cue: 'After breakfast', tiny_step: 'Put on shoes', reward: 'Tea',
        is_active: true, updated_at: '2026-08-14T12:00:00Z',
      }],
      habitLogs: [{
        habit_id: 'habit-1', completed: true, note: 'Felt easier today',
        log_date: '2026-08-14',
      }],
      journalEntries: [{
        id: 'journal-1', title: 'Appointment notes', content: 'Sleep has improved.',
        prompt: null, tags: ['sleep'], created_at: '2026-08-14T12:00:00Z',
      }],
      savedAiConversations: [{
        id: 'chat-1', title: 'Planning', created_at: '2026-08-14T12:00:00Z',
        messages: [
          { role: 'system', content: 'private runtime instruction' },
          { role: 'user', content: 'Help me prepare.' },
          { role: 'assistant', content: 'Write down your main concern.' },
        ],
      }],
    });
    const brief = generateVisitBrief(
      {
        ...createVisitBriefSelection(),
        moodHistory: true,
        moodNotes: true,
        assessmentScores: true,
        goals: true,
        habits: true,
        journalEntries: true,
        savedAiConversations: true,
      },
      source
    );

    expect(brief.preview).toContain('GAD-7 8/21');
    expect(brief.preview).toContain('Milestone 1: Email manager | due 2026-08-20');
    expect(brief.preview).toContain('Attachments: return-plan.pdf');
    expect(brief.preview).toContain('current streak: 3');
    expect(brief.preview).toContain('Entry: Sleep has improved.');
    expect(brief.preview).toContain('You: Help me prepare.');
    expect(brief.preview).not.toContain('private runtime instruction');
    expect(brief.sectionCount).toBe(7);
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
    const catalogProbe = component.slice(
      component.indexOf('async function hasSectionContent'),
      component.indexOf('async function loadCatalogEntry')
    );

    expect(catalogProbe).toContain("section === 'safetyPlan'");
    expect(catalogProbe).toContain('hasSafetyPlan(ownerId)');
    expect(catalogProbe).not.toContain('safety_plan_items');
  });

  it('probes private sections without preloading their text', () => {
    const component = readFileSync(
      new URL('../../mobile/components/VisitBriefBuilder.tsx', import.meta.url),
      'utf8'
    );
    const catalogLoader = component.slice(
      component.indexOf('async function hasSectionContent'),
      component.indexOf('async function loadCatalogEntry')
    );

    expect(catalogLoader).toContain("section === 'supportPreferences' ? 'user_id' : 'id'");
    expect(catalogLoader).toContain('.select(probeColumn)');
    expect(catalogLoader).not.toContain(".select('id, title, content");
    expect(catalogLoader).not.toContain(".select('id, title, messages");
  });
});
