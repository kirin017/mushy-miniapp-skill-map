import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ProfileScreen uses ProfileAvatar instead of initials-only profile-face fallback', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const profileScreenStart = source.indexOf('function ProfileScreen');
  const reportScreenStart = source.indexOf('function ReportScreen');
  const profileScreenSource = source.slice(profileScreenStart, reportScreenStart);

  assert.match(profileScreenSource, /<ProfileAvatar summary=\{profileSummary\}/);
  assert.doesNotMatch(profileScreenSource, /currentMember\?\.avatar \|\| '\?'/);
});
