import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  addCustomMoodEmotion,
  composeMoodTags,
  getMoodEmotionOptions,
  getMoodMetadataLabels,
  getMoodSupportOptions,
  MAX_MOOD_EMOTIONS,
  parseMoodMetadata,
  reconcileMoodTagsForMood,
  toggleMoodEmotion,
  type MoodEmotion,
} from '../../mobile/lib/mood-check-in';

describe('mobile mood check-in metadata', () => {
  it('keeps namespaced metadata separate from legacy visible tags', () => {
    const metadata = parseMoodMetadata([
      'sleep',
      'mood-emotion:anxious',
      'mood-custom-emotion:Wired but hopeful',
      'mood-support:rest',
      'work',
    ]);

    expect(metadata).toEqual({
      emotions: ['anxious'],
      customEmotions: ['Wired but hopeful'],
      support: 'rest',
      visibleTags: ['sleep', 'work'],
    });
    expect(composeMoodTags(metadata)).toEqual([
      'sleep',
      'work',
      'mood-emotion:anxious',
      'mood-custom-emotion:Wired but hopeful',
      'mood-support:rest',
    ]);
  });

  it('preserves prior plain tags and ignores unknown namespaced values safely', () => {
    expect(
      parseMoodMetadata([
        'family',
        'mood-emotion:not-a-real-emotion',
        'mood-support:not-a-real-action',
      ])
    ).toEqual({
      emotions: [],
      customEmotions: [],
      support: null,
      visibleTags: ['family'],
    });
  });

  it('shares a three-word limit across built-in and custom emotions', () => {
    let emotions: MoodEmotion[] = ['calm', 'content'];
    const custom = addCustomMoodEmotion([], '  Wired   but hopeful  ', emotions.length);
    emotions = toggleMoodEmotion(emotions, 'relieved', custom.length);

    expect(custom).toEqual(['Wired but hopeful']);
    expect(emotions).toEqual(['calm', 'content']);
    expect(emotions.length + custom.length).toBe(MAX_MOOD_EMOTIONS);
    expect(addCustomMoodEmotion(custom, 'wired but hopeful', emotions.length)).toBe(custom);
    expect(addCustomMoodEmotion([], 'Calm')).toEqual([]);
  });

  it('balances emotion language across positive, neutral, and lower moods', () => {
    expect(getMoodEmotionOptions('\u{1F604}').map(({ label }) => label)).toEqual([
      'Joyful',
      'Energized',
      'Proud',
      'Excited',
      'Grateful',
      'Hopeful',
    ]);
    expect(getMoodEmotionOptions('\u{1F610}').map(({ label }) => label)).toEqual([
      'Steady',
      'Neutral',
      'Distracted',
      'Tired',
      'Restless',
      'Not sure',
    ]);
    expect(getMoodEmotionOptions('\u{1F622}').map(({ label }) => label)).toContain(
      'Overwhelmed'
    );
  });

  it('offers one mood-matched optional next action', () => {
    expect(getMoodSupportOptions('\u{1F604}').map(({ label }) => label)).toEqual([
      'Savor it',
      'Share it',
      'Keep going',
      'Note what helped',
    ]);
    expect(getMoodSupportOptions('\u{1F622}').map(({ label }) => label)).toEqual([
      'Steady myself',
      'Reach out',
      'Breathe',
      'Smallest next step',
    ]);
    expect(
      getMoodMetadataLabels([
        'mood-emotion:steady',
        'mood-custom-emotion:Unsure but okay',
        'mood-support:pause',
      ])
    ).toEqual(['Steady', 'Unsure but okay', 'Pause']);
  });

  it('preserves private context while removing choices that do not fit a new mood', () => {
    expect(
      reconcileMoodTagsForMood(
        [
          'sleep',
          'mood-emotion:anxious',
          'mood-custom-emotion:Mixed feelings',
          'mood-support:rest',
        ],
        '\u{1F604}'
      )
    ).toEqual(['sleep', 'mood-custom-emotion:Mixed feelings']);
  });
});

describe('mobile tracker mood parity contract', () => {
  const trackerSource = readFileSync(
    fileURLToPath(new URL('../../mobile/app/(tabs)/tracker.tsx', import.meta.url)),
    'utf8'
  );

  it('uses literal emoji choices and keeps optional details collapsed', () => {
    expect(trackerSource).toContain('<MoodPicker');
    expect(
      readFileSync(
        fileURLToPath(new URL('../../mobile/components/MoodPicker.tsx', import.meta.url)),
        'utf8'
      )
    ).toContain('{choice.emoji}');
    expect(trackerSource).toContain("'Add details'");
    expect(trackerSource).toContain("'Hide details'");
    expect(trackerSource).toContain('accessibilityState={{ expanded: detailsOpen }}');
    expect(trackerSource).toContain('setDetailsOpen(false)');
    expect(trackerSource).toContain("message: 'Check-in saved.'");
    expect(trackerSource).toContain('label="Save details"');
    expect(trackerSource).not.toContain('label="Save check-in"');
    expect(trackerSource).toContain('updateContext: true');
    expect(trackerSource).toContain('reconcileMoodTagsForMood(');
  });

  it('includes custom emotion, suggested action, and history disclosures', () => {
    expect(trackerSource).toContain('Put words to it');
    expect(trackerSource).toContain('Add your own');
    expect(trackerSource).toContain('Something that might help');
    expect(trackerSource).toContain(
      'accessibilityState={{ expanded: visibleHistoryOpen }}'
    );
  });

  it('stores metadata in existing tags and protects legacy tag rendering', () => {
    expect(trackerSource).toContain('tags: composeMoodTags({');
    expect(trackerSource).toContain('const visibleTags = parseMoodMetadata(tags).visibleTags;');
    expect(trackerSource).not.toContain('newTags');
    expect(trackerSource).not.toContain('Tags (optional)');
  });

  it('preserves dirty drafts when details collapse and locks details while saving', () => {
    expect(trackerSource).toContain(
      'if (!detailsDirty || !hasMoodCheckInDraft(draft)) return;'
    );
    expect(trackerSource).not.toContain(
      'detailsOpen && hasMoodCheckInDraft(draft)'
    );
    expect(trackerSource).toContain('editable={!saving}');
    expect(trackerSource).toContain('disabled={saving}');
  });
});

describe('mobile Today mood parity contract', () => {
  const todaySource = readFileSync(
    fileURLToPath(new URL('../../mobile/app/(tabs)/index.tsx', import.meta.url)),
    'utf8'
  );

  it('preserves existing context and links to optional details', () => {
    expect(todaySource).toContain('saveCheckInWithAttribution(expectedUserId, {');
    expect(todaySource).toMatch(
      /saveCheckInWithAttribution\(expectedUserId, \{\s*emoji: mood,\s*\.\.\.localFields/
    );
    expect(todaySource).not.toContain('todayMoodNote');
    expect(todaySource).not.toContain('todayMoodTags');
    expect(todaySource).toContain('router.push(\'/(tabs)/tracker\')');
  });
});
