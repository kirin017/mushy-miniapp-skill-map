// Context injection từ Shell → Mini-app
// Shell inject `window.__APP_CONTEXT__` trước khi load WebView.
// Khi chạy DEV trong browser thường, fallback sang biến VITE_DEV_*.

export function getContext() {
  if (typeof window !== 'undefined' && window.__APP_CONTEXT__) {
    return window.__APP_CONTEXT__;
  }
  if (import.meta.env.DEV) {
    return {
      token:       import.meta.env.VITE_DEV_TOKEN,
      workspaceId: import.meta.env.VITE_DEV_WORKSPACE_ID,
      userId:      import.meta.env.VITE_DEV_USER_ID,
      role:        import.meta.env.VITE_DEV_ROLE || 'admin',
      workspaceSlug: 'dev',
    };
  }
  throw new Error('Không tìm thấy APP_CONTEXT — mini-app phải chạy trong Shell hoặc bật DEV mode');
}

export function isInShell() {
  return typeof window !== 'undefined' && !!window.ReactNativeWebView;
}

export function normalizeContextProfile(ctx = {}) {
  const sources = [
    ctx.userProfile,
    ctx.profile,
    ctx.currentUser,
    ctx.user,
    ctx.account,
    ctx,
  ].filter(Boolean);

  const userId = firstText(
    ctx.userId,
    ctx.user_id,
    ctx.uid,
    ...sources.flatMap((source) => [source.userId, source.user_id, source.id]),
  );
  if (!userId) return null;

  const fullName = firstText(
    ...sources.flatMap((source) => [
      source.full_name,
      source.fullName,
      source.display_name,
      source.displayName,
      source.name,
      combineName(source.first_name || source.firstName, source.last_name || source.lastName),
    ]),
  );
  const email = firstText(ctx.email, ...sources.map((source) => source.email));
  const handle = normalizeHandle(firstText(
    ...sources.flatMap((source) => [source.handle, source.username, source.userName]),
    email ? email.split('@')[0] : null,
  ));
  const avatarUrl = firstImageUrl(
    ...sources.flatMap((source) => [
      source.avatar_url,
      source.avatarUrl,
      source.photo_url,
      source.photoUrl,
      source.photoURL,
      source.image_url,
      source.imageUrl,
      source.picture,
      source.avatar,
    ]),
  );

  return {
    user_id: userId,
    role: firstText(ctx.role, ...sources.map((source) => source.role)) || null,
    full_name: fullName || null,
    handle: handle || null,
    avatar_url: avatarUrl || null,
    work_phone: firstText(...sources.flatMap((source) => [source.work_phone, source.workPhone, source.phone])) || null,
  };
}

export function normalizeContextMemberProfiles(ctx = {}) {
  const memberCandidates = [
    ctx.members,
    ctx.teamMembers,
    ctx.workspaceMembers,
    ctx.memberProfiles,
    ctx.userProfiles,
    ctx.profiles,
    ctx.team?.members,
    ctx.workspace?.members,
    ctx.currentWorkspace?.members,
  ];
  const mapCandidates = [
    ctx.membersById,
    ctx.memberProfilesById,
    ctx.userProfilesById,
    ctx.profilesById,
    ctx.team?.membersById,
    ctx.workspace?.membersById,
    ctx.currentWorkspace?.membersById,
  ];
  const profilesById = new Map();

  for (const candidate of memberCandidates) {
    for (const member of toArray(candidate)) {
      const profile = normalizeProfileShape(member);
      if (profile) profilesById.set(profile.user_id, mergeProfile(profilesById.get(profile.user_id), profile));
    }
  }

  for (const candidate of mapCandidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    for (const [userId, member] of Object.entries(candidate)) {
      const memberObject = member && typeof member === 'object' ? member : {};
      const profile = normalizeProfileShape({ userId, ...memberObject });
      if (profile) profilesById.set(profile.user_id, mergeProfile(profilesById.get(profile.user_id), profile));
    }
  }

  const currentProfile = normalizeContextProfile(ctx);
  if (currentProfile) {
    profilesById.set(currentProfile.user_id, mergeProfile(profilesById.get(currentProfile.user_id), currentProfile));
  }

  return [...profilesById.values()];
}

function normalizeProfileShape(source = {}) {
  const userId = firstText(source.user_id, source.userId, source.id, source.uid);
  if (!userId) return null;
  const fullName = firstText(
    source.full_name,
    source.fullName,
    source.display_name,
    source.displayName,
    source.name,
    combineName(source.first_name || source.firstName, source.last_name || source.lastName),
    source.profile?.full_name,
    source.profile?.fullName,
    source.profile?.displayName,
    source.profile?.name,
  );
  const email = firstText(source.email, source.profile?.email);
  const handle = normalizeHandle(firstText(
    source.handle,
    source.username,
    source.userName,
    source.profile?.handle,
    source.profile?.username,
    email ? email.split('@')[0] : null,
  ));
  const avatarUrl = firstImageUrl(
    source.avatar_url,
    source.avatarUrl,
    source.photo_url,
    source.photoUrl,
    source.photoURL,
    source.image_url,
    source.imageUrl,
    source.picture,
    source.avatar,
    source.profile?.avatar_url,
    source.profile?.avatarUrl,
    source.profile?.photoUrl,
    source.profile?.picture,
  );

  return {
    user_id: userId,
    role: firstText(source.role) || null,
    full_name: fullName || null,
    handle: handle || null,
    avatar_url: avatarUrl || null,
    work_phone: firstText(source.work_phone, source.workPhone, source.phone, source.profile?.work_phone, source.profile?.workPhone) || null,
  };
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.values(value);
  return [];
}

function mergeProfile(base, override) {
  return {
    user_id: firstText(override?.user_id, base?.user_id) || null,
    role: firstText(override?.role, base?.role) || null,
    full_name: firstText(override?.full_name, base?.full_name) || null,
    handle: firstText(override?.handle, base?.handle) || null,
    avatar_url: firstText(override?.avatar_url, base?.avatar_url) || null,
    work_phone: firstText(override?.work_phone, base?.work_phone) || null,
  };
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function combineName(firstName, lastName) {
  return [firstName, lastName].map((value) => String(value ?? '').trim()).filter(Boolean).join(' ');
}

function normalizeHandle(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.startsWith('@') ? text : `@${text}`;
}

function firstImageUrl(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (/^(https?:|data:image\/|blob:)/i.test(text)) return text;
  }
  return '';
}
