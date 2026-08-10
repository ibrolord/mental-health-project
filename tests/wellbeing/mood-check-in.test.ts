import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  addCustomMoodEmotion,
  advanceOwnerGeneration,
  composeMoodTags,
  createMoodUndoPlan,
  createOwnerGeneration,
  getMoodEmotionOptions,
  getMoodExportLabels,
  getMoodSupportOptions,
  getMoodMetadataLabels,
  isCurrentOwnerGeneration,
  MAX_MOOD_EMOTIONS,
  moodDraftFromEntry,
  parseMoodMetadata,
  toggleMoodEmotion,
  type MoodEmotion,
} from '../../lib/mood-check-in';

describe('mood check-in metadata', () => {
  it('keeps emotion and support metadata separate from legacy visible tags', () => {
    const metadata = parseMoodMetadata([
      'sleep',
      'mood-emotion:anxious',
      'mood-emotion:tired',
      'mood-support:rest',
      'work',
    ]);

    expect(metadata).toEqual({
      emotions: ['anxious', 'tired'],
      customEmotions: [],
      support: 'rest',
      visibleTags: ['sleep', 'work'],
    });
    expect(
      getMoodMetadataLabels([
        'mood-emotion:anxious',
        'mood-support:rest',
      ])
    ).toEqual(['Anxious', 'Rest']);
  });

  it('round-trips optional metadata without losing existing tags', () => {
    const draft = moodDraftFromEntry({
      emoji: '🙂',
      note: 'A calmer afternoon',
      tags: ['work', 'mood-emotion:restless', 'mood-support:connect'],
    });

    expect(composeMoodTags(draft)).toEqual([
      'work',
      'mood-emotion:restless',
      'mood-support:connect',
    ]);
  });

  it('keeps unknown reserved metadata values visible and round-trippable', () => {
    const legacyTags = [
      'mood-emotion:future-value',
      'mood-support:future-value',
      'mood-custom-emotion:',
    ];
    const draft = moodDraftFromEntry({
      emoji: '😐',
      note: null,
      tags: legacyTags,
    });

    expect(draft.visibleTags).toEqual(legacyTags);
    expect(composeMoodTags(draft)).toEqual(legacyTags);
    expect(getMoodExportLabels([...legacyTags, 'mood-emotion:neutral'])).toEqual([
      'Neutral',
      ...legacyTags,
    ]);
  });

  it('allows at most three unique emotion words and supports deselection', () => {
    let emotions: MoodEmotion[] = [];
    for (const emotion of ['anxious', 'tired', 'frustrated', 'numb'] as const) {
      emotions = toggleMoodEmotion(emotions, emotion);
    }

    expect(emotions).toHaveLength(MAX_MOOD_EMOTIONS);
    expect(emotions).toEqual(['anxious', 'tired', 'frustrated']);
    expect(toggleMoodEmotion(emotions, 'tired')).toEqual([
      'anxious',
      'frustrated',
    ]);
  });

  it('stores custom emotion words separately and enforces the shared limit', () => {
    const customEmotions = addCustomMoodEmotion([], '  Wired   but hopeful  ', 2);
    expect(customEmotions).toEqual(['Wired but hopeful']);
    expect(addCustomMoodEmotion(customEmotions, 'Another', 2)).toBe(
      customEmotions
    );

    const tags = composeMoodTags({
      emotions: ['anxious'],
      customEmotions: ['Wired but hopeful'],
      support: null,
      visibleTags: [],
    });
    expect(tags).toEqual([
      'mood-emotion:anxious',
      'mood-custom-emotion:Wired but hopeful',
    ]);
    expect(parseMoodMetadata(tags).customEmotions).toEqual([
      'Wired but hopeful',
    ]);
    expect(getMoodMetadataLabels(tags)).toEqual([
      'Anxious',
      'Wired but hopeful',
    ]);
  });

  it('offers emotion words that match positive, neutral, and lower moods', () => {
    expect(getMoodEmotionOptions('😄').map(({ label }) => label)).toContain(
      'Joyful'
    );
    expect(getMoodEmotionOptions('🙂').map(({ label }) => label)).toContain(
      'Calm'
    );
    expect(getMoodEmotionOptions('😐').map(({ label }) => label)).toContain(
      'Neutral'
    );
    expect(getMoodEmotionOptions('😞').map(({ label }) => label)).toContain(
      'Sad'
    );
    expect(getMoodEmotionOptions('😢').map(({ label }) => label)).toContain(
      'Overwhelmed'
    );
  });

  it('matches follow-up actions to the selected mood', () => {
    expect(getMoodSupportOptions('😄').map(({ label }) => label)).toEqual([
      'Savor it',
      'Share it',
      'Keep going',
      'Note what helped',
    ]);
    expect(getMoodSupportOptions('😢').map(({ label }) => label)).toEqual([
      'Steady myself',
      'Reach out',
      'Breathe',
      'Smallest next step',
    ]);
  });
});

describe('mood owner operations', () => {
  it('invalidates both prior A operations across an A to B to A transition', () => {
    const firstA = createOwnerGeneration('user_id:A');
    const ownerB = advanceOwnerGeneration(firstA, 'user_id:B');
    const secondA = advanceOwnerGeneration(ownerB, 'user_id:A');

    expect(ownerB.generation).toBe(firstA.generation + 1);
    expect(secondA.generation).toBe(ownerB.generation + 1);
    expect(isCurrentOwnerGeneration(secondA, firstA)).toBe(false);
    expect(isCurrentOwnerGeneration(secondA, secondA)).toBe(true);
    expect(advanceOwnerGeneration(secondA, 'user_id:A')).toBe(secondA);
  });

  it('restores an existing snapshot but deletes a newly inserted check-in', () => {
    const before = { id: 'mood-1', emoji: '🙂', note: 'before' };
    const after = { id: 'mood-1', emoji: '😄', note: 'after' };

    expect(createMoodUndoPlan(before, after)).toEqual({
      kind: 'restore',
      savedEntry: after,
      previousEntry: before,
      resultingEntry: before,
    });
    expect(createMoodUndoPlan(null, after)).toEqual({
      kind: 'delete',
      savedEntry: after,
      resultingEntry: null,
    });
  });
});

describe('tracker interaction contract', () => {
  const trackerSource = readFileSync(
    fileURLToPath(new URL('../../app/tracker/page.tsx', import.meta.url)),
    'utf8'
  );
  const checkInSource = readFileSync(
    fileURLToPath(
      new URL('../../components/mood/inline-mood-check-in.tsx', import.meta.url)
    ),
    'utf8'
  );

  it('removes the modal add-and-confirm flow', () => {
    expect(trackerSource).not.toContain('Add Mood');
    expect(trackerSource).not.toContain('Save Mood');
    expect(trackerSource).not.toContain('showAddMood');
  });

  it('includes immediate save, retry, and optional context states without destructive undo', () => {
    expect(checkInSource).toContain('One tap is enough.');
    expect(checkInSource).not.toContain('undoCheckIn');
    expect(checkInSource).not.toContain(".delete()");
    expect(checkInSource).toContain('Not saved');
    expect(checkInSource).toContain('Retry');
    expect(checkInSource).toContain('Add context');
    expect(checkInSource).toContain('Hide details');
    expect(checkInSource).toContain('Add details');
    expect(checkInSource).toContain('aria-controls="mood-optional-details"');
    expect(checkInSource).toContain('Add your own');
    expect(checkInSource).toContain('Type a feeling');
    expect(checkInSource).toContain('saveCheckInWithAttribution');
    expect(checkInSource).not.toContain(".update({");
    expect(checkInSource).toContain('contextRevisionRef');
    expect(checkInSource).toContain('updateContext');
    expect(checkInSource).toContain('}, true, false);');
  });

  it('keeps settled save state quiet and nests history in the trend card', () => {
    expect(checkInSource).not.toContain('Saved {savedAt');
    expect(trackerSource).toContain('Mood history');
    expect(trackerSource).not.toContain('History and sleep');
    expect(trackerSource).toContain('{mood.emoji}');
    expect(trackerSource).not.toContain('moodLabels[mood.emoji].slice(0, 1)');
  });

  it('does not apply an in-flight save or undo after the active owner changes', () => {
    expect(checkInSource).toContain('isCurrentOwnerGeneration');
    expect(checkInSource).toContain('persistenceGeneration');
    expect(checkInSource).toContain('.eq(persistenceOwner.column, persistenceOwner.value)');
    expect(trackerSource).toContain('stateMatchesOwner ? moodState.entries : []');
  });

  it('debounces context edits and flushes them before the page is hidden', () => {
    expect(checkInSource).toContain('scheduleContextDraft');
    expect(checkInSource).toContain("window.addEventListener('pagehide'");
    expect(checkInSource).toContain("document.addEventListener('visibilitychange'");
    expect(checkInSource).toContain('flushContextDraft();');
  });
});
