export const ACCOUNTABILITY_NUDGE_KINDS = [
  'encouragement',
  'gentle_reminder',
  'celebrate_progress',
] as const;

export const ACCOUNTABILITY_PRIORITIES = ['high', 'medium', 'low'] as const;
export const ACCOUNTABILITY_SUGGESTION_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const;

export type AccountabilityNudgeKind = (typeof ACCOUNTABILITY_NUDGE_KINDS)[number];
export type AccountabilityPriority = (typeof ACCOUNTABILITY_PRIORITIES)[number];
export type PrioritySuggestionStatus =
  (typeof ACCOUNTABILITY_SUGGESTION_STATUSES)[number];
export type AccountabilityConnectionStatus = 'invited' | 'active' | 'revoked' | 'blocked';
export type CommitmentCadence = 'daily' | 'weekly' | 'custom';

export interface AccountabilityConnection {
  id: string;
  ownerId: string;
  partnerId: string | null;
  status: AccountabilityConnectionStatus;
  acceptedAt: string | null;
  endedAt: string | null;
}

export interface SharedCommitment {
  id: string;
  connectionId: string;
  ownerId: string;
  title: string;
  cadence: CommitmentCadence;
  status: 'active' | 'completed' | 'archived';
  priority: AccountabilityPriority | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountabilityCheckIn {
  id: string;
  commitmentId: string;
  ownerId: string;
  shownUpOn: string;
  createdAt: string;
}

export interface AccountabilityCheckInNote {
  id: string;
  checkInId: string;
  ownerId: string;
  body: string;
  sharedWithPartner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountabilityComment {
  id: string;
  commitmentId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface PrioritySuggestion {
  id: string;
  commitmentId: string;
  suggestedBy: string;
  suggestedPriority: AccountabilityPriority;
  note: string | null;
  status: PrioritySuggestionStatus;
  respondedAt: string | null;
  createdAt: string;
}

export interface SelfSetReward {
  id: string;
  commitmentId: string;
  ownerId: string;
  description: string;
  earnedAt: string | null;
}

export interface AccountabilityScopeControl {
  connectionId: string;
  ownerId: string;
  sharesProgress: boolean;
  sharesCommitmentTitles: boolean;
  sharesNotes: boolean;
  updatedAt: string;
}

export interface CreateInviteResult {
  connectionId: string;
  inviteToken: string;
  expiresAt: string;
}

export interface AccountabilityOverview {
  connection: AccountabilityConnection | null;
  commitments: SharedCommitment[];
  checkIns: AccountabilityCheckIn[];
  daysShownUp: import('./progress').DaysShownUpProgress;
}
