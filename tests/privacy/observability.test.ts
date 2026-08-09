import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  webRpc: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { rpc: mocks.webRpc },
}));

import {
  WEB_OPERATIONAL_EVENT_TYPES,
  recordOperationalEvent as recordWebOperationalEvent,
  type WebOperationalEventType,
} from '../../lib/observability';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read(
  'supabase/migrations/20260808234500_add_privacy_safe_operational_events.sql'
);

describe('privacy-safe operational observability', () => {
  beforeEach(() => {
    mocks.webRpc.mockReset().mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores only owner scope, fixed taxonomy, source, and server time', () => {
    const table = migration.slice(
      migration.indexOf('CREATE TABLE public.operational_events'),
      migration.indexOf('CREATE INDEX operational_events_user_occurred_idx')
    );

    expect(table).toContain('user_id UUID NOT NULL');
    expect(table).toContain('event_type TEXT NOT NULL');
    expect(table).toContain('source TEXT NOT NULL');
    expect(table).toContain('occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    expect(table).toContain("source IN ('web', 'ios')");
    expect(table).not.toMatch(/\bJSONB\b/i);
    expect(table).not.toMatch(
      /\b(metadata|payload|message|stack|device|email|route_url|record_id)\b/i
    );
    expect(table).not.toMatch(/\b(android|crisis|grounding)\b/i);
    expect(table).not.toMatch(/^\s*id\s+/m);
  });

  it('uses auth.uid through a narrowly granted two-input RPC', () => {
    const rpc = migration.slice(
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION public.record_operational_event'
      ),
      migration.indexOf('-- Keep clear-data deletion transactional')
    );

    expect(rpc).toContain('p_event_type TEXT');
    expect(rpc).toContain('p_source TEXT');
    expect(rpc).toContain('v_user_id UUID := auth.uid()');
    expect(rpc).toContain('SECURITY DEFINER');
    expect(rpc).toContain("SET search_path = ''");
    expect(rpc).toContain('FROM PUBLIC, anon, authenticated, service_role');
    expect(rpc).toContain('TO authenticated');
    expect(rpc).not.toMatch(/JSONB|p_user_id|p_metadata/i);
    expect(migration).toContain(
      'GRANT SELECT ON TABLE public.operational_events TO authenticated, service_role'
    );
    expect(migration).not.toMatch(
      /GRANT (?:[^;]*INSERT[^;]*) ON TABLE public\.operational_events TO authenticated/
    );
  });

  it('keeps client taxonomies fixed and excludes sensitive feature usage', () => {
    const mobileClient = read('mobile/lib/observability.ts');
    expect(WEB_OPERATIONAL_EVENT_TYPES).toEqual(
      expect.arrayContaining(['route_error', 'global_error'])
    );
    expect(mobileClient).toContain("'render_error'");
    expect(mobileClient).toContain("Platform.OS !== 'ios'");
    expect(mobileClient).toContain("p_source: 'ios'");

    for (const eventType of WEB_OPERATIONAL_EVENT_TYPES) {
      expect(eventType).not.toMatch(/crisis|ground/i);
    }
    expect(mobileClient).not.toMatch(/['"](?:crisis|grounding)[^'"]*['"]/i);
  });

  it('sends web events without a metadata argument', async () => {
    await recordWebOperationalEvent('route_error');

    expect(mocks.webRpc).toHaveBeenCalledWith('record_operational_event', {
      p_event_type: 'route_error',
      p_source: 'web',
    });
  });

  it('drops runtime-invalid web names', async () => {
    await recordWebOperationalEvent(
      'custom_event' as WebOperationalEventType
    );

    expect(mocks.webRpc).not.toHaveBeenCalled();
  });

  it('never lets telemetry failure escape into recovery UI', async () => {
    mocks.webRpc.mockRejectedValueOnce(new Error('unavailable'));

    await expect(
      recordWebOperationalEvent('global_error')
    ).resolves.toBeUndefined();
  });

  it('does not initialize Supabase while an error boundary module loads', () => {
    const client = read('lib/observability.ts');

    expect(client).not.toMatch(/^import .*supabase\/client/m);
    expect(client).toContain(
      "await import('@/lib/supabase/client')"
    );
  });

  it('records only fixed boundary names and never forwards exception details', () => {
    const routeBoundary = read('app/error.tsx');
    const globalBoundary = read('app/global-error.tsx');
    const mobileBoundary = read('mobile/components/ErrorBoundary.tsx');

    expect(routeBoundary).toContain("recordOperationalEvent('route_error')");
    expect(globalBoundary).toContain("recordOperationalEvent('global_error')");
    expect(mobileBoundary).toContain("recordOperationalEvent('render_error')");
    expect(mobileBoundary).not.toContain('console.error');
    expect(mobileBoundary).not.toContain('componentStack');
    expect(mobileBoundary).not.toContain('error.message');
  });

  it('includes operational rows in export, deletion, and owner inventories', () => {
    expect(read('app/api/data/export/route.ts')).toContain(
      "operational_events: requireQuery("
    );
    expect(migration).toContain(
      'DELETE FROM public.operational_events WHERE user_id = p_user_id'
    );
    expect(read('lib/data/user-data-registry.ts')).toContain(
      'operational_events: { owner:'
    );
    expect(read('lib/data/owned-data-inventory.ts')).toContain(
      "ownedByUser('operational_events', false)"
    );
  });
});
