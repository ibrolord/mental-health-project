export const ANONYMOUS_PROFILE_DATA_CONFLICT =
  'anonymous_profile_data_conflict';

type AuthFlowError = Error & {
  code?: string;
  anonymousUserId?: string;
};

export function anonymousProfileDataConflict(
  anonymousUserId: string
): AuthFlowError {
  const error = new Error(
    'This anonymous profile has saved activity. Choose whether to keep or delete it before signing in to a different account.'
  ) as AuthFlowError;
  error.code = ANONYMOUS_PROFILE_DATA_CONFLICT;
  error.anonymousUserId = anonymousUserId;
  return error;
}

export function getAnonymousProfileDataConflictUserId(
  error: unknown
): string | null {
  if (!(error instanceof Error)) return null;
  const authError = error as AuthFlowError;
  return authError.code === ANONYMOUS_PROFILE_DATA_CONFLICT &&
    typeof authError.anonymousUserId === 'string' &&
    authError.anonymousUserId.length > 0
    ? authError.anonymousUserId
    : null;
}

export function isAnonymousProfileDataConflict(error: unknown): boolean {
  return getAnonymousProfileDataConflictUserId(error) !== null;
}

interface AnonymousUserIdentity {
  id: string;
  is_anonymous?: boolean;
}

interface DiscardAnonymousProfileOptions {
  expectedAnonymousUserId: string;
  currentUser: AnonymousUserIdentity | null | undefined;
  prepareLocalCleanup: () => Promise<boolean>;
  deleteRemoteData: () => Promise<{ deleted?: boolean; error?: string }>;
  finalizeAfterDelete?: () => Promise<void>;
  onFinalizeError?: (error: unknown) => void;
  localCleanupError: string;
}

/** Keeps cleanup failures from turning a confirmed deletion into a dead end. */
export async function discardAnonymousProfileSafely({
  expectedAnonymousUserId,
  currentUser,
  prepareLocalCleanup,
  deleteRemoteData,
  finalizeAfterDelete,
  onFinalizeError = () => {},
  localCleanupError,
}: DiscardAnonymousProfileOptions): Promise<void> {
  if (
    !currentUser?.is_anonymous ||
    currentUser.id !== expectedAnonymousUserId
  ) {
    throw new Error(
      'The anonymous profile changed before deletion. No data was deleted.'
    );
  }

  if (!(await prepareLocalCleanup())) {
    throw new Error(localCleanupError);
  }

  const result = await deleteRemoteData();
  if (result.deleted !== true) {
    throw new Error(result.error || 'Anonymous data could not be deleted.');
  }

  if (finalizeAfterDelete) {
    try {
      await finalizeAfterDelete();
    } catch (error) {
      onFinalizeError(error);
    }
  }
}
