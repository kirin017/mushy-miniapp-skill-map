// Batch lookup members + profiles của workspace.
//
// Tận dụng RLS workspace-mate visibility (superapp migration 004): mọi member
// SELECT được public.workspace_members + public.user_profiles của workspace-mate.
// Trước đó self-only RLS ép mini-app fallback hash-color — KHÔNG dùng nữa.
//
// Usage:
//   import { listMembers, getProfiles } from './lib/members.js';
//   const members = await listMembers(ctx.workspaceId);
//   // [{ user_id, role, full_name, avatar_url }, ...]
//
//   // Hoặc chỉ cần profile cho 1 subset user_ids đã biết (vd voters list):
//   const profileMap = await getProfiles([uid1, uid2, uid3]);
//   // { uid1: { user_id, full_name, avatar_url, work_phone }, ... }
//
// Biệt danh display_name đã bỏ (superapp mig 023) — chỉ còn full_name.
// work_phone: RLS workspace-mate cho phép đọc — dùng cho tap-to-call
// (bridge.tel) trong voters/members list. null nếu user chưa khai.

import { dbPublic } from './supabase.js';

export async function listMembers(workspaceId, { currentUserId, currentUserProfile, contextMemberProfiles = [], extraUserIds = [] } = {}) {
  const currentProfile = normalizeProfile(currentUserProfile, currentUserId);
  const contextProfiles = contextMemberProfiles.map((profile) => normalizeProfile(profile)).filter(Boolean);
  if (!workspaceId) return uniqueProfiles([...contextProfiles, currentProfile]);

  const { data: rows, error: mErr } = await dbPublic
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId);
  if (mErr) throw mErr;

  const memberRows = rows || [];
  const contextProfilesById = new Map(contextProfiles.map((profile) => [profile.user_id, profile]));
  const profileMap = await getProfiles(uniqueValues([
    ...memberRows.map((r) => r.user_id),
    currentUserId,
    ...extraUserIds,
    ...contextProfiles.map((profile) => profile.user_id),
  ]));

  const members = memberRows.map((r) => {
    const profile = mergeProfile(
      profileMap[r.user_id],
      mergeProfile(contextProfilesById.get(r.user_id), r.user_id === currentUserId ? currentProfile : null),
    );
    return {
      user_id: r.user_id,
      role: r.role,
      full_name: profile.full_name,
      handle: profile.handle,
      avatar_url: profile.avatar_url,
      work_phone: profile.work_phone,
    };
  });

  for (const userId of uniqueValues([...extraUserIds, ...contextProfiles.map((profile) => profile.user_id), currentProfile?.user_id])) {
    if (members.some((member) => member.user_id === userId)) continue;
    const profile = mergeProfile(profileMap[userId], mergeProfile(contextProfilesById.get(userId), userId === currentUserId ? currentProfile : null));
    if (!hasProfileData(profile) && userId !== currentUserId) continue;
    members.push({
      user_id: userId,
      role: profile.role || 'member',
      full_name: profile.full_name,
      handle: profile.handle,
      avatar_url: profile.avatar_url,
      work_phone: profile.work_phone,
    });
  }

  return members;
}

export async function getProfiles(userIds) {
  if (!userIds?.length) return {};
  const { data, error } = await dbPublic
    .from('user_profiles')
    .select('user_id, full_name, avatar_url, work_phone')
    .in('user_id', userIds);
  if (error) throw error;
  return Object.fromEntries((data || []).map((p) => [p.user_id, p]));
}

function normalizeProfile(profile, userId) {
  const resolvedUserId = firstText(profile?.user_id, profile?.userId, profile?.id, userId);
  if (!resolvedUserId) return null;
  return {
    user_id: resolvedUserId,
    role: firstText(profile?.role) || null,
    full_name: firstText(profile?.full_name, profile?.fullName, profile?.name) || null,
    handle: firstText(profile?.handle) || null,
    avatar_url: firstText(profile?.avatar_url, profile?.avatarUrl) || null,
    work_phone: firstText(profile?.work_phone, profile?.workPhone) || null,
  };
}

function mergeProfile(dbProfile, contextProfile) {
  return {
    role: firstText(contextProfile?.role, dbProfile?.role) || null,
    full_name: firstText(contextProfile?.full_name, dbProfile?.full_name) || null,
    handle: firstText(contextProfile?.handle, dbProfile?.handle) || null,
    avatar_url: firstText(contextProfile?.avatar_url, dbProfile?.avatar_url) || null,
    work_phone: firstText(contextProfile?.work_phone, dbProfile?.work_phone) || null,
  };
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueProfiles(profiles) {
  const profilesById = new Map();
  for (const profile of profiles.filter(Boolean)) {
    profilesById.set(profile.user_id, mergeProfile(profilesById.get(profile.user_id), profile));
  }
  return [...profilesById.values()];
}

function hasProfileData(profile) {
  return !!(profile?.full_name || profile?.handle || profile?.avatar_url || profile?.work_phone);
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}
