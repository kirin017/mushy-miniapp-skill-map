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

test('ProfileScreen keeps an always-available custom skill add path', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const profileScreenStart = source.indexOf('function ProfileScreen');
  const reportScreenStart = source.indexOf('function ReportScreen');
  const profileScreenSource = source.slice(profileScreenStart, reportScreenStart);

  assert.match(profileScreenSource, /Skill mới/);
  assert.match(profileScreenSource, /skillName/);
  assert.match(profileScreenSource, /customSkill/);
  assert.doesNotMatch(profileScreenSource, /disabled=\{!availableSkills\.length \|\| saving\}/);
});

test('ProfileScreen renders pending profile skills missing from the approved catalog', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const profileScreenStart = source.indexOf('function ProfileScreen');
  const reportScreenStart = source.indexOf('function ReportScreen');
  const profileScreenSource = source.slice(profileScreenStart, reportScreenStart);

  assert.doesNotMatch(profileScreenSource, /if\s*\(!skill\)\s*return null/);
  assert.match(profileScreenSource, /Đang chờ duyệt/);
});

test('ProfileScreen sends persisted member skill row ids for profile edit and delete actions', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const profileScreenStart = source.indexOf('function ProfileScreen');
  const reportScreenStart = source.indexOf('function ReportScreen');
  const profileScreenSource = source.slice(profileScreenStart, reportScreenStart);

  assert.match(profileScreenSource, /memberSkillId:\s*profileSkill\.rowId/);
  assert.match(profileScreenSource, /requestRemoveSkill\(profileSkill\)/);
  assert.match(profileScreenSource, /onDeleteProfileSkill\(profileSkill\)/);
  assert.match(profileScreenSource, /pendingDeleteProfileSkill/);
});
