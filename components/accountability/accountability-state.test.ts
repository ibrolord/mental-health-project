import { describe, expect, it } from 'vitest';

import {
  NUDGE_TEMPLATES,
  buildNudgeRequest,
  canManageCommitment,
  formatAccountabilityDate,
  getAccessState,
  getDaysShownUpLabel,
  getNextTab,
  sanitizeCheckIn,
} from './accountability-state';

describe('accountability state guards', () => {
  it('keeps auth loading ahead of every other access state', () => {
    expect(getAccessState({ loading: true, userPresent: false, isAnonymous: true })).toBe(
      'loading'
    );
  });

  it('requires a signed-in user', () => {
    expect(getAccessState({ loading: false, userPresent: false, isAnonymous: false })).toBe(
      'signed-out'
    );
  });

  it('blocks anonymous profiles from Together', () => {
    expect(getAccessState({ loading: false, userPresent: true, isAnonymous: true })).toBe(
      'anonymous'
    );
  });

  it('allows a permanent authenticated profile', () => {
    expect(getAccessState({ loading: false, userPresent: true, isAnonymous: false })).toBe(
      'ready'
    );
  });

  it('allows only the owner to manage a shared commitment', () => {
    expect(canManageCommitment('owner-id', 'owner-id')).toBe(true);
    expect(canManageCommitment('partner-id', 'owner-id')).toBe(false);
  });
});

describe('accountability payload boundaries', () => {
  it('allowlists check-in fields independently from wellbeing data', () => {
    expect(
      sanitizeCheckIn({
        commitmentId: 'commitment-1',
        note: 'I made a small start.',
        date: '2026-08-11',
        shareNote: true,
        mood: 'low',
        assessment: { score: 12 },
        chat: 'private',
        reflection: 'private',
      })
    ).toEqual({
      commitmentId: 'commitment-1',
      note: 'I made a small start.',
      date: '2026-08-11',
      shareNote: true,
    });
  });

  it('accepts only a fixed nudge template id', () => {
    expect(buildNudgeRequest(NUDGE_TEMPLATES[0].id)).toEqual({
      templateId: NUDGE_TEMPLATES[0].id,
    });
    expect(() => buildNudgeRequest('write-anything')).toThrow('Choose a supported nudge');
  });
});

describe('accountability interaction helpers', () => {
  it('supports the horizontal tab keyboard order', () => {
    expect(getNextTab('mine', 'ArrowRight')).toBe('theirs');
    expect(getNextTab('theirs', 'ArrowLeft')).toBe('mine');
    expect(getNextTab('theirs', 'Home')).toBe('mine');
    expect(getNextTab('mine', 'End')).toBe('theirs');
  });

  it('leaves the active tab unchanged for unrelated keys', () => {
    expect(getNextTab('mine', 'Tab')).toBe('mine');
  });

  it('uses non-punitive 14-day wording', () => {
    expect(getDaysShownUpLabel(0)).toBe('0 of 14 days shown up');
    expect(getDaysShownUpLabel(9)).toBe('9 of 14 days shown up');
  });

  it('renders date-only check-ins without a UTC day shift', () => {
    expect(formatAccountabilityDate('2026-08-11', 'en-CA')).toBe('Aug 11');
  });
});
