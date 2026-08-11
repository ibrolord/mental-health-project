export type ConnectionStatus = 'pending' | 'active' | 'revoked' | 'blocked';
export type CommitmentCadence = 'daily' | 'weekly' | 'custom';

export interface AccountabilityConnection {
  id: string;
  status: ConnectionStatus;
  partnerName: string;
  partnerEmail?: string;
  inviteToken?: string;
  inviteExpiresAt?: string;
  createdAt?: string;
}

export interface SharedCommitment {
  id: string;
  connectionId: string;
  ownerId: string;
  ownerName: string;
  title: string;
  cadence: CommitmentCadence;
  note?: string | null;
  notesShared: boolean;
  isMine: boolean;
  checkedInToday: boolean;
  progressShared: boolean;
  daysShownUp: number | null;
  lastCheckInId?: string | null;
  lastCheckInNote?: string | null;
  createdAt?: string;
}

export interface CheckIn {
  id: string;
  commitmentId: string;
  checkInDate: string;
  createdAt?: string;
}

export interface DaysShownUpProgress {
  daysShownUp: number;
  windowDays: 14;
  windowStart: string;
  windowEnd: string;
}

export interface AccountabilityComment {
  id: string;
  commitmentId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface AccountabilitySuggestion {
  id: string;
  connectionId: string;
  commitmentId?: string;
  body: string;
  suggestedPriority: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
}

export interface AccountabilityReward {
  id: string;
  connectionId: string;
  commitmentId: string;
  label: string;
  earnedAt: string | null;
}

export interface ScopeControl {
  connectionId: string;
  sharesProgress: boolean;
  sharesCommitmentTitles: boolean;
  sharesNotes: boolean;
}

export interface AccountabilityNudge {
  id: string;
  connectionId: string;
  commitmentId: string | null;
  kind: 'encouragement' | 'gentle_reminder' | 'celebrate_progress';
  senderName: string;
  createdAt: string;
}
