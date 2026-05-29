export const PRESET_SKILLS = [
  { id: 'react', name: 'React', icon: '⚛️', category: 'Frontend' },
  { id: 'golang', name: 'Golang', icon: 'Go', category: 'Backend' },
  { id: 'docker', name: 'Docker', icon: '▣', category: 'DevOps' },
  { id: 'ai', name: 'AI/ML', icon: 'AI', category: 'AI' },
  { id: 'devops', name: 'DevOps', icon: '∞', category: 'DevOps' },
  { id: 'testing', name: 'Testing', icon: 'QA', category: 'Quality' },
  { id: 'security', name: 'Security', icon: 'Sec', category: 'Security' },
  { id: 'postgres', name: 'PostgreSQL', icon: 'PG', category: 'Database' },
  { id: 'figma', name: 'Figma', icon: 'Fig', category: 'Design' },
  { id: 'mobile', name: 'Mobile', icon: 'App', category: 'Mobile' },
  { id: 'pm', name: 'Product', icon: 'PM', category: 'Product' },
];

const PRESET_ORDER = new Map(PRESET_SKILLS.map((skill, index) => [skill.id, index]));

export function buildPresetSkillRows({ workspaceId, userId }) {
  return PRESET_SKILLS.map((skill) => ({
    workspace_id: workspaceId,
    created_by: userId,
    name: skill.name,
    category: skill.category,
    is_preset: true,
  }));
}

export function buildMemberSkillUpsert({ workspaceId, userId, skillId, level, interest, note }) {
  return {
    workspace_id: workspaceId,
    created_by: userId,
    user_id: userId,
    skill_id: skillId,
    level: clampInteger(level, 0, 4),
    interest: clampInteger(interest, 0, 3),
    note: String(note || '').trim(),
  };
}

export function buildProfileSummary({ currentMember, profileSkills = [], skills = [] }) {
  const skillMap = new Map(skills.map((skill) => [skill.id, skill]));
  return {
    name: currentMember?.name || 'Hồ sơ của bạn',
    handle: currentMember?.handle || '@me',
    avatar: currentMember?.avatar || '?',
    avatarUrl: currentMember?.avatarUrl || null,
    skillCount: profileSkills.length,
    learningCount: profileSkills.filter((skill) => skill.level <= 2).length,
    featuredSkills: profileSkills.slice(0, 4).map((skill) => skillMap.get(skill.id)?.name || skill.id),
  };
}

export function composeSkillMapView({ currentUserId, skills = [], memberSkills = [], members = [] }) {
  const skillRows = [...skills].sort(compareSkills);
  const skillsById = new Map(skillRows.map((skill) => [skill.id, skill]));
  const skillKeyById = new Map(skillRows.map((skill) => [skill.id, skillKey(skill.name)]));
  const memberSkillRows = memberSkills.filter((row) => skillsById.has(row.skill_id));

  const membersById = new Map();
  for (const member of members) {
    const userId = member.user_id || member.userId || member.id;
    if (!userId) continue;
    membersById.set(userId, {
      id: userId,
      userId,
      name: member.full_name || member.name || 'Thanh vien',
      handle: member.handle || handleFromName(member.full_name || member.name || userId),
      avatar: initials(member.full_name || member.name || userId),
      avatarUrl: member.avatar_url || member.avatarUrl || null,
      skills: {},
      notes: {},
      interests: {},
    });
  }

  for (const row of memberSkillRows) {
    if (!membersById.has(row.user_id)) {
      membersById.set(row.user_id, {
        id: row.user_id,
        userId: row.user_id,
        name: 'Thanh vien',
        handle: handleFromName(row.user_id),
        avatar: initials(row.user_id),
        avatarUrl: null,
        skills: {},
        notes: {},
        interests: {},
      });
    }
    const key = skillKeyById.get(row.skill_id);
    const member = membersById.get(row.user_id);
    member.skills[key] = clampInteger(row.level, 0, 4);
    member.interests[key] = clampInteger(row.interest, 0, 3);
    member.notes[key] = row.note || '';
  }

  const displaySkills = skillRows.map((skill) => {
    const key = skillKey(skill.name);
    const levels = memberSkillRows
      .filter((row) => row.skill_id === skill.id)
      .map((row) => clampInteger(row.level, 0, 4));
    const strongCount = levels.filter((level) => level >= 3).length;
    const mentorCount = levels.filter((level) => level >= 4).length;
    const preset = PRESET_SKILLS.find((item) => item.id === key);
    return {
      id: key,
      skillId: skill.id,
      name: skill.name,
      icon: preset?.icon || skill.name.slice(0, 2).toUpperCase(),
      category: skill.category,
      isPreset: !!skill.is_preset,
      total: strongCount,
      risk: strongCount === 0 || mentorCount === 0 ? 1 : 0,
    };
  });

  const profileSkills = memberSkillRows
    .filter((row) => row.user_id === currentUserId)
    .sort((a, b) => compareSkills(skillsById.get(a.skill_id), skillsById.get(b.skill_id)))
    .map((row) => {
      const skill = skillsById.get(row.skill_id);
      return {
        id: skillKey(skill.name),
        rowId: row.id,
        skillId: row.skill_id,
        level: clampInteger(row.level, 0, 4),
        interest: clampInteger(row.interest, 0, 3),
        note: row.note || '',
      };
    });

  return {
    skills: displaySkills,
    members: [...membersById.values()].sort((a, b) => (
      Number(b.userId === currentUserId) - Number(a.userId === currentUserId)
      || a.name.localeCompare(b.name, 'vi')
    )),
    profileSkills,
  };
}

export async function loadSkillMapData({ db, listMembers, workspaceId, userId }) {
  let skills = await fetchSkills(db, workspaceId);
  if (skills.length === 0 && userId) {
    const rows = buildPresetSkillRows({ workspaceId, userId });
    const { error } = await db.from('skills').upsert(rows, {
      onConflict: 'workspace_id,name',
      ignoreDuplicates: false,
    });
    if (error) throw new Error('seed skills: ' + error.message);
    skills = await fetchSkills(db, workspaceId);
  }

  const skillIds = skills.map((skill) => skill.id);
  const memberSkills = skillIds.length ? await fetchMemberSkills(db, workspaceId, skillIds) : [];
  const members = await listMembers(workspaceId);
  return composeSkillMapView({ currentUserId: userId, skills, memberSkills, members });
}

export async function saveProfileSkill({ db, workspaceId, userId, skillId, level, interest, note }) {
  const row = buildMemberSkillUpsert({ workspaceId, userId, skillId, level, interest, note });
  const { data, error } = await db
    .from('member_skills')
    .upsert(row, { onConflict: 'workspace_id,user_id,skill_id' })
    .select('id,user_id,skill_id,level,interest,note')
    .single();
  if (error) throw new Error('save profile skill: ' + error.message);
  return data;
}

export async function deleteProfileSkill({ db, workspaceId, userId, skillId }) {
  const { error } = await db
    .from('member_skills')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('skill_id', skillId);
  if (error) throw new Error('delete profile skill: ' + error.message);
}

function fetchSkills(db, workspaceId) {
  return db
    .from('skills')
    .select('id,name,category,is_preset,created_at')
    .eq('workspace_id', workspaceId)
    .then(({ data, error }) => {
      if (error) throw new Error('load skills: ' + error.message);
      return data || [];
    });
}

function fetchMemberSkills(db, workspaceId, skillIds) {
  return db
    .from('member_skills')
    .select('id,user_id,skill_id,level,interest,note')
    .eq('workspace_id', workspaceId)
    .in('skill_id', skillIds)
    .then(({ data, error }) => {
      if (error) throw new Error('load member skills: ' + error.message);
      return data || [];
    });
}

function compareSkills(a, b) {
  const aKey = skillKey(a?.name);
  const bKey = skillKey(b?.name);
  const aOrder = PRESET_ORDER.has(aKey) ? PRESET_ORDER.get(aKey) : 999;
  const bOrder = PRESET_ORDER.has(bKey) ? PRESET_ORDER.get(bKey) : 999;
  return aOrder - bOrder || String(a?.name || '').localeCompare(String(b?.name || ''), 'vi');
}

function skillKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'skill';
}

function clampInteger(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function handleFromName(name) {
  const key = skillKey(name).replace(/_/g, '');
  return key ? `@${key.slice(0, 16)}` : '@member';
}
