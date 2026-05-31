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

test('ProfileScreen keeps an always-available proposal skill add path', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const profileScreenStart = source.indexOf('function ProfileScreen');
  const reportScreenStart = source.indexOf('function ReportScreen');
  const profileScreenSource = source.slice(profileScreenStart, reportScreenStart);

  assert.match(profileScreenSource, /Đề xuất skill/);
  assert.match(profileScreenSource, /skillName/);
  assert.match(profileScreenSource, /customSkill/);
  assert.doesNotMatch(profileScreenSource, /disabled=\{!availableSkills\.length \|\| saving\}/);
});

test('Member surfaces use avatarUrl images instead of initials-only face fallback', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(source, /function MemberAvatar/);
  assert.match(source, /member\?\.avatarUrl/);
  assert.match(source, /<img src=\{member\.avatarUrl\}/);
  assert.doesNotMatch(source, /<span className="face">\{member\.avatar\}<\/span>/);
  assert.doesNotMatch(source, /<span className="face">\{selectedMember\.avatar\}<\/span>/);
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

  assert.match(profileScreenSource, /memberSkillIds:\s*profileSkill\.memberSkillIds/);
  assert.match(profileScreenSource, /requestRemoveSkill\(profileSkill\)/);
  assert.match(profileScreenSource, /onDeleteProfileSkill\(profileSkill\)/);
  assert.match(profileScreenSource, /pendingDeleteProfileSkill/);
});

test('App exposes pending skill review UI and pending profile section', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(source, /function PendingSkillReview/);
  assert.match(source, /pendingProfileSkills/);
  assert.match(source, /approvePendingSkill/);
  assert.match(source, /mergePendingSkill/);
  assert.match(source, /rejectPendingSkill/);
  assert.match(source, /useIsCurrentWorkspaceAdmin/);
});

test('SkillIcon does not lazy-load tiny skill assets used in scrolling UI', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const skillIconStart = source.indexOf('function SkillIcon');
  const assetFallbackStart = source.indexOf('function handleAssetFallback');
  const skillIconSource = source.slice(skillIconStart, assetFallbackStart);

  assert.match(skillIconSource, /decoding="async"/);
  assert.doesNotMatch(skillIconSource, /loading="lazy"/);
});

test('Overview renders the skill marquee before quick action cards', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const overviewStart = source.indexOf('function Overview');
  const pendingReviewStart = source.indexOf('function PendingSkillReview');
  const overviewSource = source.slice(overviewStart, pendingReviewStart);

  assert.ok(overviewSource.indexOf('className="skill-marquee"') > -1);
  assert.ok(overviewSource.indexOf('className="skill-marquee"') < overviewSource.indexOf('className="quick-grid"'));
  assert.match(overviewSource, /className="skill-marquee-track"/);
  assert.match(overviewSource, /className="skill-marquee-item"/);
});
