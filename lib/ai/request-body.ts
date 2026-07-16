export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (!Number.isFinite(declaredLength) || declaredLength > maxBytes) {
    throw new RequestBodyError('Request body is too large', 413);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > maxBytes) {
    throw new RequestBodyError('Request body is too large', 413);
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new RequestBodyError('Request body must be valid JSON', 400);
  }
}

export class RequestBodyError extends Error {
  constructor(message: string, public readonly status: 400 | 413) {
    super(message);
  }
}
