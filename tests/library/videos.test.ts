import { describe, expect, it } from 'vitest';
import { LIBRARY_TOPICS } from '../../lib/library/editorial';
import { CURATED_VIDEOS } from '../../lib/library/videos';

describe('curated motivational video catalog', () => {
  it('ships five reviewed talks for each library need', () => {
    const topics = LIBRARY_TOPICS.filter((topic) => topic !== 'All');

    expect(CURATED_VIDEOS).toHaveLength(35);
    for (const topic of topics) {
      expect(CURATED_VIDEOS.filter((video) => video.topic === topic)).toHaveLength(5);
    }
  });

  it('uses unique stable ids and official TED sources', () => {
    const ids = CURATED_VIDEOS.map(({ id }) => id);
    const urls = CURATED_VIDEOS.map(({ sourceUrl }) => sourceUrl);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(urls).size).toBe(urls.length);

    for (const video of CURATED_VIDEOS) {
      expect(video.id).toMatch(/^video-/);
      expect(video.sourceUrl).toMatch(/^https:\/\/www\.ted\.com\/talks\//);
      expect(video.sources[0]).toMatchObject({
        url: video.sourceUrl,
        sourceType: 'official-video',
      });
      expect(video.summary.length).toBeGreaterThan(80);
      expect(video.centralPremise.length).toBeGreaterThan(80);
      expect(video.practicalTakeaways).toHaveLength(2);
      expect(video.reflectionPrompts.length).toBeGreaterThanOrEqual(2);
      expect(video.medicalCaveat.length).toBeGreaterThan(60);
      expect(video.integrations.map(({ actionType }) => actionType).sort()).toEqual([
        'goal',
        'habit',
        'journal',
      ]);
    }
  });

  it('flags every trauma and grief talk before the user opens its source', () => {
    const sensitiveTopics = new Set(['Trauma', 'Grief & loss']);
    const sensitiveVideos = CURATED_VIDEOS.filter(({ topic }) => sensitiveTopics.has(topic));

    expect(sensitiveVideos).toHaveLength(10);
    expect(sensitiveVideos.every(({ contentNote }) => Boolean(contentNote?.trim()))).toBe(true);
  });

  it('links the TED correction when a talk needs later scientific context', () => {
    const happinessTalk = CURATED_VIDEOS.find(
      ({ title }) => title === 'The surprising science of happiness'
    );

    expect(happinessTalk?.sources.some(({ sourceType }) => sourceType === 'correction')).toBe(true);
  });
});
