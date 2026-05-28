export function normalizeSkillName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function displayNameForMember(member) {
  return member?.full_name || member?.user_id?.slice(0, 8) || 'Unknown';
}

export function endorsementSourceTypeForRole(role) {
  return role === 'owner' || role === 'admin' ? 'admin' : 'peer';
}

export function shouldShowSkillOnboarding({ canEditOwnProfile, loading, mySkills = [] }) {
  return Boolean(canEditOwnProfile) && !loading && mySkills.length === 0;
}

export function getOnboardingSkillSuggestions({
  groups = [],
  skills = [],
  memberSkills = [],
  userId,
  limit = 6,
}) {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const declaredByUser = new Set(
    memberSkills
      .filter((row) => row.user_id === userId)
      .map((row) => row.skill_id),
  );

  return skills
    .filter((skill) => !declaredByUser.has(skill.id))
    .slice()
    .sort((a, b) => {
      const aGroupOrder = groupsById.get(a.group_id)?.sort_order ?? 999;
      const bGroupOrder = groupsById.get(b.group_id)?.sort_order ?? 999;
      if (aGroupOrder !== bGroupOrder) return aGroupOrder - bGroupOrder;
      return (a.name || '').localeCompare(b.name || '', 'vi');
    })
    .slice(0, limit);
}

export function getProfileProgress({
  groups = [],
  skills = [],
  memberSkills = [],
  endorsements = [],
  userId,
  suggestionLimit = 6,
}) {
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const userMemberSkills = memberSkills.filter((row) => row.user_id === userId);
  const userMemberSkillIds = new Set(userMemberSkills.map((row) => row.id));
  const userGroupIds = new Set(
    userMemberSkills
      .map((row) => skillsById.get(row.skill_id)?.group_id)
      .filter(Boolean),
  );
  const hasEndorsement = endorsements.some((endorsement) => (
    userMemberSkillIds.has(endorsement.member_skill_id)
    || endorsement.endorser_user_id === userId
  ));

  const items = [
    {
      id: 'skill-count',
      label: 'Thêm ít nhất 3 skill',
      done: userMemberSkills.length >= 3,
    },
    {
      id: 'group-coverage',
      label: 'Có skill ở ít nhất 2 nhóm',
      done: userGroupIds.size >= 2,
    },
    {
      id: 'usable-skill',
      label: 'Có 1 skill dùng được',
      done: userMemberSkills.some((row) => row.status === 'usable'),
    },
    {
      id: 'learning-skill',
      label: 'Giữ 1 skill đang học',
      done: userMemberSkills.some((row) => row.status === 'learning'),
    },
    {
      id: 'endorsement',
      label: 'Có 1 lượt endorse',
      done: hasEndorsement,
    },
  ];
  const completed = items.filter((item) => item.done).length;

  return {
    total: items.length,
    completed,
    complete: completed === items.length,
    items,
    suggestions: getOnboardingSkillSuggestions({
      groups,
      skills,
      memberSkills,
      userId,
      limit: suggestionLimit,
    }),
  };
}

export function buildSkillMapIndex({ groups = [], skills = [], memberSkills = [], endorsements = [] }) {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const skillsById = new Map(skills.map((skill) => [
    skill.id,
    { ...skill, group: groupsById.get(skill.group_id) || null },
  ]));

  const endorsementsByMemberSkill = new Map();
  for (const endorsement of endorsements) {
    const bucket = endorsementsByMemberSkill.get(endorsement.member_skill_id) || [];
    bucket.push(endorsement);
    endorsementsByMemberSkill.set(endorsement.member_skill_id, bucket);
  }

  const memberSkillsByUser = new Map();
  for (const row of memberSkills) {
    const enriched = {
      ...row,
      skill: skillsById.get(row.skill_id) || null,
      endorsements: endorsementsByMemberSkill.get(row.id) || [],
    };
    const bucket = memberSkillsByUser.get(row.user_id) || [];
    bucket.push(enriched);
    memberSkillsByUser.set(row.user_id, bucket);
  }

  for (const bucket of memberSkillsByUser.values()) {
    bucket.sort(compareMemberSkill);
  }

  return { groupsById, skillsById, endorsementsByMemberSkill, memberSkillsByUser };
}

export function rankSkillMatches({ members = [], skills = [], memberSkills = [], endorsements = [], skillId }) {
  const membersById = new Map(members.map((member) => [member.user_id, member]));
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const endorsementsByMemberSkill = new Map();

  for (const endorsement of endorsements) {
    const bucket = endorsementsByMemberSkill.get(endorsement.member_skill_id) || [];
    bucket.push(endorsement);
    endorsementsByMemberSkill.set(endorsement.member_skill_id, bucket);
  }

  return memberSkills
    .filter((row) => row.skill_id === skillId)
    .map((row) => {
      const rowEndorsements = endorsementsByMemberSkill.get(row.id) || [];
      const adminEndorsements = rowEndorsements.filter((e) => e.source_type === 'admin').length;
      const peerEndorsements = rowEndorsements.filter((e) => e.source_type === 'peer').length;

      return {
        memberSkill: row,
        member: membersById.get(row.user_id) || { user_id: row.user_id, full_name: null },
        skill: skillsById.get(row.skill_id) || null,
        adminEndorsements,
        peerEndorsements,
        statusWeight: row.status === 'usable' ? 1 : 0,
      };
    })
    .sort((a, b) => {
      if (b.adminEndorsements !== a.adminEndorsements) return b.adminEndorsements - a.adminEndorsements;
      if (b.peerEndorsements !== a.peerEndorsements) return b.peerEndorsements - a.peerEndorsements;
      if (b.statusWeight !== a.statusWeight) return b.statusWeight - a.statusWeight;
      return displayNameForMember(a.member).localeCompare(displayNameForMember(b.member), 'vi');
    });
}

export function groupMemberSkills(items = []) {
  const groups = new Map();

  for (const item of items) {
    const group = item.skill?.group || { id: 'ungrouped', name: 'Khác', sort_order: 999 };
    const bucket = groups.get(group.id) || { group, items: [] };
    bucket.items.push(item);
    groups.set(group.id, bucket);
  }

  return Array.from(groups.values())
    .map((entry) => ({
      ...entry,
      items: entry.items.slice().sort(compareMemberSkill),
    }))
    .sort((a, b) => {
      const byOrder = (a.group.sort_order ?? 999) - (b.group.sort_order ?? 999);
      if (byOrder !== 0) return byOrder;
      return a.group.name.localeCompare(b.group.name, 'vi');
    });
}

function compareMemberSkill(a, b) {
  const aGroup = a.skill?.group?.sort_order ?? 999;
  const bGroup = b.skill?.group?.sort_order ?? 999;
  if (aGroup !== bGroup) return aGroup - bGroup;
  return (a.skill?.name || '').localeCompare(b.skill?.name || '', 'vi');
}
