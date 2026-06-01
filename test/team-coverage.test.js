import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COVERAGE_STATUS_PRIORITY,
  deriveSkillCoverage,
  deriveTeamCoverage,
} from '../src/lib/app/team-coverage.js';

const skills = [
  { id: 'react', name: 'React', category: 'Frontend', icon: 'R' },
  { id: 'docker', name: 'Docker', category: 'DevOps/Cloud', icon: 'D' },
  { id: 'rag', name: 'RAG', category: 'AI/ML', icon: 'RAG' },
  { id: 'security', name: 'Security', category: 'Security', icon: 'SEC' },
];

const members = [
  {
    id: 'u-1',
    userId: 'u-1',
    name: 'An Nguyen',
    handle: '@an',
    avatar: 'AN',
    skills: { react: 4, docker: 3, rag: 1 },
    interests: { react: 2, docker: 2, rag: 3 },
  },
  {
    id: 'u-2',
    userId: 'u-2',
    name: 'Binh Tran',
    handle: '@binh',
    avatar: 'BT',
    skills: { react: 2, docker: 0, rag: 2 },
    interests: { react: 3, docker: 1, rag: 3 },
  },
  {
    id: 'u-3',
    userId: 'u-3',
    name: 'Chi Le',
    handle: '@chi',
    avatar: 'CL',
    skills: { react: 3, docker: 1, security: 0 },
    interests: { react: 1, docker: 1, security: 0 },
  },
];

test('deriveSkillCoverage marks primary plus backup as healthy', () => {
  const row = deriveSkillCoverage({ skill: skills[0], members });

  assert.equal(row.status, 'healthy');
  assert.equal(row.action, 'Duy trì coverage');
  assert.equal(row.primary.name, 'An Nguyen');
  assert.deepEqual(row.mentors.map((member) => member.name), ['An Nguyen']);
  assert.deepEqual(row.backups.map((member) => member.name), ['Chi Le', 'Binh Tran']);
});

test('deriveSkillCoverage marks one primary and no backup as thin', () => {
  const row = deriveSkillCoverage({ skill: skills[1], members });

  assert.equal(row.status, 'thin');
  assert.equal(row.action, 'Thêm backup');
  assert.equal(row.primary.name, 'An Nguyen');
  assert.deepEqual(row.backups, []);
});

test('deriveSkillCoverage marks interested low-level members as growing', () => {
  const row = deriveSkillCoverage({ skill: skills[2], members });

  assert.equal(row.status, 'growing');
  assert.equal(row.action, 'Ghép trainee với mentor');
  assert.equal(row.primary, null);
  assert.deepEqual(row.trainees.map((member) => member.name), ['Binh Tran', 'An Nguyen']);
});

test('deriveSkillCoverage marks no primary and no trainee as missing', () => {
  const row = deriveSkillCoverage({ skill: skills[3], members });

  assert.equal(row.status, 'missing');
  assert.equal(row.action, 'Cần primary owner');
  assert.equal(row.primary, null);
  assert.deepEqual(row.trainees, []);
});

test('deriveTeamCoverage summarizes categories and orders actions by severity', () => {
  const coverage = deriveTeamCoverage({ skills, members });

  assert.deepEqual(COVERAGE_STATUS_PRIORITY, ['missing', 'thin', 'growing', 'healthy']);
  assert.deepEqual(coverage.actions.map((row) => row.status), ['missing', 'thin', 'growing']);
  assert.deepEqual(coverage.statusCounts, {
    healthy: 1,
    thin: 1,
    missing: 1,
    growing: 1,
  });

  const frontend = coverage.groups.find((group) => group.category === 'Frontend');
  assert.equal(frontend.skillCount, 1);
  assert.equal(frontend.healthyCount, 1);
});

test('deriveTeamCoverage filters by skill, category, and related member names', () => {
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, query: 'cloud' }).allRows.map((row) => row.skill.name),
    ['Docker'],
  );
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, query: 'Binh' }).allRows.map((row) => row.skill.name),
    ['React', 'RAG'],
  );
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, query: 'security' }).allRows.map((row) => row.skill.name),
    ['Security'],
  );
});

test('deriveTeamCoverage mode filters visible rows', () => {
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, mode: 'needs' }).allRows.map((row) => row.skill.name),
    ['Security', 'Docker'],
  );
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, mode: 'growth' }).allRows.map((row) => row.skill.name),
    ['RAG'],
  );
});
