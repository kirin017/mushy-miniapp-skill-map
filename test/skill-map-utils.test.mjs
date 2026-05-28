import assert from 'node:assert/strict';
import test from 'node:test';
import { tryGetContext } from '../src/lib/context.js';
import {
  createSkillMapMockStore,
  isSkillMapMockMode,
  MOCK_CONTEXT,
} from '../src/lib/skill-map-mock.js';
import {
  buildSkillMapIndex,
  endorsementSourceTypeForRole,
  getOnboardingSkillSuggestions,
  getProfileProgress,
  groupMemberSkills,
  normalizeSkillName,
  rankSkillMatches,
  shouldShowSkillOnboarding,
} from '../src/lib/skill-map-utils.js';

test('normalizeSkillName trims, collapses whitespace, and lowercases', () => {
  assert.equal(normalizeSkillName('  React   Query  '), 'react query');
  assert.equal(normalizeSkillName('Git'), 'git');
  assert.equal(normalizeSkillName(''), '');
});

test('rankSkillMatches prioritizes admin endorsements, then peer endorsements, then usable status', () => {
  const members = [
    { user_id: 'u1', full_name: 'Bao' },
    { user_id: 'u2', full_name: 'An' },
    { user_id: 'u3', full_name: 'Chi' },
  ];
  const skills = [{ id: 's1', name: 'Debugging', group_id: 'g1' }];
  const memberSkills = [
    { id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'learning' },
    { id: 'ms2', user_id: 'u2', skill_id: 's1', status: 'usable' },
    { id: 'ms3', user_id: 'u3', skill_id: 's1', status: 'learning' },
  ];
  const endorsements = [
    { id: 'e1', member_skill_id: 'ms1', source_type: 'peer' },
    { id: 'e2', member_skill_id: 'ms1', source_type: 'peer' },
    { id: 'e3', member_skill_id: 'ms3', source_type: 'admin' },
  ];

  const ranked = rankSkillMatches({ members, skills, memberSkills, endorsements, skillId: 's1' });

  assert.deepEqual(ranked.map((row) => row.member.user_id), ['u3', 'u1', 'u2']);
  assert.equal(ranked[0].adminEndorsements, 1);
  assert.equal(ranked[1].peerEndorsements, 2);
});

test('buildSkillMapIndex joins skills, groups, member skills, and endorsements', () => {
  const index = buildSkillMapIndex({
    groups: [{ id: 'g1', name: 'Git', sort_order: 2 }],
    skills: [{ id: 's1', group_id: 'g1', name: 'Pull requests' }],
    memberSkills: [{ id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'usable' }],
    endorsements: [{ id: 'e1', member_skill_id: 'ms1', source_type: 'peer' }],
  });

  assert.equal(index.skillsById.get('s1').group.name, 'Git');
  assert.equal(index.memberSkillsByUser.get('u1')[0].skill.name, 'Pull requests');
  assert.equal(index.endorsementsByMemberSkill.get('ms1').length, 1);
});

test('groupMemberSkills orders by group sort order and skill name', () => {
  const grouped = groupMemberSkills([
    { id: 'ms2', skill: { name: 'Conflict resolution', group: { id: 'g2', name: 'Git', sort_order: 1 } } },
    { id: 'ms1', skill: { name: 'Debugging logs', group: { id: 'g1', name: 'Debugging', sort_order: 0 } } },
  ]);

  assert.deepEqual(grouped.map((group) => group.group.name), ['Debugging', 'Git']);
  assert.deepEqual(grouped[1].items.map((item) => item.skill.name), ['Conflict resolution']);
});

test('endorsementSourceTypeForRole maps workspace admins to admin and members to peer', () => {
  assert.equal(endorsementSourceTypeForRole('owner'), 'admin');
  assert.equal(endorsementSourceTypeForRole('admin'), 'admin');
  assert.equal(endorsementSourceTypeForRole('member'), 'peer');
  assert.equal(endorsementSourceTypeForRole(undefined), 'peer');
});

test('tryGetContext returns an error instead of throwing when context is missing', () => {
  const result = tryGetContext(() => {
    throw new Error('missing context');
  });

  assert.equal(result.ctx, null);
  assert.equal(result.error.message, 'missing context');
});

test('tryGetContext returns context when getter succeeds', () => {
  const ctx = { workspaceId: 'workspace-1', userId: 'user-1' };
  const result = tryGetContext(() => ctx);

  assert.equal(result.ctx, ctx);
  assert.equal(result.error, null);
});

test('isSkillMapMockMode only enables query flag during dev', () => {
  const url = 'http://127.0.0.1:5173/?mock=1';

  assert.equal(isSkillMapMockMode(url, true), true);
  assert.equal(isSkillMapMockMode(url, false), false);
  assert.equal(isSkillMapMockMode('http://127.0.0.1:5173/', true), false);
});

test('createSkillMapMockStore mutates current user member skills in memory', () => {
  const store = createSkillMapMockStore();
  const initial = store.getDataset();
  const currentUserRows = initial.memberSkills.filter((row) => row.user_id === MOCK_CONTEXT.userId);
  assert.ok(currentUserRows.length > 0);

  const skill = store.findOrCreateSkill({
    workspaceId: MOCK_CONTEXT.workspaceId,
    groupId: initial.groups[0].id,
    name: 'React Query',
    createdBy: MOCK_CONTEXT.userId,
  });
  const row = store.addMemberSkill({
    workspaceId: MOCK_CONTEXT.workspaceId,
    userId: MOCK_CONTEXT.userId,
    skillId: skill.id,
    status: 'learning',
  });

  assert.equal(row.skill_id, skill.id);
  assert.equal(row.status, 'learning');

  const updated = store.updateMemberSkillStatus({
    id: row.id,
    workspaceId: MOCK_CONTEXT.workspaceId,
    status: 'usable',
  });
  assert.equal(updated.status, 'usable');

  store.deleteMemberSkill({ id: row.id, workspaceId: MOCK_CONTEXT.workspaceId });
  const afterDelete = store.getDataset();
  assert.equal(afterDelete.memberSkills.some((item) => item.id === row.id), false);
});

test('shouldShowSkillOnboarding only prompts editable users with no skills', () => {
  assert.equal(shouldShowSkillOnboarding({
    canEditOwnProfile: true,
    loading: false,
    mySkills: [],
  }), true);
  assert.equal(shouldShowSkillOnboarding({
    canEditOwnProfile: true,
    loading: false,
    mySkills: [{ id: 'ms1' }],
  }), false);
  assert.equal(shouldShowSkillOnboarding({
    canEditOwnProfile: false,
    loading: false,
    mySkills: [],
  }), false);
  assert.equal(shouldShowSkillOnboarding({
    canEditOwnProfile: true,
    loading: true,
    mySkills: [],
  }), false);
});

test('getOnboardingSkillSuggestions excludes current user skills and follows group order', () => {
  const groups = [
    { id: 'g2', name: 'Git', sort_order: 20 },
    { id: 'g1', name: 'Coding', sort_order: 10 },
  ];
  const skills = [
    { id: 's2', name: 'Pull requests', group_id: 'g2' },
    { id: 's1', name: 'React', group_id: 'g1' },
    { id: 's3', name: 'API integration', group_id: 'g1' },
  ];
  const memberSkills = [
    { id: 'ms1', user_id: 'u1', skill_id: 's1' },
    { id: 'ms2', user_id: 'u2', skill_id: 's2' },
  ];

  const suggestions = getOnboardingSkillSuggestions({
    groups,
    skills,
    memberSkills,
    userId: 'u1',
    limit: 3,
  });

  assert.deepEqual(suggestions.map((skill) => skill.id), ['s3', 's2']);
});

function profileProgressItem(progress, id) {
  const item = progress.items.find((candidate) => candidate.id === id);
  assert.ok(item, `Expected profile progress item "${id}" to exist`);
  return item;
}

test('getProfileProgress returns empty progress and suggestions for a new profile', () => {
  const groups = [
    { id: 'g1', name: 'Coding', sort_order: 10 },
    { id: 'g2', name: 'Testing', sort_order: 20 },
  ];
  const skills = [
    { id: 's2', name: 'Test cases', group_id: 'g2' },
    { id: 's1', name: 'React', group_id: 'g1' },
    { id: 's3', name: 'API integration', group_id: 'g1' },
  ];

  const progress = getProfileProgress({
    groups,
    skills,
    memberSkills: [],
    endorsements: [],
    userId: 'u1',
    suggestionLimit: 2,
  });

  assert.equal(progress.total, 5);
  assert.equal(progress.completed, 0);
  assert.equal(progress.complete, false);
  assert.deepEqual(progress.items.map((item) => item.done), [false, false, false, false, false]);
  assert.deepEqual(progress.suggestions.map((skill) => skill.id), ['s3', 's1']);
});

test('getProfileProgress marks skill count, group coverage, usable, learning, and received endorsement items', () => {
  const groups = [
    { id: 'g1', name: 'Coding', sort_order: 10 },
    { id: 'g2', name: 'Testing', sort_order: 20 },
    { id: 'g3', name: 'Git', sort_order: 30 },
  ];
  const skills = [
    { id: 's1', name: 'React', group_id: 'g1' },
    { id: 's2', name: 'Test cases', group_id: 'g2' },
    { id: 's3', name: 'Manual testing', group_id: 'g2' },
    { id: 's4', name: 'Pull requests', group_id: 'g3' },
  ];
  const memberSkills = [
    { id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'usable' },
    { id: 'ms2', user_id: 'u1', skill_id: 's2', status: 'learning' },
    { id: 'ms3', user_id: 'u1', skill_id: 's3', status: 'usable' },
    { id: 'ms4', user_id: 'u2', skill_id: 's4', status: 'usable' },
  ];
  const endorsements = [
    { id: 'e1', member_skill_id: 'ms1', endorser_user_id: 'u2' },
  ];

  const progress = getProfileProgress({
    groups,
    skills,
    memberSkills,
    endorsements,
    userId: 'u1',
    suggestionLimit: 4,
  });

  assert.equal(progress.completed, 5);
  assert.equal(progress.complete, true);
  assert.equal(profileProgressItem(progress, 'skill-count').done, true);
  assert.equal(profileProgressItem(progress, 'group-coverage').done, true);
  assert.equal(profileProgressItem(progress, 'usable-skill').done, true);
  assert.equal(profileProgressItem(progress, 'learning-skill').done, true);
  assert.equal(profileProgressItem(progress, 'endorsement').done, true);
  assert.deepEqual(progress.suggestions.map((skill) => skill.id), ['s4']);
});

test('getProfileProgress treats a sent endorsement as endorsement progress', () => {
  const progress = getProfileProgress({
    groups: [{ id: 'g1', name: 'Coding', sort_order: 10 }],
    skills: [{ id: 's1', name: 'React', group_id: 'g1' }],
    memberSkills: [
      { id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'usable' },
      { id: 'ms2', user_id: 'u2', skill_id: 's1', status: 'usable' },
    ],
    endorsements: [
      { id: 'e1', member_skill_id: 'ms2', endorser_user_id: 'u1' },
    ],
    userId: 'u1',
  });

  assert.equal(profileProgressItem(progress, 'endorsement').done, true);
});

test('getProfileProgress only counts member skills owned by the requested user', () => {
  const groups = [
    { id: 'g1', name: 'Coding', sort_order: 10 },
    { id: 'g2', name: 'Testing', sort_order: 20 },
    { id: 'g3', name: 'Git', sort_order: 30 },
  ];
  const skills = [
    { id: 's1', name: 'React', group_id: 'g1' },
    { id: 's2', name: 'Test cases', group_id: 'g2' },
    { id: 's3', name: 'Pull requests', group_id: 'g3' },
  ];
  const memberSkills = [
    { id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'usable' },
    { id: 'ms2', user_id: 'u2', skill_id: 's2', status: 'learning' },
    { id: 'ms3', user_id: 'u2', skill_id: 's3', status: 'learning' },
  ];

  const progress = getProfileProgress({
    groups,
    skills,
    memberSkills,
    endorsements: [],
    userId: 'u1',
  });

  assert.equal(progress.completed, 1);
  assert.equal(progress.complete, false);
  assert.equal(profileProgressItem(progress, 'skill-count').done, false);
  assert.equal(profileProgressItem(progress, 'group-coverage').done, false);
  assert.equal(profileProgressItem(progress, 'usable-skill').done, true);
  assert.equal(profileProgressItem(progress, 'learning-skill').done, false);
});

test('getProfileProgress does not count another user usable skill as usable progress', () => {
  const progress = getProfileProgress({
    groups: [{ id: 'g1', name: 'Coding', sort_order: 10 }],
    skills: [
      { id: 's1', name: 'React', group_id: 'g1' },
      { id: 's2', name: 'API integration', group_id: 'g1' },
    ],
    memberSkills: [
      { id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'learning' },
      { id: 'ms2', user_id: 'u2', skill_id: 's2', status: 'usable' },
    ],
    endorsements: [],
    userId: 'u1',
  });

  assert.equal(profileProgressItem(progress, 'usable-skill').done, false);
});

test('getProfileProgress does not count unrelated endorsements as endorsement progress', () => {
  const progress = getProfileProgress({
    groups: [{ id: 'g1', name: 'Coding', sort_order: 10 }],
    skills: [{ id: 's1', name: 'React', group_id: 'g1' }],
    memberSkills: [
      { id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'usable' },
      { id: 'ms2', user_id: 'u2', skill_id: 's1', status: 'usable' },
    ],
    endorsements: [
      { id: 'e1', member_skill_id: 'ms2', endorser_user_id: 'u3' },
    ],
    userId: 'u1',
  });

  assert.equal(profileProgressItem(progress, 'endorsement').done, false);
});
