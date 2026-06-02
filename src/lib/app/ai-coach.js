const MAX_GOAL_LENGTH = 240;
const MAX_SUMMARY_LENGTH = 240;
const MAX_REASON_LENGTH = 220;
const MAX_NEXT_STEP_LENGTH = 360;
const MAX_NOTE_LENGTH = 220;
const DEFAULT_MAX_ITEMS = 6;
const HARD_MAX_ITEMS = 8;
const MAX_SKILL_LEVEL = 4;
const SESSION_COLUMNS = 'id,workspace_id,user_id,goal_text,summary,items,created_at';

export function buildCoachLevelPlanRequest({
  goalText = '',
  profileSkills = [],
  levelLabels = [],
  maxItems = DEFAULT_MAX_ITEMS,
} = {}) {
  return {
    action: 'coach_level_plan',
    goalText: cleanText(goalText, MAX_GOAL_LENGTH),
    profileSkills: profileSkills.map(reduceProfileSkill).filter((skill) => skill.skill_id),
    levelLabels,
    maxItems: clampInteger(maxItems, 1, HARD_MAX_ITEMS, DEFAULT_MAX_ITEMS),
  };
}

export function parseCoachLevelPlanText(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1].trim() : raw;

  try {
    return JSON.parse(jsonText);
  } catch {
    const error = new Error('invalid_json');
    error.code = 'invalid_json';
    throw error;
  }
}

export function validateCoachLevelPlanPayload({
  payload,
  profileSkills = [],
  maxItems = DEFAULT_MAX_ITEMS,
} = {}) {
  const profileById = buildProfileSkillMap(profileSkills);
  const limit = clampInteger(maxItems, 1, HARD_MAX_ITEMS, DEFAULT_MAX_ITEMS);
  const seen = new Set();
  const items = [];

  for (const item of Array.isArray(payload?.items) ? payload.items : []) {
    const skillId = cleanText(item?.skill_id);
    if (!skillId || seen.has(skillId)) continue;

    const profileSkill = profileById.get(skillId);
    if (!profileSkill) continue;

    const currentLevel = clampInteger(item?.current_level, 0, MAX_SKILL_LEVEL, 0);
    const targetLevel = clampInteger(item?.target_level, 0, MAX_SKILL_LEVEL, 0);
    if (currentLevel !== profileSkill.level) continue;
    if (targetLevel <= currentLevel || targetLevel > MAX_SKILL_LEVEL) continue;

    seen.add(skillId);
    items.push({
      skill_id: skillId,
      current_level: currentLevel,
      target_level: targetLevel,
      reason: cleanText(item?.reason, MAX_REASON_LENGTH),
      next_step: cleanText(item?.next_step, MAX_NEXT_STEP_LENGTH),
    });

    if (items.length >= limit) break;
  }

  if (items.length === 0) {
    throw new Error('coach_plan_empty');
  }

  return {
    summary: cleanText(payload?.summary, MAX_SUMMARY_LENGTH),
    items,
  };
}

export function buildCoachSessionInsert({
  workspaceId,
  userId,
  goalText = '',
  plan = {},
} = {}) {
  return {
    workspace_id: workspaceId,
    user_id: userId,
    goal_text: cleanText(goalText, MAX_GOAL_LENGTH),
    summary: cleanText(plan.summary, MAX_SUMMARY_LENGTH),
    items: Array.isArray(plan.items) ? plan.items : [],
  };
}

export async function saveCoachSession({
  supabase,
  workspaceId,
  userId,
  goalText = '',
  plan = {},
} = {}) {
  const row = buildCoachSessionInsert({ workspaceId, userId, goalText, plan });
  const { data, error } = await supabase
    .from('ai_coach_sessions')
    .insert(row)
    .select(SESSION_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function listCoachSessions({
  supabase,
  workspaceId,
  userId,
  limit = DEFAULT_MAX_ITEMS,
} = {}) {
  const { data, error } = await supabase
    .from('ai_coach_sessions')
    .select(SESSION_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(clampInteger(limit, 1, 50, DEFAULT_MAX_ITEMS));

  if (error) throw error;
  return data || [];
}

function reduceProfileSkill(skill) {
  return {
    skill_id: cleanText(skill?.id || skill?.skill_id || skill?.skillId),
    name: cleanText(skill?.name),
    category: cleanText(skill?.category),
    level: clampInteger(skill?.level, 0, MAX_SKILL_LEVEL, 0),
    interest: clampInteger(skill?.interest, 0, MAX_SKILL_LEVEL, 0),
    note: cleanText(skill?.note, MAX_NOTE_LENGTH),
  };
}

function buildProfileSkillMap(profileSkills) {
  const profileById = new Map();
  for (const skill of profileSkills) {
    const reduced = reduceProfileSkill(skill);
    if (!reduced.skill_id || profileById.has(reduced.skill_id)) continue;
    profileById.set(reduced.skill_id, reduced);
  }
  return profileById;
}

function cleanText(value, maxLength = Infinity) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return Number.isFinite(maxLength) ? text.slice(0, maxLength) : text;
}

function clampInteger(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
