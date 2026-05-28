import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSkillMapIndex,
  endorsementSourceTypeForRole,
  groupMemberSkills,
  normalizeSkillName,
  rankSkillMatches,
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
