import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCOPES, PRIVATE_CONTENT } from '../../lib/partner-sharing';
import {
  describeCelebration,
  type PartnerCelebration,
} from '../../lib/partner-celebrations';

const partnerPage = readFileSync(
  resolve(process.cwd(), 'app/partner/page.tsx'),
  'utf8'
);
const partnerClient = readFileSync(
  resolve(process.cwd(), 'lib/partners.ts'),
  'utf8'
);
const partnerSharing = readFileSync(
  resolve(process.cwd(), 'lib/partner-sharing.ts'),
  'utf8'
);

function celebration(
  patch: Partial<PartnerCelebration> = {}
): PartnerCelebration {
  return {
    id: 'celebration-1',
    link_id: 'link-1',
    owner_id: 'owner-1',
    partner_id: 'partner-1',
    kind: 'cheer',
    source: 'habit_streak',
    milestone_count: 7,
    reward_key: null,
    seen_at: null,
    created_at: '2026-07-28T12:00:00.000Z',
    ...patch,
  };
}

describe('accountability partner helpers', () => {
  it('defaults to counts and fixed interactions, not sensitive content', () => {
    expect(DEFAULT_SCOPES).toEqual({
      share_goals: true,
      share_habits: true,
      share_checkins: true,
      share_mood_trend: false,
      share_streaks: true,
      allow_celebrations: true,
      share_journal_activity: false,
      share_assessment_activity: false,
      share_planner_progress: false,
      share_focus_progress: false,
      share_library_activity: false,
    });
    expect(PRIVATE_CONTENT).toEqual([
      'Journal text',
      'AI conversations',
      'Assessment answers and scores',
      'Mood notes',
      'Goal text',
      'Habit names',
    ]);
  });

  it('describes streak and goal milestones without naming private items', () => {
    expect(describeCelebration(celebration())).toBe(
      'Your accountability partner cheered your 7-day streak.'
    );
    expect(
      describeCelebration(
        celebration({
          kind: 'reward',
          source: 'goal_progress',
          milestone_count: 2,
          reward_key: 'walk_together',
        })
      )
    ).toBe(
      'A walk together was offered to celebrate your 2 completed goals this week.'
    );
  });

  it('describes every permitted count as user-controlled in the partner UI', () => {
    expect(partnerPage).toContain('You choose each progress signal.');
    expect(partnerPage).toContain('Sharing sends counts only.');
    expect(partnerClient).not.toContain(
      'goals?: { completed: number; total: number }'
    );
    expect(partnerClient).not.toContain(
      'habits?: { logged_days: number; tracked: number }'
    );
    expect(partnerSharing).toContain('Today’s scheduled and completed check-ins.');
    expect(partnerSharing).toContain('Entries written this week, not their text.');
  });

  it('updates one scope at a time and serializes link privacy changes', () => {
    const updateScopeBody =
      partnerClient
        .split('export async function updateScope')[1]
        ?.split('export async function revokeLink')[0] ?? '';

    expect(updateScopeBody).toContain('{ [scopeKey]: next }');
    expect(updateScopeBody).not.toContain('.update(scopes)');
    expect(partnerPage).toContain('scopeUpdatingRef.current.has(link.id)');
    expect(partnerPage).toContain('disabled={');
  });

  it('reports failed revocation as still active and prevents duplicate requests', () => {
    expect(partnerPage).toContain('revokingRef.current.has(linkId)');
    expect(partnerPage).toContain(
      'Sharing is still active because the connection could not be ended.'
    );
    expect(partnerPage).toContain('role="alert"');
  });

  it('hides relationship state until it belongs to the current identity', () => {
    expect(partnerPage).toContain(
      'const dataMatchesIdentity = ownerId !== null && dataOwnerId === ownerId'
    );
    expect(partnerPage).toContain(
      'const visibleInvites = dataMatchesIdentity ? invites : []'
    );
    expect(partnerPage).toContain(
      'currentOwnerIdRef.current !== expectedOwnerId'
    );
  });

  it('separates successful revocation from refresh failure', () => {
    expect(partnerPage).toContain(
      'Sharing was stopped, but the latest partner list could not be refreshed.'
    );
    expect(partnerPage).toContain(
      'The invite is still active because it could not be canceled.'
    );
    expect(partnerPage).toContain('cancelingInviteRef.current.has(inviteId)');
    expect(partnerPage).toContain(
      'You stopped following this partner, but the latest partner list could not be refreshed.'
    );
  });
});
