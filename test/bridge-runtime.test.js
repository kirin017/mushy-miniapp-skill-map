import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { callNative } from '../src/lib/bridge.js';

test('callNative rejects native-only operations outside the Mushy Shell', async () => {
  await assert.rejects(
    callNative('SCAN_QR'),
    /SCAN_QR chỉ chạy trong Mushy Shell native/,
  );
  await assert.rejects(
    callNative('PICK_FILE'),
    /PICK_FILE chỉ chạy trong Mushy Shell native/,
  );
});

test('bridge runtime has no fake native response payloads', () => {
  const source = readFileSync(new URL('../src/lib/bridge.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /async function mock/);
  assert.doesNotMatch(source, /bridge:mock/);
  assert.doesNotMatch(source, /MOCK-QR-DATA/);
  assert.doesNotMatch(source, /mock:\/\//);
  assert.doesNotMatch(source, /Mock Contact/);
  assert.doesNotMatch(source, /auto-success|returning fake/);
});
