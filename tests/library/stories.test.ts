import { describe, expect, it } from 'vitest';
import { CURATED_STORIES } from '../../lib/library/stories';

describe('famous true-life story catalog', () => {
  it('covers every library need with two substantial in-app profiles', () => {
    const counts = new Map<string, number>();
    for (const story of CURATED_STORIES) {
      counts.set(story.topic, (counts.get(story.topic) ?? 0) + 1);
    }

    expect(CURATED_STORIES).toHaveLength(14);
    expect([...counts.values()]).toEqual([2, 2, 2, 2, 2, 2, 2]);

    for (const story of CURATED_STORIES) {
      expect(story.sourceFormat).toBe('In-app profile');
      expect(story.storySections.length).toBeGreaterThanOrEqual(3);
      expect(story.timeline.length).toBeGreaterThanOrEqual(4);
      expect(
        story.storySections.reduce((words, section) => {
          return words + section.body.trim().split(/\s+/).length;
        }, 0)
      ).toBeGreaterThanOrEqual(200);
    }
  });

  it('includes globally recognizable African figures and authoritative sources', () => {
    const africanStories = CURATED_STORIES.filter((story) =>
      ['Ghana', 'Kenya', 'South Africa'].some(
        (location) => story.location.includes(location)
      )
    );

    expect(africanStories.map(({ creator }) => creator).sort()).toEqual([
      'Desmond Tutu',
      'Maya Angelou',
      'Nelson Mandela',
      'Wangari Maathai',
    ]);

    const recognizableFigures = new Set([
      'Simone Biles',
      'Naomi Osaka',
      'Selena Gomez',
      'Michael Phelps',
      'Wangari Maathai',
      'Nelson Mandela',
      'Arianna Huffington',
      'Oprah Winfrey',
      'Malala Yousafzai',
      'Maya Angelou',
      'Sheryl Sandberg',
      'Andrew Garfield',
      'Lady Gaga',
      'Desmond Tutu',
    ]);

    for (const story of CURATED_STORIES) {
      expect(recognizableFigures.has(story.creator)).toBe(true);
      expect(story.sourceUrl).toMatch(/^https:\/\//);
      expect(story.sources.length).toBeGreaterThanOrEqual(1);
      expect(story.sources[0].url).toBe(story.sourceUrl);
      expect(story.sources.every(({ url }) => url.startsWith('https://'))).toBe(true);
      expect(story.editorialNote).toContain('original MHtoolkit profile');
      expect(story.practicalTakeaways.length).toBeGreaterThanOrEqual(2);
      expect(story.integrations.map(({ actionType }) => actionType).sort()).toEqual([
        'goal',
        'habit',
        'journal',
      ]);
    }
  });

  it('adds content notes to stories involving acute or traumatic material', () => {
    const sensitiveIds = [
      'story-michael-phelps-beyond-medals',
      'story-malala-yousafzai-voice',
      'story-maya-angelou-finding-voice',
      'story-sheryl-sandberg-option-b',
      'story-andrew-garfield-grief-love',
      'story-lady-gaga-support-network',
    ];

    for (const id of sensitiveIds) {
      expect(CURATED_STORIES.find((story) => story.id === id)?.contentNote).toBeTruthy();
    }
  });
});
