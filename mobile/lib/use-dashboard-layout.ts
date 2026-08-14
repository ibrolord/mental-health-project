import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  defaultDashboardLayout,
  dashboardOwnerChanged,
  normalizeDashboardLayout,
  type DashboardLayout,
} from '@/lib/dashboard-layout';
import {
  dashboardLayoutStorage,
  dashboardLayoutWriter,
} from '@/lib/dashboard-layout-storage';

export function useDashboardLayout(ownerKey: string | null) {
  const [layout, setLayout] = useState(defaultDashboardLayout);
  const [layoutOwnerKey, setLayoutOwnerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(ownerKey));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const ownerKeyRef = useRef(ownerKey);
  const requestedOwnerKeyRef = useRef<string | null>(null);
  const localMutationRef = useRef(0);
  const focusedOwnerRef = useRef<string | null>(null);
  ownerKeyRef.current = ownerKey;

  useFocusEffect(
    useCallback(() => {
      if (!ownerKey) return;
      if (focusedOwnerRef.current === ownerKey) {
        setRefreshKey((value) => value + 1);
      } else {
        focusedOwnerRef.current = ownerKey;
      }
    }, [ownerKey])
  );

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    const ownerChanged = dashboardOwnerChanged(
      requestedOwnerKeyRef.current,
      expectedOwnerKey
    );
    requestedOwnerKeyRef.current = expectedOwnerKey;
    if (ownerChanged) {
      setLayout(defaultDashboardLayout());
      setLayoutOwnerKey(null);
    }
    setError(null);
    setLoading(Boolean(expectedOwnerKey && ownerChanged));
    if (!expectedOwnerKey) {
      setLoading(false);
      return;
    }

    let active = true;
    const mutationAtReadStart = localMutationRef.current;
    void dashboardLayoutStorage
      .readLayout(expectedOwnerKey)
      .then((storedLayout) => {
        if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
        if (localMutationRef.current !== mutationAtReadStart) return;
        setLayout(storedLayout);
        setLayoutOwnerKey(expectedOwnerKey);
      })
      .catch((loadError) => {
        console.warn('Unable to restore the Today layout:', loadError);
        if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
        setLayout(defaultDashboardLayout());
        setLayoutOwnerKey(expectedOwnerKey);
        setError('Your saved layout could not be loaded. Mixed is shown for now.');
      })
      .finally(() => {
        if (active && ownerKeyRef.current === expectedOwnerKey) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ownerKey, refreshKey]);

  const updateLayout = useCallback(
    async (nextLayout: DashboardLayout) => {
      const expectedOwnerKey = ownerKey;
      if (!expectedOwnerKey || layoutOwnerKey !== expectedOwnerKey) return false;

      const normalized = normalizeDashboardLayout(nextLayout);
      localMutationRef.current += 1;
      setLayout(normalized);
      setError(null);
      const result = await dashboardLayoutWriter.writeLatest(
        expectedOwnerKey,
        normalized
      );
      if (ownerKeyRef.current !== expectedOwnerKey || !result.current) return false;
      if (result.error) {
        setError('That change could not be saved. Please try again.');
        setRefreshKey((value) => value + 1);
        return false;
      }
      return true;
    },
    [layoutOwnerKey, ownerKey]
  );

  return {
    layout: layoutOwnerKey === ownerKey ? layout : defaultDashboardLayout(),
    ready: Boolean(ownerKey && layoutOwnerKey === ownerKey && !loading),
    loading,
    error,
    updateLayout,
  };
}
