import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, unauthorizedResponse, verifyAuth } from '@/lib/api/auth';
import { OWNED_DATA_SOURCES } from '@/lib/data/owned-data-inventory';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid || !auth.userId) return unauthorizedResponse();
    if (auth.isAnonymous !== true) {
      return NextResponse.json(
        { error: 'The current session is not an anonymous profile.' },
        { status: 409, headers: corsHeaders() }
      );
    }

    const results = await Promise.all(
      OWNED_DATA_SOURCES.filter(({ blocksAccountSwitch }) =>
        blocksAccountSwitch
      ).map(({ table, ownerColumns }) => {
        let query = supabaseAdmin.from(table).select(ownerColumns[0]);
        if (ownerColumns.length === 1) {
          query = query.eq(ownerColumns[0], auth.userId!);
        } else {
          query = query.or(
            ownerColumns.map((column) => `${column}.eq.${auth.userId}`).join(',')
          );
        }
        return query.limit(1);
      })
    );

    if (results.some(({ error }) => error)) {
      console.error(
        'Anonymous profile inventory check failed:',
        results.find(({ error }) => error)?.error
      );
      return NextResponse.json(
        { error: 'Saved activity could not be checked safely.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { hasOwnedData: results.some(({ data }) => (data?.length ?? 0) > 0) },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Anonymous profile inventory API error:', error);
    return NextResponse.json(
      { error: 'Saved activity could not be checked safely.' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
