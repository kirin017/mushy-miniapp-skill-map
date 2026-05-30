import { STANDARD_SKILLS, matchCatalogSkill } from './skill-catalog.js';

const CATALOG_DISPLAY_NAMES = new Map([
  ['frontend.react', 'React'],
]);

const CATALOG_ICONS = new Map([
  ['frontend.react', { icon: '⚛️', iconUrl: 'https://cdn.simpleicons.org/react/61DAFB' }],
  ['frontend.vue', { icon: 'V', iconUrl: 'https://cdn.simpleicons.org/vuedotjs/4FC08D' }],
  ['frontend.angular', { icon: 'A', iconUrl: 'https://cdn.simpleicons.org/angular/DD0031' }],
  ['frontend.nextjs', { icon: 'N', iconUrl: 'https://cdn.simpleicons.org/nextdotjs/000000' }],
  ['frontend.typescript', { icon: 'TS', iconUrl: 'https://cdn.simpleicons.org/typescript/3178C6' }],
  ['frontend.tailwind', { icon: 'TW', iconUrl: 'https://cdn.simpleicons.org/tailwindcss/06B6D4' }],
  ['backend.nodejs', { icon: 'JS', iconUrl: 'https://cdn.simpleicons.org/nodedotjs/5FA04E' }],
  ['backend.express', { icon: 'EX', iconUrl: 'https://cdn.simpleicons.org/express/000000' }],
  ['backend.nestjs', { icon: 'NE', iconUrl: 'https://cdn.simpleicons.org/nestjs/E0234E' }],
  ['backend.django', { icon: 'DJ', iconUrl: 'https://cdn.simpleicons.org/django/092E20' }],
  ['backend.fastapi', { icon: 'FA', iconUrl: 'https://cdn.simpleicons.org/fastapi/009688' }],
  ['backend.graphql', { icon: 'GQ', iconUrl: 'https://cdn.simpleicons.org/graphql/E10098' }],
  ['data.postgresql', { icon: 'PG', iconUrl: 'https://cdn.simpleicons.org/postgresql/4169E1' }],
  ['data.mysql', { icon: 'MY', iconUrl: 'https://cdn.simpleicons.org/mysql/4479A1' }],
  ['data.mongodb', { icon: 'MO', iconUrl: 'https://cdn.simpleicons.org/mongodb/47A248' }],
  ['data.redis', { icon: 'RE', iconUrl: 'https://cdn.simpleicons.org/redis/FF4438' }],
  ['devops.docker', { icon: '▦', iconUrl: 'https://cdn.simpleicons.org/docker/2496ED' }],
  ['devops.kubernetes', { icon: 'K8', iconUrl: 'https://cdn.simpleicons.org/kubernetes/326CE5' }],
  ['devops.aws', { icon: 'AWS', iconUrl: 'https://cdn.simpleicons.org/amazonwebservices/FF9900' }],
  ['devops.gcp', { icon: 'GCP', iconUrl: 'https://cdn.simpleicons.org/googlecloud/4285F4' }],
  ['devops.azure', { icon: 'AZ', iconUrl: 'https://cdn.simpleicons.org/microsoftazure/0078D4' }],
  ['quality.playwright', { icon: 'PW', iconUrl: 'https://cdn.simpleicons.org/playwright/2EAD33' }],
  ['design.figma', { icon: '✣', iconUrl: 'https://cdn.simpleicons.org/figma/F24E1E' }],
]);

export const PRESET_SKILLS = STANDARD_SKILLS.map((skill) => {
  const name = CATALOG_DISPLAY_NAMES.get(skill.key) || skill.name;
  const icon = CATALOG_ICONS.get(skill.key) || {};
  return {
    id: skill.key,
    name,
    icon: icon.icon || name.slice(0, 2).toUpperCase(),
    iconUrl: icon.iconUrl || null,
    iconAlt: `${name} icon`,
    category: skill.category,
  };
});

const PRESET_ORDER = new Map(PRESET_SKILLS.flatMap((skill, index) => [
  [skill.id, index],
  [skillKey(skill.name), index],
]));

export function buildCatalogSkillRows({ workspaceId, userId }) {
  return STANDARD_SKILLS.map((skill) => ({
    workspace_id: workspaceId,
    created_by: userId,
    catalog_key: skill.key,
    status: 'approved',
    skill_type: skill.skillType,
    aliases: [...(skill.aliases || [])],
    description: skill.description || '',
    source: 'catalog',
    canonical_skill_id: null,
    review_note: '',
    name: CATALOG_DISPLAY_NAMES.get(skill.key) || skill.name,
    category: skill.category,
    is_preset: true,
  }));
}

export function buildPresetSkillRows({ workspaceId, userId }) {
  return buildCatalogSkillRows({ workspaceId, userId });
}

export function buildCustomSkillUpsert({ workspaceId, userId, name, category, note }) {
  const skillName = String(name || '').trim();
  if (!skillName) throw new Error('Tên kỹ năng không được để trống');
  return {
    workspace_id: workspaceId,
    created_by: userId,
    name: skillName.slice(0, 80),
    category: String(category || 'Custom').trim().slice(0, 40) || 'Custom',
    status: 'pending',
    source: 'proposal',
    is_preset: false,
    catalog_key: null,
    skill_type: 'tool',
    aliases: [],
    canonical_skill_id: null,
    review_note: '',
    description: String(note || '').trim().slice(0, 500),
  };
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
  const skillRows = skills.filter(isApprovedSkill).sort(compareSkills);
  const nonApprovedSkillsById = new Map(skills.filter((skill) => !isApprovedSkill(skill)).map((skill) => [skill.id, skill]));
  const skillsById = new Map(skillRows.map((skill) => [skill.id, skill]));
  const skillKeyById = new Map(skillRows.map((skill) => [skill.id, skillKey(skill.name)]));
  const mergedSkillsById = new Map(skills
    .filter((skill) => skill?.status === 'merged' && skillsById.has(skill.canonical_skill_id))
    .map((skill) => [skill.id, skill]));
  const memberSkillRowsByMemberAndSkill = new Map();
  for (const row of memberSkills) {
    const directSkill = skillsById.get(row.skill_id);
    const mergedSkill = mergedSkillsById.get(row.skill_id);
    const canonicalSkillId = directSkill?.id || mergedSkill?.canonical_skill_id;
    if (!canonicalSkillId) continue;

    const resolvedRow = {
      ...row,
      skill_id: canonicalSkillId,
      sourceSkillId: row.skill_id,
      isDirectCanonical: row.skill_id === canonicalSkillId,
      memberSkillIds: row.id ? [row.id] : [],
      sourceSkillIds: [row.skill_id],
    };
    const key = `${row.user_id}\u0000${canonicalSkillId}`;
    const existing = memberSkillRowsByMemberAndSkill.get(key);
    if (!existing) {
      memberSkillRowsByMemberAndSkill.set(key, resolvedRow);
      continue;
    }

    const mergedIds = uniqueValues([...existing.memberSkillIds, ...resolvedRow.memberSkillIds]);
    const mergedSkillIds = uniqueValues([...existing.sourceSkillIds, ...resolvedRow.sourceSkillIds]);
    if (shouldPreferMemberSkillRow(resolvedRow, existing)) {
      memberSkillRowsByMemberAndSkill.set(key, {
        ...resolvedRow,
        memberSkillIds: mergedIds,
        sourceSkillIds: mergedSkillIds,
      });
    } else {
      memberSkillRowsByMemberAndSkill.set(key, {
        ...existing,
        memberSkillIds: mergedIds,
        sourceSkillIds: mergedSkillIds,
      });
    }
  }
  const memberSkillRows = [...memberSkillRowsByMemberAndSkill.values()];
  const pendingMemberSkillRows = memberSkills.filter((row) => nonApprovedSkillsById.get(row.skill_id)?.status === 'pending');

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
      pendingSkills: [],
    });
  }

  for (const row of [...memberSkillRows, ...pendingMemberSkillRows]) {
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
        pendingSkills: [],
      });
    }
  }

  for (const row of memberSkillRows) {
    const key = skillKeyById.get(row.skill_id);
    const member = membersById.get(row.user_id);
    member.skills[key] = clampInteger(row.level, 0, 4);
    member.interests[key] = clampInteger(row.interest, 0, 3);
    member.notes[key] = row.note || '';
  }

  for (const row of pendingMemberSkillRows) {
    const skill = nonApprovedSkillsById.get(row.skill_id);
    const member = membersById.get(row.user_id);
    member.pendingSkills.push({
      id: skillKey(skill.name),
      rowId: row.id,
      skillId: row.skill_id,
      name: skill.name,
      category: skill.category,
      status: skill.status,
      level: clampInteger(row.level, 0, 4),
      interest: clampInteger(row.interest, 0, 3),
      note: row.note || '',
    });
  }

  const displaySkills = skillRows.map((skill) => {
    const key = skillKey(skill.name);
    const levels = memberSkillRows
      .filter((row) => row.skill_id === skill.id)
      .map((row) => clampInteger(row.level, 0, 4));
    const strongCount = levels.filter((level) => level >= 3).length;
    const mentorCount = levels.filter((level) => level >= 4).length;
    const preset = presetForSkill(skill, key);
    return {
      id: key,
      skillId: skill.id,
      name: skill.name,
      icon: preset?.icon || skill.name.slice(0, 2).toUpperCase(),
      iconUrl: preset?.iconUrl || null,
      iconAlt: preset?.iconAlt || `${skill.name} icon`,
      category: skill.category,
      isPreset: !!skill.is_preset,
      total: strongCount,
      risk: strongCount === 0 || mentorCount === 0 ? 1 : 0,
    };
  });

  const profileSkills = [...memberSkillRows, ...pendingMemberSkillRows]
    .filter((row) => row.user_id === currentUserId)
    .sort((a, b) => compareSkills(
      skillsById.get(a.skill_id) || nonApprovedSkillsById.get(a.skill_id),
      skillsById.get(b.skill_id) || nonApprovedSkillsById.get(b.skill_id),
    ))
    .map((row) => {
      const skill = skillsById.get(row.skill_id) || nonApprovedSkillsById.get(row.skill_id);
      return {
        id: skillKey(skill.name),
        rowId: row.id,
        ...(row.memberSkillIds?.length > 1 ? { memberSkillIds: row.memberSkillIds } : {}),
        skillId: row.skill_id,
        ...(row.sourceSkillId && row.sourceSkillId !== row.skill_id ? { sourceSkillId: row.sourceSkillId } : {}),
        ...(row.sourceSkillIds?.length > 1 ? { sourceSkillIds: row.sourceSkillIds } : {}),
        level: clampInteger(row.level, 0, 4),
        interest: clampInteger(row.interest, 0, 3),
        note: row.note || '',
        status: skill.status || 'approved',
        name: skill.name,
        category: skill.category,
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
  if (userId) {
    await syncCatalogSkillRows({ db, workspaceId, userId });
  }

  let skills = await fetchSkills(db, workspaceId);
  try {
    const cleanupPlan = await cleanupLegacySkills({ db, workspaceId, skills });
    if (cleanupPlan.memberSkillMoves.length || cleanupPlan.skillUpdates.length) {
      skills = await fetchSkills(db, workspaceId);
    }
  } catch (error) {
    if (!isCatalogSyncPermissionError(error)) throw error;
  }

  const skillIds = skills.map((skill) => skill.id);
  const memberSkills = skillIds.length ? await fetchMemberSkills(db, workspaceId, skillIds) : [];
  const members = await listMembers(workspaceId);
  return composeSkillMapView({ currentUserId: userId, skills, memberSkills, members });
}

export async function saveProfileSkill({ db, workspaceId, userId, skillId, skillName, category, level, interest, note, memberSkillId, memberSkillIds }) {
  const targetMemberSkillIds = uniqueValues([...(memberSkillIds || []), memberSkillId]);
  if (targetMemberSkillIds.length) {
    const row = {
      level: clampInteger(level, 0, 4),
      interest: clampInteger(interest, 0, 3),
      note: String(note || '').trim(),
    };
    if (targetMemberSkillIds.length > 1) {
      const { data, error } = await db
        .from('member_skills')
        .update(row)
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .in('id', targetMemberSkillIds)
        .select('id,user_id,skill_id,level,interest,note');
      if (error) throw new Error('save profile skill: ' + error.message);
      return data?.[0] || null;
    }

    const { data, error } = await db
      .from('member_skills')
      .update(row)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('id', targetMemberSkillIds[0])
      .select('id,user_id,skill_id,level,interest,note')
      .single();
    if (error) throw new Error('save profile skill: ' + error.message);
    return data;
  }

  const resolvedSkillId = skillId || await createCustomSkill({ db, workspaceId, userId, skillName, category, note });
  const row = buildMemberSkillUpsert({ workspaceId, userId, skillId: resolvedSkillId, level, interest, note });
  const { data, error } = await db
    .from('member_skills')
    .upsert(row, { onConflict: 'workspace_id,user_id,skill_id' })
    .select('id,user_id,skill_id,level,interest,note')
    .single();
  if (error) throw new Error('save profile skill: ' + error.message);
  return data;
}

export async function deleteProfileSkill({ db, workspaceId, userId, skillId, memberSkillId, memberSkillIds }) {
  const targetMemberSkillIds = uniqueValues([...(memberSkillIds || []), memberSkillId]);
  let query = db
    .from('member_skills')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (targetMemberSkillIds.length > 1) {
    query = query.in('id', targetMemberSkillIds);
  } else if (targetMemberSkillIds.length === 1) {
    query = query.eq('id', targetMemberSkillIds[0]);
  } else {
    query = query.eq('skill_id', skillId);
  }

  const { error } = await query;
  if (error) throw new Error('delete profile skill: ' + error.message);
}

export function buildLegacySkillCleanupPlan({ skills = [] }) {
  const canonicalByCatalogKey = new Map(
    skills
      .filter((skill) => skill?.catalog_key && isApprovedSkill(skill))
      .map((skill) => [skill.catalog_key, skill]),
  );
  const memberSkillMoves = [];
  const skillUpdates = [];

  for (const skill of skills) {
    if (!isLegacyCleanupCandidate(skill)) continue;

    const match = matchCatalogSkill(skill.name);
    const canonical = match.status === 'matched' ? canonicalByCatalogKey.get(match.key) : null;
    if (canonical && canonical.id !== skill.id) {
      memberSkillMoves.push({ fromSkillId: skill.id, toSkillId: canonical.id });
      skillUpdates.push({
        id: skill.id,
        status: 'merged',
        canonical_skill_id: canonical.id,
        review_note: `Auto-merged by catalog alias: ${match.key}`,
      });
      continue;
    }

    skillUpdates.push({
      id: skill.id,
      status: 'pending',
      source: 'legacy',
      review_note: 'Needs workspace admin review',
    });
  }

  return { memberSkillMoves, skillUpdates };
}

export async function cleanupLegacySkills({ db, workspaceId, skills }) {
  const plan = buildLegacySkillCleanupPlan({ skills });

  for (const move of plan.memberSkillMoves) {
    const { error } = await db
      .from('member_skills')
      .update({ skill_id: move.toSkillId })
      .eq('workspace_id', workspaceId)
      .eq('skill_id', move.fromSkillId);
    if (error && !isUniqueViolation(error)) {
      throw new Error('cleanup move member skills: ' + error.message);
    }
  }

  for (const update of plan.skillUpdates) {
    const { id, ...patch } = update;
    const { error } = await db
      .from('skills')
      .update(patch)
      .eq('workspace_id', workspaceId)
      .eq('id', id);
    if (error) throw new Error('cleanup update skills: ' + error.message);
  }

  return plan;
}

export async function approvePendingSkill({ db, workspaceId, reviewerId, skillId, description = '' }) {
  const patch = {
    status: 'approved',
    source: 'proposal',
    description: String(description || '').trim().slice(0, 500),
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_note: 'Approved as workspace skill',
  };
  const { error } = await db
    .from('skills')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', skillId);
  if (error) throw new Error('approve skill: ' + error.message);
}

export async function mergePendingSkill({ db, workspaceId, reviewerId, fromSkillId, toSkillId }) {
  const move = await db
    .from('member_skills')
    .update({ skill_id: toSkillId })
    .eq('workspace_id', workspaceId)
    .eq('skill_id', fromSkillId);
  if (move.error && !isUniqueViolation(move.error)) {
    throw new Error('merge skill member rows: ' + move.error.message);
  }

  const patch = {
    status: 'merged',
    canonical_skill_id: toSkillId,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_note: `Merged into ${toSkillId}`,
  };
  const update = await db
    .from('skills')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', fromSkillId);
  if (update.error) throw new Error('merge skill: ' + update.error.message);
}

export async function rejectPendingSkill({ db, workspaceId, reviewerId, skillId, note }) {
  const patch = {
    status: 'rejected',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_note: String(note || 'Rejected by workspace admin').trim().slice(0, 500),
  };
  const { error } = await db
    .from('skills')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', skillId);
  if (error) throw new Error('reject skill: ' + error.message);
}

async function createCustomSkill({ db, workspaceId, userId, skillName, category, note }) {
  const row = buildCustomSkillUpsert({ workspaceId, userId, name: skillName, category, note });
  const { data: existingSkill, error: selectError } = await db
    .from('skills')
    .select('id,name,category,is_preset,status,canonical_skill_id,catalog_key')
    .eq('workspace_id', workspaceId)
    .eq('name', row.name)
    .maybeSingle();
  if (selectError) throw new Error('find custom skill: ' + selectError.message);

  if (existingSkill?.status === 'approved' || (existingSkill?.status === 'merged' && existingSkill.canonical_skill_id)) {
    return reusableSkillId(existingSkill);
  }

  if (existingSkill && existingSkill.status !== 'rejected') {
    const catalogSkillId = await findReusableCatalogSkillId({ db, workspaceId, name: row.name });
    if (catalogSkillId) return catalogSkillId;
    if (existingSkill.status === 'pending') return existingSkill.id;
    throw new Error(`create custom skill: existing skill "${row.name}" cannot be reused`);
  }

  const catalogSkillId = await findReusableCatalogSkillId({ db, workspaceId, name: row.name });
  if (catalogSkillId) return catalogSkillId;

  const { data, error } = await db
    .from('skills')
    .insert(row)
    .select('id,name,category,is_preset,status')
    .single();
  if (error && existingSkill?.status === 'rejected' && isUniqueViolation(error)) {
    throw new Error(`create custom skill: rejected skill name "${row.name}" is still reserved`);
  }
  if (error) throw new Error('create custom skill: ' + error.message);
  if (!data?.id) throw new Error('create custom skill: missing id');
  return data.id;
}

async function findReusableCatalogSkillId({ db, workspaceId, name }) {
  const catalogMatch = matchCatalogSkill(name);
  if (catalogMatch.status !== 'matched') return null;

  const { data: catalogSkill, error: catalogError } = await db
    .from('skills')
    .select('id,name,category,is_preset,status,canonical_skill_id,catalog_key')
    .eq('workspace_id', workspaceId)
    .eq('catalog_key', catalogMatch.key)
    .maybeSingle();
  if (catalogError) throw new Error('find catalog skill: ' + catalogError.message);
  return reusableSkillId(catalogSkill);
}

function reusableSkillId(skill) {
  if (skill?.status === 'approved' || skill?.status === 'pending') return skill.id;
  if (skill?.status === 'merged' && skill.canonical_skill_id) return skill.canonical_skill_id;
  return null;
}

function fetchSkills(db, workspaceId) {
  return db
    .from('skills')
    .select('id,name,category,is_preset,created_at,catalog_key,status,skill_type,aliases,description,source,canonical_skill_id,review_note')
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
  const aKey = a?.catalog_key || matchCatalogSkill(a?.name).key || skillKey(a?.name);
  const bKey = b?.catalog_key || matchCatalogSkill(b?.name).key || skillKey(b?.name);
  const aOrder = PRESET_ORDER.has(aKey) ? PRESET_ORDER.get(aKey) : 999;
  const bOrder = PRESET_ORDER.has(bKey) ? PRESET_ORDER.get(bKey) : 999;
  return aOrder - bOrder || String(a?.name || '').localeCompare(String(b?.name || ''), 'vi');
}

async function syncCatalogSkillRows({ db, workspaceId, userId }) {
  try {
    const rows = buildCatalogSkillRows({ workspaceId, userId });
    const { error } = await db.from('skills').upsert(rows, {
      onConflict: 'workspace_id,catalog_key',
      ignoreDuplicates: true,
    });
    if (error) {
      if (isCatalogSyncPermissionError(error)) return;
      throw error;
    }
  } catch (error) {
    if (isCatalogSyncPermissionError(error)) return;
    throw new Error(`sync catalog skills: ${error?.message || String(error)}`);
  }
}

export function isCatalogSyncPermissionError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    code === '42501'
    || message.includes('row-level security')
    || message.includes('rls')
    || message.includes('permission denied')
    || message.includes('new row violates row-level security')
  );
}

function isUniqueViolation(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return String(error?.code || '') === '23505' || message.includes('duplicate key') || message.includes('unique constraint');
}

function isApprovedSkill(skill) {
  return !skill?.status || skill.status === 'approved';
}

function isLegacyCleanupCandidate(skill) {
  return skill
    && !skill.catalog_key
    && (!skill.status || skill.status === 'approved')
    && skill.source !== 'catalog'
    && skill.source !== 'proposal';
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function shouldPreferMemberSkillRow(candidate, current) {
  const candidateLevel = clampInteger(candidate.level, 0, 4);
  const currentLevel = clampInteger(current.level, 0, 4);
  if (candidateLevel !== currentLevel) return candidateLevel > currentLevel;
  if (candidate.isDirectCanonical !== current.isDirectCanonical) return candidate.isDirectCanonical;

  const candidateInterest = clampInteger(candidate.interest, 0, 3);
  const currentInterest = clampInteger(current.interest, 0, 3);
  return candidateInterest > currentInterest;
}

function presetForSkill(skill, fallbackKey) {
  if (skill?.catalog_key) {
    return PRESET_SKILLS.find((item) => item.id === skill.catalog_key);
  }

  const match = matchCatalogSkill(skill?.name);
  if (match.status === 'matched') {
    return PRESET_SKILLS.find((item) => item.id === match.key);
  }

  return PRESET_SKILLS.find((item) => skillKey(item.name) === fallbackKey);
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
