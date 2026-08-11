import { NextResponse } from 'next/server';

import { RequestBodyError, readBoundedJson } from '@/lib/ai/request-body';
import { AccountabilityValidationError } from './domain';
import { AccountabilityAuthError, requireAccountabilityContext } from './auth';

export class AccountabilityServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function accountabilityJson(request: Request): Promise<Record<string, unknown>> {
  const value = await readBoundedJson(request, 16_384);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AccountabilityServiceError('JSON object required', 400);
  }
  return value as Record<string, unknown>;
}

export async function accountabilityRoute(
  request: Request,
  action: (context: Awaited<ReturnType<typeof requireAccountabilityContext>>) => Promise<unknown>
): Promise<NextResponse> {
  try {
    const data = await action(await requireAccountabilityContext(request));
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AccountabilityAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AccountabilityServiceError || error instanceof AccountabilityValidationError || error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Together could not complete that action.' }, { status: 500 });
  }
}

export function mapDatabaseError(error: { code?: string; message: string }): never {
  const statusByCode: Record<string, number> = {
    '22023': 400,
    '23505': 409,
    '42501': 403,
    P0001: 429,
    P0002: 404,
  };
  const status = statusByCode[error.code ?? ''] ?? 500;
  throw new AccountabilityServiceError(
    status === 500 ? 'Together could not complete that action.' : error.message,
    status
  );
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AccountabilityServiceError(`${field} is required`, 400);
  }
  return value;
}
