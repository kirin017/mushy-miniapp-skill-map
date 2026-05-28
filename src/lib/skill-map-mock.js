import { endorsementSourceTypeForRole, normalizeSkillName } from './skill-map-utils.js';

const WORKSPACE_ID = 'mock-workspace';
const CURRENT_USER_ID = 'mock-user-1';

export const MOCK_CONTEXT = {
  token: 'mock-token',
  workspaceId: WORKSPACE_ID,
  userId: CURRENT_USER_ID,
  role: 'member',
  workspaceSlug: 'mock-team',
};

export const MOCK_ACTIVE_SCOPE = {
  workspaceId: WORKSPACE_ID,
  scopeKind: 'owner_member',
  label: 'Mock Team',
};

export function isSkillMapMockMode(url, isDev) {
  if (!isDev || !url) return false;
  try {
    return new URL(url).searchParams.get('mock') === '1';
  } catch {
    return false;
  }
}

let singletonStore = null;

export function getSkillMapMockStore() {
  if (!singletonStore) singletonStore = createSkillMapMockStore();
  return singletonStore;
}

export function createSkillMapMockStore() {
  const dataset = createInitialDataset();
  let nextSkill = 100;
  let nextMemberSkill = 100;
  let nextEndorsement = 100;

  function getDataset() {
    return cloneDataset(dataset);
  }

  function findOrCreateSkill({ workspaceId, groupId, name, createdBy }) {
    assertWorkspace(workspaceId);
    const normalizedName = normalizeSkillName(name);
    if (!normalizedName) throw new Error('Ten skill khong hop le');

    const existing = dataset.skills.find((skill) => skill.normalized_name === normalizedName);
    if (existing) return { ...existing };

    const row = {
      id: `mock-skill-${nextSkill++}`,
      workspace_id: WORKSPACE_ID,
      group_id: groupId,
      name: cleanName(name),
      normalized_name: normalizedName,
      created_by: createdBy,
      created_at: now(),
      updated_at: now(),
    };
    dataset.skills.push(row);
    return { ...row };
  }

  function addMemberSkill({ workspaceId, userId, skillId, status }) {
    assertWorkspace(workspaceId);
    const existing = dataset.memberSkills.find((row) => (
      row.workspace_id === workspaceId &&
      row.user_id === userId &&
      row.skill_id === skillId
    ));

    if (existing) {
      existing.status = status;
      existing.updated_at = now();
      return { ...existing };
    }

    const row = {
      id: `mock-member-skill-${nextMemberSkill++}`,
      workspace_id: workspaceId,
      user_id: userId,
      skill_id: skillId,
      status,
      created_by: userId,
      created_at: now(),
      updated_at: now(),
    };
    dataset.memberSkills.push(row);
    return { ...row };
  }

  function updateMemberSkillStatus({ id, workspaceId, status }) {
    assertWorkspace(workspaceId);
    const row = dataset.memberSkills.find((item) => item.id === id && item.workspace_id === workspaceId);
    if (!row) throw new Error('Khong tim thay skill profile');
    row.status = status;
    row.updated_at = now();
    return { ...row };
  }

  function deleteMemberSkill({ id, workspaceId }) {
    assertWorkspace(workspaceId);
    const before = dataset.memberSkills.length;
    dataset.memberSkills = dataset.memberSkills.filter((row) => !(row.id === id && row.workspace_id === workspaceId));
    if (dataset.memberSkills.length === before) throw new Error('Khong tim thay skill profile');
    dataset.endorsements = dataset.endorsements.filter((row) => row.member_skill_id !== id);
  }

  function endorseMemberSkill({ workspaceId, memberSkill, currentUserRole, endorserUserId = CURRENT_USER_ID }) {
    assertWorkspace(workspaceId);
    if (memberSkill.user_id === endorserUserId) throw new Error('Khong the endorse chinh minh');

    const existing = dataset.endorsements.find((row) => (
      row.workspace_id === workspaceId &&
      row.member_skill_id === memberSkill.id &&
      row.endorser_user_id === endorserUserId
    ));
    if (existing) return { ...existing };

    const row = {
      id: `mock-endorsement-${nextEndorsement++}`,
      workspace_id: workspaceId,
      member_skill_id: memberSkill.id,
      member_user_id: memberSkill.user_id,
      skill_id: memberSkill.skill_id,
      endorser_user_id: endorserUserId,
      source_type: endorsementSourceTypeForRole(currentUserRole),
      created_at: now(),
    };
    dataset.endorsements.push(row);
    return { ...row };
  }

  function removeEndorsement({ id, workspaceId }) {
    assertWorkspace(workspaceId);
    dataset.endorsements = dataset.endorsements.filter((row) => !(row.id === id && row.workspace_id === workspaceId));
  }

  return {
    getDataset,
    findOrCreateSkill,
    addMemberSkill,
    updateMemberSkillStatus,
    deleteMemberSkill,
    endorseMemberSkill,
    removeEndorsement,
  };
}

function createInitialDataset() {
  const createdAt = '2026-05-28T00:00:00.000Z';
  const groups = [
    { id: 'mock-group-coding', workspace_id: WORKSPACE_ID, name: 'Coding', normalized_name: 'coding', sort_order: 10, created_by: CURRENT_USER_ID, created_at: createdAt, updated_at: createdAt },
    { id: 'mock-group-testing', workspace_id: WORKSPACE_ID, name: 'Testing', normalized_name: 'testing', sort_order: 20, created_by: CURRENT_USER_ID, created_at: createdAt, updated_at: createdAt },
    { id: 'mock-group-debugging', workspace_id: WORKSPACE_ID, name: 'Debugging', normalized_name: 'debugging', sort_order: 30, created_by: CURRENT_USER_ID, created_at: createdAt, updated_at: createdAt },
    { id: 'mock-group-git', workspace_id: WORKSPACE_ID, name: 'Git', normalized_name: 'git', sort_order: 40, created_by: CURRENT_USER_ID, created_at: createdAt, updated_at: createdAt },
  ];
  const skills = [
    skill('mock-skill-react', groups[0].id, 'React', createdAt),
    skill('mock-skill-api', groups[0].id, 'API integration', createdAt),
    skill('mock-skill-test-cases', groups[1].id, 'Test cases', createdAt),
    skill('mock-skill-devtools', groups[2].id, 'Browser DevTools', createdAt),
    skill('mock-skill-logs', groups[2].id, 'Reading logs', createdAt),
    skill('mock-skill-pr', groups[3].id, 'Pull requests', createdAt),
  ];
  const members = [
    { user_id: CURRENT_USER_ID, role: 'member', full_name: 'An Nguyen', avatar_url: null, work_phone: '0901000001' },
    { user_id: 'mock-user-2', role: 'member', full_name: 'Bao Tran', avatar_url: null, work_phone: '0901000002' },
    { user_id: 'mock-user-3', role: 'admin', full_name: 'Chi Mentor', avatar_url: null, work_phone: '0901000003' },
    { user_id: 'mock-user-4', role: 'member', full_name: 'Dung Le', avatar_url: null, work_phone: null },
  ];
  const memberSkills = [
    memberSkill('mock-ms-1', CURRENT_USER_ID, 'mock-skill-react', 'usable', createdAt),
    memberSkill('mock-ms-2', CURRENT_USER_ID, 'mock-skill-pr', 'learning', createdAt),
    memberSkill('mock-ms-3', 'mock-user-2', 'mock-skill-devtools', 'usable', createdAt),
    memberSkill('mock-ms-4', 'mock-user-2', 'mock-skill-logs', 'usable', createdAt),
    memberSkill('mock-ms-5', 'mock-user-4', 'mock-skill-test-cases', 'usable', createdAt),
    memberSkill('mock-ms-6', 'mock-user-4', 'mock-skill-api', 'learning', createdAt),
  ];
  const endorsements = [
    endorsement('mock-e-1', 'mock-ms-3', 'mock-user-2', 'mock-skill-devtools', 'mock-user-3', 'admin', createdAt),
    endorsement('mock-e-2', 'mock-ms-5', 'mock-user-4', 'mock-skill-test-cases', 'mock-user-2', 'peer', createdAt),
  ];

  return { members, groups, skills, memberSkills, endorsements };
}

function skill(id, groupId, name, createdAt) {
  return {
    id,
    workspace_id: WORKSPACE_ID,
    group_id: groupId,
    name,
    normalized_name: normalizeSkillName(name),
    created_by: CURRENT_USER_ID,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function memberSkill(id, userId, skillId, status, createdAt) {
  return {
    id,
    workspace_id: WORKSPACE_ID,
    user_id: userId,
    skill_id: skillId,
    status,
    created_by: userId,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function endorsement(id, memberSkillId, memberUserId, skillId, endorserUserId, sourceType, createdAt) {
  return {
    id,
    workspace_id: WORKSPACE_ID,
    member_skill_id: memberSkillId,
    member_user_id: memberUserId,
    skill_id: skillId,
    endorser_user_id: endorserUserId,
    source_type: sourceType,
    created_at: createdAt,
  };
}

function cloneDataset(dataset) {
  return {
    members: dataset.members.map((row) => ({ ...row })),
    groups: dataset.groups.map((row) => ({ ...row })),
    skills: dataset.skills.map((row) => ({ ...row })),
    memberSkills: dataset.memberSkills.map((row) => ({ ...row })),
    endorsements: dataset.endorsements.map((row) => ({ ...row })),
  };
}

function assertWorkspace(workspaceId) {
  if (workspaceId !== WORKSPACE_ID) throw new Error('Mock workspace khong hop le');
}

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function now() {
  return new Date().toISOString();
}
