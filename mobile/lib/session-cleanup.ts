interface LocalSessionAuth {
  signOut(options: { scope: 'local' }): Promise<{ error: unknown }>;
  getSession(): Promise<{
    data: { session: unknown | null };
    error: unknown;
  }>;
}

export async function runDeletedAccountLocalCleanup(
  operations: Promise<unknown>[],
  onCleanupError: (error: unknown) => void = () => {}
): Promise<boolean> {
  const results = await Promise.allSettled(operations);
  let complete = true;
  for (const result of results) {
    if (result.status === 'rejected') {
      complete = false;
      onCleanupError(result.reason);
    }
  }
  return complete;
}

export async function clearDeletedAccountSession(
  auth: LocalSessionAuth,
  clearPersistedSession: () => Promise<void>,
  onCleanupError: (error: unknown) => void = () => {}
): Promise<boolean> {
  const tryLocalSignOut = async (): Promise<unknown | null> => {
    try {
      const { error } = await auth.signOut({ scope: 'local' });
      return error;
    } catch (error) {
      return error;
    }
  };

  let signOutError = await tryLocalSignOut();
  if (signOutError) {
    try {
      await clearPersistedSession();
    } catch (error) {
      onCleanupError(error);
    }
    signOutError = await tryLocalSignOut();
  }

  try {
    const { data, error } = await auth.getSession();
    return !signOutError && !error && !data.session;
  } catch {
    return false;
  }
}
