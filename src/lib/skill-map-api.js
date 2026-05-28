import { getContext } from './context.js';
import { listMembers } from './members.js';
import { db } from './supabase.js';
import { endorsementSourceTypeForRole, normalizeSkillName } from './skill-map-utils.js';

export const SKILL_STATUSES = {
  learning: 'Đang học',
  usable: 'Dùng được',
};

export const SEED_TAXONOMY = [
  { name: 'Coding', sort_order: 10, skills: ['JavaScript', 'React', 'API integration', 'Data modeling'] },
  { name: 'Testing', sort_order: 20, skills: ['Manual testing', 'Test cases', 'Unit tests'] },
  { name: 'Debugging', sort_order: 30, skills: ['Browser DevTools', 'Reading logs', 'Reproducing bugs'] },
  { name: 'Git', sort_order: 40, skills: ['Branching', 'Pull requests', 'Conflict resolution'] },
  { name: 'Deployment', sort_order: 50, skills: ['Vercel preview', 'Environment variables', 'Release checks'] },
  { name: 'Communication', sort_order: 60, skills: ['Asking for help', 'Documenting findings', 'Handoff notes'] },
];

export async function loadSkillMapDataset(workspaceId) {
  if (!workspaceId) throw new Error('workspaceId is required');

  const [members, groups, skills, memberSkills, endorsements] = await Promise.all([
    listMembers(workspaceId),
    selectAll('skill_groups', workspaceId, 'sort_order', true),
    selectAll('skills', workspaceId, 'name', true),
    selectAll('member_skills', workspaceId, 'updated_at', false),
    selectAll('skill_endorsements', workspaceId, 'created_at', false),
  ]);

  return { members, groups, skills, memberSkills, endorsements };
}

export async function ensureSeedTaxonomy(workspaceId) {
  const ctx = getContext();
  for (const group of SEED_TAXONOMY) {
    const savedGroup = await findOrCreateGroup({
      workspaceId,
      name: group.name,
      sortOrder: group.sort_order,
      createdBy: ctx.userId,
    });

    for (const skillName of group.skills) {
      await findOrCreateSkill({
        workspaceId,
        groupId: savedGroup.id,
        name: skillName,
        createdBy: ctx.userId,
      });
    }
  }
}

export async function findOrCreateGroup({ workspaceId, name, sortOrder = 100, createdBy }) {
  const normalizedName = normalizeSkillName(name);
  if (!normalizedName) throw new Error('Tên nhóm không hợp lệ');

  const existing = await findByNormalizedName('skill_groups', workspaceId, normalizedName);
  if (existing) return existing;

  const { data, error } = await db
    .from('skill_groups')
    .insert({
      workspace_id: workspaceId,
      name: cleanDisplayName(name),
      normalized_name: normalizedName,
      sort_order: sortOrder,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    const raced = await findByNormalizedName('skill_groups', workspaceId, normalizedName);
    if (raced) return raced;
    throw error;
  }

  return data;
}

export async function findOrCreateSkill({ workspaceId, groupId, name, createdBy }) {
  const normalizedName = normalizeSkillName(name);
  if (!normalizedName) throw new Error('Tên skill không hợp lệ');

  const existing = await findByNormalizedName('skills', workspaceId, normalizedName);
  if (existing) return existing;

  const { data, error } = await db
    .from('skills')
    .insert({
      workspace_id: workspaceId,
      group_id: groupId,
      name: cleanDisplayName(name),
      normalized_name: normalizedName,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    const raced = await findByNormalizedName('skills', workspaceId, normalizedName);
    if (raced) return raced;
    throw error;
  }

  return data;
}

export async function saveMemberSkill({ workspaceId, userId, skillId, status }) {
  const { data, error } = await db
    .from('member_skills')
    .upsert({
      workspace_id: workspaceId,
      user_id: userId,
      skill_id: skillId,
      status,
      created_by: userId,
    }, { onConflict: 'workspace_id,user_id,skill_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMemberSkillStatus({ id, workspaceId, status }) {
  const { data, error } = await db
    .from('member_skills')
    .update({ status })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMemberSkill({ id, workspaceId }) {
  const { error } = await db
    .from('member_skills')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
}

export async function endorseMemberSkill({ workspaceId, memberSkill, currentUserRole }) {
  const ctx = getContext();
  const { data, error } = await db
    .from('skill_endorsements')
    .insert({
      workspace_id: workspaceId,
      member_skill_id: memberSkill.id,
      member_user_id: memberSkill.user_id,
      skill_id: memberSkill.skill_id,
      endorser_user_id: ctx.userId,
      source_type: endorsementSourceTypeForRole(currentUserRole),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeEndorsement({ id, workspaceId }) {
  const { error } = await db
    .from('skill_endorsements')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
}

async function selectAll(table, workspaceId, orderColumn, ascending) {
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order(orderColumn, { ascending });

  if (error) throw error;
  return data || [];
}

async function findByNormalizedName(table, workspaceId, normalizedName) {
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('normalized_name', normalizedName)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function cleanDisplayName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}
