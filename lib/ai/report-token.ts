import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type ReportableModel = 'gemini' | 'claude' | 'safety';

interface ReportTokenPayload {
  v: 1;
  rid: string;
  sub: string;
  hash: string;
  model: ReportableModel;
  iat: number;
  exp: number;
}

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function hashResponse(response: string): string {
  return createHash('sha256').update(response, 'utf8').digest('base64url');
}

export function subjectForAuth(auth: { userId?: string; sessionId?: string }): string {
  if (auth.userId) return `user:${auth.userId}`;
  if (auth.sessionId) return `session:${auth.sessionId}`;
  throw new Error('Authenticated request has no reportable subject');
}

export function hashSubject(subject: string, secret: string): string {
  return createHmac('sha256', secret).update(`subject:${subject}`).digest('base64url');
}

export function getReportSigningSecret(): string {
  const secret = process.env.AI_REPORT_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AI_REPORT_SIGNING_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

export function createReportToken(input: {
  subject: string;
  response: string;
  model: ReportableModel;
  secret: string;
  now?: number;
}): { responseId: string; reportToken: string } {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const payload: ReportTokenPayload = {
    v: 1,
    rid: randomUUID(),
    sub: input.subject,
    hash: hashResponse(input.response),
    model: input.model,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return {
    responseId: payload.rid,
    reportToken: `${encodedPayload}.${sign(encodedPayload, input.secret)}`,
  };
}

export function verifyReportToken(input: {
  token: string;
  subject: string;
  responseId: string;
  response: string;
  secret: string;
  now?: number;
}): ReportTokenPayload {
  const [encodedPayload, signature, extra] = input.token.split('.');
  if (!encodedPayload || !signature || extra) throw new Error('Invalid report token');

  const expected = Buffer.from(sign(encodedPayload, input.secret), 'utf8');
  const received = Buffer.from(signature, 'utf8');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('Invalid report token');
  }

  let payload: ReportTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as ReportTokenPayload;
  } catch {
    throw new Error('Invalid report token');
  }

  const now = input.now ?? Math.floor(Date.now() / 1000);
  const validModels: ReportableModel[] = ['gemini', 'claude', 'safety'];
  if (
    payload.v !== 1 ||
    payload.sub !== input.subject ||
    payload.rid !== input.responseId ||
    payload.hash !== hashResponse(input.response) ||
    !validModels.includes(payload.model) ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.iat > now + 30 ||
    payload.exp <= now ||
    payload.exp - payload.iat !== TOKEN_TTL_SECONDS
  ) {
    throw new Error('Invalid or expired report token');
  }

  return payload;
}
