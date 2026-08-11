import type {
  AccountabilityPriority,
  SharedCommitment as DomainSharedCommitment,
} from '@/lib/accountability';

export interface AccountabilityPerson {
  id: string;
  displayName: string;
}

export interface AccountabilityInvite {
  id: string;
  token: string;
  expiresAt: string;
  partnerEmail?: string;
}

export interface AccountabilityConnection {
  id: string | null;
  status: 'disconnected' | 'invite_pending' | 'connected';
  partner: AccountabilityPerson | null;
  invite: AccountabilityInvite | null;
}

export interface AccountabilityComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SharedCommitment
  extends Pick<DomainSharedCommitment, 'id' | 'ownerId' | 'title'> {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  detail: string | null;
  noteShared: boolean;
  cadence: string;
  status: 'active' | 'completed';
  progressShared: boolean;
  daysShownUp: number | null;
  lastCheckInAt: string | null;
  lastCheckInId: string | null;
  lastCheckInNote: string | null;
  reward: string | null;
  comments: AccountabilityComment[];
}

export interface ShareableCommitment {
  id: string;
  title: string;
  cadence: string;
}

export interface PrioritySuggestion {
  id: string;
  commitmentId: string;
  commitmentTitle: string;
  suggestedPriority: AccountabilityPriority;
  suggestedBy: AccountabilityPerson;
  createdAt: string;
}

export interface AccountabilityOverview {
  viewerId: string;
  connection: AccountabilityConnection;
  availableToShare: ShareableCommitment[];
  mine: SharedCommitment[];
  theirs: SharedCommitment[];
  suggestions: PrioritySuggestion[];
  receivedNudges: AccountabilityNudge[];
  scope: AccountabilityScope | null;
  nudgeCooldownUntil: string | null;
}

export interface AccountabilityNudge {
  id: string;
  connectionId: string;
  commitmentId: string | null;
  kind: 'encouragement' | 'gentle_reminder' | 'celebrate_progress';
  senderName: string;
  createdAt: string;
}

export interface AccountabilityScope {
  connectionId: string;
  sharesProgress: boolean;
  sharesCommitmentTitles: boolean;
  sharesNotes: boolean;
}

export interface JoinInvitePreview {
  token: string;
  inviterName: string;
  expiresAt: string;
  status: 'available' | 'expired' | 'used' | 'revoked';
}
