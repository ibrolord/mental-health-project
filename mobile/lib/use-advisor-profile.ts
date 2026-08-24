import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultAdvisorProfile, type AdvisorProfile } from './advisor-profile';
import { advisorProfileStorage } from './advisor-profile-storage';

export function useAdvisorProfile(ownerKey: string | null) {
  const [profile, setProfile] = useState(defaultAdvisorProfile);
  const [profileOwnerKey, setProfileOwnerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(ownerKey));
  const [error, setError] = useState('');
  const ownerRef = useRef(ownerKey);
  ownerRef.current = ownerKey;

  useEffect(() => {
    const expectedOwner = ownerKey;
    setProfile(defaultAdvisorProfile());
    setProfileOwnerKey(null);
    setError('');
    setLoading(Boolean(expectedOwner));
    if (!expectedOwner) return;
    let active = true;
    let storageRevision = 0;
    const unsubscribe = advisorProfileStorage.subscribe(expectedOwner, (stored) => {
      if (!active || ownerRef.current !== expectedOwner) return;
      storageRevision += 1;
      setProfile(stored ?? defaultAdvisorProfile());
      setProfileOwnerKey(expectedOwner);
      setError('');
      setLoading(false);
    });
    const readRevision = storageRevision;
    void advisorProfileStorage.read(expectedOwner).then((stored) => {
      if (
        !active ||
        ownerRef.current !== expectedOwner ||
        storageRevision !== readRevision
      ) return;
      setProfile(stored);
      setProfileOwnerKey(expectedOwner);
    }).catch(() => {
      if (!active || ownerRef.current !== expectedOwner) return;
      setError('Advisor setup could not be loaded.');
    }).finally(() => {
      if (active && ownerRef.current === expectedOwner) setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [ownerKey]);

  const save = useCallback(async (next: AdvisorProfile) => {
    if (!ownerKey || profileOwnerKey !== ownerKey) return false;
    setProfile(next);
    setError('');
    try {
      const saved = await advisorProfileStorage.write(ownerKey, next);
      if (ownerRef.current !== ownerKey) return false;
      setProfile(saved);
      return true;
    } catch {
      if (ownerRef.current === ownerKey) {
        setError('Advisor setup could not be saved.');
      }
      return false;
    }
  }, [ownerKey, profileOwnerKey]);

  return {
    profile: profileOwnerKey === ownerKey ? profile : defaultAdvisorProfile(),
    ready: Boolean(ownerKey && profileOwnerKey === ownerKey && !loading),
    loading,
    error,
    save,
  };
}
