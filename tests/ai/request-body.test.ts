import { describe, expect, it } from 'vitest';
import { readBoundedJson, RequestBodyError } from '../../lib/ai/request-body';

describe('readBoundedJson', () => {
  it('enforces actual UTF-8 byte length without a content-length header', async () => {
    const request = new Request('https://example.test', { method: 'POST', body: JSON.stringify({ value: 'éé' }) });
    await expect(readBoundedJson(request, 5)).rejects.toMatchObject({ status: 413 } satisfies Partial<RequestBodyError>);
  });

  it('rejects malformed JSON as a client error', async () => {
    const request = new Request('https://example.test', { method: 'POST', body: '{bad' });
    await expect(readBoundedJson(request, 100)).rejects.toMatchObject({ status: 400 } satisfies Partial<RequestBodyError>);
  });
});
