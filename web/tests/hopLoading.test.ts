import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHop } from '../src/hop.ts';

test('an unavailable or malformed optional Hop asset leaves the city usable', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'), originalFetch = globalThis.fetch;
  const status = { textContent: '' }, toggle = { disabled: false };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: (id: string) => id === 'hop-status' ? status : toggle } });
  try {
    for (const response of [new Response('Missing', { status: 404 }), new Response('{"version":1,"paths":[]}')]) {
      globalThis.fetch = async () => response;
      const feature = await loadHop({ dataUrl: '/missing-hop.json' } as never);
      assert.equal(feature, undefined); assert.equal(toggle.disabled, true);
      assert.match(status.textContent, /unavailable/);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});
