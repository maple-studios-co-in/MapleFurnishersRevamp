import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KeeriConnector } from '../src/modules/three-d/connector';

const config = { baseUrl: 'https://keeri.example', token: 'private-test-integration-token', tenantId: 'tenant-a', referenceOrigins: ['https://images.example'] };
const reference = { id: 'ref-1', role: 'front' as const, geometryGroupId: 'standard', captureSetId: 'capture', variantId: null, url: 'https://images.example/front.png?scoped=1', checksum: 'a'.repeat(64), sizeBytes: 11, provenance: 'photograph' as const };

test('reference download never forwards integration credentials outside the Keeri origin', async () => {
  const requests: { url: string; authorization: string | null; redirect: RequestRedirect | undefined }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization'), redirect: init?.redirect });
    return new Response(Buffer.from('image bytes'));
  };
  const connector = new KeeriConnector(config, fakeFetch);
  assert.equal((await connector.reference(reference)).toString(), 'image bytes');
  assert.equal(requests[0].authorization, null);
  assert.equal(requests[0].redirect, 'error');
  await connector.reference({ ...reference, url: 'https://keeri.example/private/image.png' });
  assert.equal(requests[1].authorization, 'Bearer private-test-integration-token');
  await assert.rejects(connector.reference({ ...reference, url: 'https://untrusted.example/image.png' }), { statusCode: 400 });
  assert.equal(requests.length, 2, 'untrusted references must be rejected without a network request');
});
test('oversized reference downloads are refused before buffering their response body', async () => {
  const connector = new KeeriConnector(config, async () => new Response('too large', { headers: { 'Content-Length': String(50 * 1024 * 1024 + 1) } }));
  await assert.rejects(connector.reference(reference), { statusCode: 502 });
});
test('downloads reject both truncated and larger-than-approved original bytes', async () => {
  for (const body of ['short', 'this replacement is longer']) {
    const connector = new KeeriConnector(config, async () => new Response(body));
    await assert.rejects(connector.reference(reference), { statusCode: 502 });
  }
});
test('an already cancelled import does not start another reference download', async () => {
  let downloads = 0;
  const connector = new KeeriConnector(config, async () => { downloads++; return new Response('image bytes'); });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(connector.reference(reference, controller.signal));
  assert.equal(downloads, 0);
});
test('Keeri pages are tenant checked and details must still be flagged at import time', async () => {
  const connector = new KeeriConnector(config, async input => {
    const path = new URL(String(input)).pathname;
    return Response.json(path.endsWith('/chair')
      ? { schemaVersion: 1, tenantId: 'tenant-a', modelId: 'chair', name: 'Chair', code: 'CHAIR', sourceRevision: '1', readyFor3D: false, variants: [], references: [] }
      : { schemaVersion: 1, tenantId: 'tenant-b', products: [], nextCursor: null });
  });
  await assert.rejects(connector.list(), { statusCode: 400 });
  await assert.rejects(connector.detail('chair'), { statusCode: 400 });
});
