import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './App.css';
import ScopeSwitcher from './components/ScopeSwitcher.jsx';
import ShareManageModal from './components/ShareManageModal.jsx';
import { getContext, normalizeContextMemberProfiles, normalizeContextProfile } from './lib/context.js';
import { db } from './lib/supabase.js';
import { listMembers } from './lib/members.js';
import { useActiveScope, useDefaultScopeInitializer, useIsCurrentWorkspaceAdmin } from './lib/sharing.js';
import {
  PRESET_SKILLS,
  approvePendingSkill,
  buildProfileSummary,
  deleteProfileSkill,
  loadSkillMapData,
  mergePendingSkill,
  rejectPendingSkill,
  saveProfileSkill,
} from './lib/app/skill-map-data.js';

const LEVEL_LABELS = ['Học', 'Cơ bản', 'Làm được', 'Thành thạo', 'Mentor'];
const LEVEL_BADGES = ['0 Học', '1 Cơ bản', '2 Làm được', '3 Thành thạo', '4 Mentor'];
const INITIAL_SKILLS = PRESET_SKILLS.map((skill) => ({ ...skill, skillId: null, total: 0, risk: 1 }));
const EMPTY_VIEW = { skills: INITIAL_SKILLS, members: [], profileSkills: [] };

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function App() {
  const [ctxResult] = useState(() => {
    try {
      return { ctx: getContext(), error: null };
    } catch (error) {
      return { ctx: null, error };
    }
  });

  if (!ctxResult.ctx) {
    return <ShellRequired error={ctxResult.error} />;
  }

  return <SkillMapApp ctx={ctxResult.ctx} />;
}

function SkillMapApp({ ctx }) {
  const shellRef = useRef(null);
  useDefaultScopeInitializer();
  const activeScope = useActiveScope();
  const isWorkspaceAdmin = useIsCurrentWorkspaceAdmin(activeScope.workspaceId);
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('Docker');
  const [selectedSkill, setSelectedSkill] = useState('docker');
  const [view, setView] = useState(EMPTY_VIEW);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentUserProfile = useMemo(() => normalizeContextProfile(ctx), [ctx]);
  const contextMemberProfiles = useMemo(() => normalizeContextMemberProfiles(ctx), [ctx]);

  const skills = view.skills.length ? view.skills : INITIAL_SKILLS;
  const members = view.members;
  const profileSkills = view.profileSkills;

  useGSAP(() => {
    const root = shellRef.current;
    if (!root) return undefined;

    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-gsap="fade-up"]', {
        y: 28,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.08,
      });

      gsap.utils.toArray('[data-gsap="image-reveal"]').forEach((element) => {
        gsap.fromTo(
          element,
          { scale: 0.88, opacity: 0.45, filter: 'contrast(0.85) brightness(0.8)' },
          {
            scale: 1,
            opacity: 1,
            filter: 'contrast(1.08) brightness(1)',
            ease: 'none',
            scrollTrigger: {
              trigger: element,
              start: 'top 86%',
              end: 'bottom 22%',
              scrub: true,
            },
          },
        );
      });

      const desire = root.querySelector('[data-gsap="desire"]');
      const pinTitle = root.querySelector('[data-gsap="pin-title"]');
      if (desire && pinTitle && window.matchMedia('(min-width: 900px)').matches) {
        ScrollTrigger.create({
          trigger: desire,
          start: 'top 92px',
          end: 'bottom bottom',
          pin: pinTitle,
          pinSpacing: false,
        });
      }
    });

    return () => motion.revert();
  }, { scope: shellRef, dependencies: [tab, loading, selectedSkill] });

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await loadSkillMapData({
        db,
        listMembers,
        workspaceId: activeScope.workspaceId,
        userId: ctx.userId,
        currentUserProfile,
        contextMemberProfiles,
      });
      setView(next);
      if (next.skills.length && !next.skills.some((skill) => skill.id === selectedSkill)) {
        setSelectedSkill(next.skills[0].id);
        setQuery(next.skills[0].name);
      }
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [activeScope.workspaceId, ctx.userId, currentUserProfile, contextMemberProfiles, selectedSkill]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected = skills.find((skill) => skill.id === selectedSkill) || skills[0] || INITIAL_SKILLS[0];
  const searchRows = useMemo(() => {
    const q = normalizeText(query.trim());
    return members
      .map((member) => ({
        ...member,
        level: member.skills[selectedSkill] ?? 0,
        interest: Math.max(1, Math.min(3, (member.skills[selectedSkill] ?? 0) - 1)),
      }))
      .filter((member) => {
        if (!q) return member.level > 0;
        return normalizeText(member.name).includes(q)
          || normalizeText(member.handle).includes(q)
          || normalizeText(selected.name).includes(q);
      })
      .sort((a, b) => b.level - a.level || b.interest - a.interest);
  }, [members, query, selected.name, selectedSkill]);

  async function handleSaveProfileSkill(draft) {
    const hasMemberSkillRows = !!(draft.memberSkillId || draft.memberSkillIds?.length);
    const skill = draft.customSkill || hasMemberSkillRows ? null : skills.find((item) => item.id === draft.skillId);
    if (!draft.customSkill && !hasMemberSkillRows && !skill?.skillId) throw new Error('Kỹ năng chưa sẵn sàng để lưu');
    if (draft.customSkill && !draft.skillName?.trim()) throw new Error('Tên kỹ năng không được để trống');
    setSaving(true);
    try {
      await saveProfileSkill({
        db,
        workspaceId: activeScope.workspaceId,
        userId: ctx.userId,
        memberSkillId: draft.memberSkillId || null,
        memberSkillIds: draft.memberSkillIds || [],
        skillId: skill?.skillId || null,
        skillName: draft.customSkill ? draft.skillName : null,
        category: draft.customSkill ? draft.category : null,
        level: draft.level,
        interest: draft.interest,
        note: draft.note,
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProfileSkill(profileSkill) {
    const skillKey = typeof profileSkill === 'string' ? profileSkill : profileSkill?.id;
    const skill = skills.find((item) => item.id === skillKey);
    const memberSkillId = typeof profileSkill === 'object' ? profileSkill.rowId : null;
    const memberSkillIds = typeof profileSkill === 'object' ? profileSkill.memberSkillIds || [] : [];
    const skillId = typeof profileSkill === 'object'
      ? profileSkill.sourceSkillId || profileSkill.skillId || skill?.skillId
      : skill?.skillId;
    if (!memberSkillId && !memberSkillIds.length && !skillId) throw new Error('Kỹ năng chưa sẵn sàng để xóa');
    setSaving(true);
    try {
      await deleteProfileSkill({
        db,
        workspaceId: activeScope.workspaceId,
        userId: ctx.userId,
        memberSkillId,
        memberSkillIds,
        skillId,
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleApprovePendingSkill(skillId) {
    setSaving(true);
    setLoadError(null);
    try {
      await approvePendingSkill({
        db,
        workspaceId: activeScope.workspaceId,
        reviewerId: ctx.userId,
        skillId,
      });
      await reload();
    } catch (error) {
      setLoadError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleMergePendingSkill(fromSkillId, toSkillId) {
    setSaving(true);
    setLoadError(null);
    try {
      await mergePendingSkill({
        db,
        workspaceId: activeScope.workspaceId,
        reviewerId: ctx.userId,
        fromSkillId,
        toSkillId,
      });
      await reload();
    } catch (error) {
      setLoadError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleRejectPendingSkill(skillId) {
    setSaving(true);
    setLoadError(null);
    try {
      await rejectPendingSkill({
        db,
        workspaceId: activeScope.workspaceId,
        reviewerId: ctx.userId,
        skillId,
        note: 'Rejected from Skill Map review queue',
      });
      await reload();
    } catch (error) {
      setLoadError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mushy-shell" ref={shellRef}>
      <div className="integration-strip">
        <ScopeSwitcher onManageGrants={() => setShareOpen(true)} />
        <button type="button" onClick={reload} disabled={loading} data-tooltip={loading ? 'Đang đồng bộ dữ liệu' : 'Tải lại dữ liệu'}>
          <span aria-hidden="true">{loading ? 'Sync' : 'Refresh'}</span>
          {loading ? 'Đang tải' : 'Làm mới'}
        </button>
      </div>
      {loading && (
        <section className="status-panel status-panel--loading" role="status" aria-live="polite">
          <span className="status-orbit" aria-hidden="true" />
          <div>
            <strong>Đang đồng bộ Skill Map</strong>
            <p>Cập nhật kỹ năng, thành viên và quyền workspace hiện tại.</p>
          </div>
        </section>
      )}
      {loadError && (
        <section className="data-error" role="alert">
          <strong>Chưa tải được dữ liệu Skill Map</strong>
          <p>{loadError.message}</p>
          <small>Kiểm tra migration `002_team_skill_map` đã được apply qua Admin Portal và workspace đã enable miniapp.</small>
        </section>
      )}
      {!loading && !loadError && members.length === 0 && (
        <section className="status-panel status-panel--empty">
          <span className="status-orbit" aria-hidden="true" />
          <div>
            <strong>Chưa có dữ liệu team</strong>
            <p>Skill Map vẫn hiển thị catalog chuẩn để bạn bắt đầu đồng bộ hồ sơ kỹ năng.</p>
          </div>
        </section>
      )}
      {tab === 'overview' && (
        <Overview
          skills={skills}
          members={members}
          currentMember={members.find((member) => member.userId === ctx.userId)}
          onSearch={() => setTab('search')}
          onReport={() => setTab('report')}
          onProfile={() => setTab('profile')}
          profileSkills={profileSkills}
          isWorkspaceAdmin={isWorkspaceAdmin}
          saving={saving}
          onApprovePendingSkill={handleApprovePendingSkill}
          onMergePendingSkill={handleMergePendingSkill}
          onRejectPendingSkill={handleRejectPendingSkill}
          selectedSkill={selectedSkill}
          onSelectSkill={(skillId) => {
            setSelectedSkill(skillId);
            setQuery(skills.find((skill) => skill.id === skillId)?.name || '');
            setTab('search');
          }}
        />
      )}

      {tab === 'search' && (
        <SearchScreen
          skills={skills}
          query={query}
          setQuery={setQuery}
          selected={selected}
          selectedSkill={selectedSkill}
          setSelectedSkill={setSelectedSkill}
          rows={searchRows}
          onBack={() => setTab('overview')}
          onShowHeatmap={() => setTab('overview')}
        />
      )}

      {tab === 'profile' && (
        <ProfileScreen
          profileSkillCatalog={skills}
          profileSkills={profileSkills}
          onSaveProfileSkill={handleSaveProfileSkill}
          onDeleteProfileSkill={handleDeleteProfileSkill}
          saving={saving}
          currentMember={members.find((member) => member.userId === ctx.userId)}
          onBack={() => setTab('overview')}
        />
      )}
      {tab === 'report' && <ReportScreen skills={skills} onBack={() => setTab('overview')} />}

      <ShareManageModal open={shareOpen} onClose={() => setShareOpen(false)} />
      <BottomNav active={tab} onChange={setTab} />
    </main>
  );
}

function ShellRequired({ error }) {
  return (
      <main className="mushy-shell shell-required-wrap">
      <section className="shell-required">
        <img className="mushy-avatar" src="/mushy.png" alt="Mushy" />
        <div>
          <h1>Skill Map</h1>
          <p>Miniapp này cần được mở từ Mushy để nhận token, workspace và quyền truy cập dữ liệu.</p>
          <small>{error?.message || 'Không tìm thấy APP_CONTEXT'}</small>
        </div>
      </section>
    </main>
  );
}

function ProfileAvatar({ summary }) {
  if (summary.avatarUrl) {
    return (
      <span className="profile-avatar profile-avatar--image">
        <img src={summary.avatarUrl} alt="" onError={handleAssetFallback} />
        <span className="profile-avatar-fallback" hidden>{summary.avatar}</span>
      </span>
    );
  }
  return <span className="profile-avatar">{summary.avatar}</span>;
}

function SkillIcon({ skill, className = '', compact = false }) {
  const classes = ['skill-icon', compact ? 'skill-icon--compact' : '', className].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-hidden="true">
      {skill.iconUrl && <img src={skill.iconUrl} alt="" loading="lazy" onError={handleAssetFallback} />}
      <span className="skill-icon-fallback" hidden={!!skill.iconUrl}>{skill.icon}</span>
    </span>
  );
}

function handleAssetFallback(event) {
  const image = event.currentTarget;
  image.style.display = 'none';
  image.nextElementSibling?.removeAttribute('hidden');
}

function Overview({
  skills,
  members,
  currentMember,
  onSearch,
  onReport,
  onProfile,
  onSelectSkill,
  selectedSkill,
  profileSkills,
  isWorkspaceAdmin,
  saving,
  onApprovePendingSkill,
  onMergePendingSkill,
  onRejectPendingSkill,
}) {
  const topSkills = skills.slice(0, 4);
  const [overviewSearch, setOverviewSearch] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [heatMode, setHeatMode] = useState('top');
  const searchText = overviewSearch.trim();
  const normalizedSearch = normalizeText(searchText);
  const skillMatches = useMemo(() => {
    if (!normalizedSearch) return skills.slice(0, 5);
    const matches = skills.filter((skill) => normalizeText(skill.name).includes(normalizedSearch));
    return matches.length ? matches.slice(0, 5) : skills.slice(0, 5);
  }, [normalizedSearch, skills]);
  const memberMatches = useMemo(() => {
    if (!normalizedSearch) return members.slice(0, 6);
    const matchedSkillIds = skills
      .filter((skill) => normalizeText(skill.name).includes(normalizedSearch))
      .map((skill) => skill.id);
    return members.filter((member) => {
      const memberText = normalizeText(`${member.name} ${member.handle}`);
      const matchesMember = memberText.includes(normalizedSearch);
      const matchesSkill = matchedSkillIds.some((skillId) => (member.skills[skillId] || 0) > 0);
      return matchesMember || matchesSkill;
    });
  }, [members, normalizedSearch, skills]);
  const heatSkills = heatMode === 'risk'
    ? skills.filter((skill) => skill.risk).slice(0, 5)
    : skillMatches;
  const heatMembers = memberMatches.slice(0, 6);
  const searchMode = normalizedSearch
    ? `${memberMatches.length} kết quả phù hợp`
    : heatMode === 'risk'
      ? 'Hiển thị kỹ năng cần bổ sung'
      : 'Hiển thị top kỹ năng';
  const profileSummary = buildProfileSummary({ currentMember, profileSkills, skills });
  const pendingSkills = uniqueBy(
    members.flatMap((member) => (
      member.pendingSkills || []
    ).map((skill) => ({ ...skill, memberName: member.name }))),
    (skill) => skill.skillId,
  );

  return (
    <div className="screen screen--overview">
      <div className="overview-main">
        <header className="home-header" data-gsap="fade-up">
          <img className="mushy-avatar" src="/mushy.png" alt="Mushy" />
          <div>
            <h1>Skill <span className="inline-title-image" aria-hidden="true" /> Map</h1>
            <p>Hiểu năng lực team, tìm đúng người, nâng cấp kỹ năng theo thời gian thực.</p>
          </div>
          <button className="ghost-icon" type="button" aria-label="Thông báo" data-tooltip="Thông báo" aria-expanded={noticeOpen} onClick={() => setNoticeOpen((open) => !open)}>Alert</button>
          <button className="ghost-icon" type="button" aria-label="Mở menu" data-tooltip="Menu nhanh" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Menu</button>
        </header>

        {(noticeOpen || menuOpen) && (
          <section className="header-popover" aria-live="polite">
            {noticeOpen && (
              <div>
                <strong>Thông báo</strong>
                <p>Chưa có cập nhật mới. Skill Map sẽ báo khi team có thay đổi kỹ năng quan trọng.</p>
              </div>
            )}
            {menuOpen && (
              <div className="menu-actions">
                <button type="button" onClick={onProfile}>Sửa hồ sơ</button>
                <button type="button" onClick={onReport}>Xem báo cáo</button>
              </div>
            )}
          </section>
        )}

        <div className="quick-grid" data-gsap="fade-up">
          <button className="quick-card" type="button" onClick={onReport}>
            <span className="quick-icon heat-icon" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i /><i />
            </span>
            <span>
              <strong>Heatmap tổng quan</strong>
              <small>Xem năng lực theo kỹ năng</small>
            </span>
          </button>
          <button className="quick-card" type="button" onClick={onSearch}>
            <span className="quick-people" aria-hidden="true">2x</span>
            <span>
              <strong>Tìm theo kỹ năng</strong>
              <small>Tìm người phù hợp</small>
            </span>
          </button>
        </div>

        <section className="skill-marquee" aria-label="Kỹ năng đang theo dõi" data-gsap="fade-up">
          <div>
            {[...skills.slice(0, 8), ...skills.slice(0, 8)].map((skill, index) => (
              <span key={`${skill.id}-${index}`}>
                <SkillIcon skill={skill} compact />
                {skill.name}
              </span>
            ))}
          </div>
        </section>

        <div className="search-row" data-gsap="fade-up">
          <label className="search-pill overview-search" htmlFor="overview-search">
            <span>⌕</span>
            <input
              id="overview-search"
              value={overviewSearch}
              onChange={(event) => setOverviewSearch(event.target.value)}
              aria-label="Tìm kỹ năng hoặc thành viên"
              placeholder="Tìm kỹ năng hoặc thành viên..."
            />
            {overviewSearch && (
              <button type="button" onClick={() => setOverviewSearch('')} aria-label="Xóa tìm kiếm">×</button>
            )}
          </label>
          <button className="filter-pill" type="button" data-tooltip="Lọc heatmap" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>
            <span aria-hidden="true">Filter</span>
            Bộ lọc
          </button>
        </div>

        {filterOpen && (
          <section className="filter-panel" aria-label="Bộ lọc heatmap">
            <button type="button" className={heatMode === 'top' ? 'active' : ''} onClick={() => setHeatMode('top')}>Top kỹ năng</button>
            <button type="button" className={heatMode === 'risk' ? 'active' : ''} onClick={() => setHeatMode('risk')}>Cần bổ sung</button>
            <button type="button" onClick={() => setOverviewSearch('')}>Xóa tìm kiếm</button>
          </section>
        )}

        <section className="panel heat-panel" data-gsap="image-reveal">
          <div className="panel-head">
            <div>
              <h2>Heatmap năng lực</h2>
              <small>{searchMode}</small>
            </div>
            <button
              className="tiny-select"
              type="button"
              aria-label="Đổi chế độ heatmap"
              onClick={() => setHeatMode((mode) => (mode === 'top' ? 'risk' : 'top'))}
            >
              {heatMode === 'top' ? 'Top kỹ năng' : 'Cần bổ sung'}⌄
            </button>
          </div>
          <div className="heat-scroll">
            <table className="skill-heatmap">
              <thead>
                <tr>
                  <th>Thành viên</th>
                  {heatSkills.map((skill) => (
                    <th key={skill.id}>
                      <SkillIcon skill={skill} />
                      {skill.name}
                    </th>
                  ))}
                  <th>+2</th>
                </tr>
              </thead>
              <tbody>
                {heatMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <span className="face">{member.avatar}</span>
                      <span>
                        <strong>{member.name}</strong>
                        {member.handle && <small>{member.handle}</small>}
                      </span>
                    </td>
                    {heatSkills.map((skill) => (
                      <td key={skill.id}>
                        <button
                          className={`level-cell level-${member.skills[skill.id] || 0}`}
                          type="button"
                          onClick={() => onSelectSkill(skill.id)}
                          aria-label={`${member.name} ${skill.name} level ${member.skills[skill.id] || 0}`}
                        >
                          {member.skills[skill.id] || 0}
                        </button>
                      </td>
                    ))}
                    <td><span className="level-cell level-0">0</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="heat-mobile-list">
              {heatMembers.map((member) => (
                <article key={member.id} className="heat-mobile-card">
                  <div>
                    <span className="face">{member.avatar}</span>
                    <span>
                      <strong>{member.name}</strong>
                      {member.handle && <small>{member.handle}</small>}
                    </span>
                  </div>
                  <div>
                    {heatSkills.map((skill) => (
                      <button key={skill.id} type="button" onClick={() => onSelectSkill(skill.id)}>
                        <span><SkillIcon skill={skill} compact /> {skill.name}</span>
                        <b className={`level-${member.skills[skill.id] || 0}`}>{member.skills[skill.id] || 0}</b>
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            {heatMembers.length === 0 && (
              <div className="heat-empty">
                <strong>Chưa tìm thấy thành viên phù hợp</strong>
                <span>Thử tìm theo “Docker”, “React”, “Nam” hoặc “Hà My”.</span>
              </div>
            )}
          </div>
          {searchText && (
            <div className="search-hint">
              Đang lọc theo <strong>{searchText}</strong>. Bảng chỉ hiển thị người có kỹ năng hoặc tên khớp.
            </div>
          )}
          <div className="legend">
            {LEVEL_BADGES.map((label, index) => (
              <span key={label}><i className={`level-${index}`} />{label}</span>
            ))}
            <b>?</b>
          </div>
        </section>

        <button className="gap-banner" type="button" onClick={onReport} data-gsap="image-reveal">
          <span aria-hidden="true">Gap</span>
          <span>
            <strong>Kỹ năng cần bổ sung</strong>
            <small>Một số kỹ năng chưa có người ở mức Mentor hoặc Thành thạo.</small>
          </span>
          <b>Xem chi tiết →</b>
        </button>

        <section className="panel popular-panel" data-gsap="image-reveal">
          <div className="panel-head">
            <h2>Kỹ năng phổ biến trong team</h2>
            <button type="button" onClick={onSearch}>Xem tất cả</button>
          </div>
          <div className="popular-grid">
            {topSkills.map((skill) => (
              <button key={skill.id} className="popular-card" type="button" onClick={() => onSelectSkill(skill.id)}>
                <SkillIcon skill={skill} />
                <strong>{skill.name}</strong>
                <small>{skill.total}/{Math.max(members.length, 1)} người</small>
                <i style={{ '--fill': `${Math.max(12, skill.total * 14)}%` }} />
              </button>
            ))}
          </div>
        </section>

        <section className="panel motion-lab" data-gsap="desire">
          <div className="motion-lab-title" data-gsap="pin-title">
            <h2>Đọc năng lực như một bản đồ sống</h2>
            <p>Mỗi ô level biến thành tín hiệu cho staffing, mentoring và kế hoạch học tập tiếp theo.</p>
          </div>
          <div className="motion-stack">
            {heatSkills.slice(0, 3).map((skill, index) => (
              <article key={skill.id} data-gsap="image-reveal">
                <div className="motion-image" data-skill-state={skill.risk ? 'risk' : 'stable'} aria-hidden="true" />
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{skill.name}</strong>
                <small>{skill.risk ? 'Cần thêm mentor hoặc người làm chính.' : 'Đang có tín hiệu năng lực ổn định.'}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel overview-profile-card">
          <div className="panel-head">
            <h2>Hồ sơ của bạn</h2>
            <button type="button" onClick={onProfile}>Sửa</button>
          </div>
          <div className="desktop-profile">
            <ProfileAvatar summary={profileSummary} />
            <div>
              <strong>{profileSummary.name}</strong>
              <small>{profileSummary.skillCount} kỹ năng nổi bật · {profileSummary.learningCount} đang học</small>
            </div>
          </div>
          <div className="desktop-skill-tags">
            {profileSummary.featuredSkills.map((skill) => <b key={skill}>{skill}</b>)}
          </div>
        </section>

        {isWorkspaceAdmin && pendingSkills.length > 0 && (
          <PendingSkillReview
            pendingSkills={pendingSkills}
            approvedSkills={skills}
            saving={saving}
            onApprove={onApprovePendingSkill}
            onMerge={onMergePendingSkill}
            onReject={onRejectPendingSkill}
          />
        )}
      </div>

      <DesktopCompanion
        skills={skills}
        members={members}
        currentMember={currentMember}
        selectedSkill={selectedSkill}
        profileSkills={profileSkills}
        onSearch={onSearch}
        onReport={onReport}
        onProfile={onProfile}
        onSelectSkill={onSelectSkill}
      />
    </div>
  );
}

function PendingSkillReview({ pendingSkills, approvedSkills, saving, onApprove, onMerge, onReject }) {
  const firstApproved = approvedSkills.find((skill) => skill.skillId);
  return (
    <section className="panel pending-review" data-gsap="fade-up">
      <div className="panel-head">
        <div>
          <h2>Đang chờ duyệt</h2>
          <small>{pendingSkills.length} skill cần chuẩn hóa</small>
        </div>
      </div>
      <div className="pending-review-list">
        {pendingSkills.map((skill) => (
          <article key={skill.skillId}>
            <div>
              <strong>{skill.name}</strong>
              <small>{skill.category} · từ {skill.memberName}</small>
            </div>
            <div>
              <button type="button" onClick={() => onApprove(skill.skillId)} disabled={saving}>Duyệt</button>
              {firstApproved && (
                <button type="button" onClick={() => onMerge(skill.skillId, firstApproved.skillId)} disabled={saving}>
                  Merge vào {firstApproved.name}
                </button>
              )}
              <button type="button" onClick={() => onReject(skill.skillId)} disabled={saving}>Từ chối</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DesktopCompanion({ skills, members, currentMember, selectedSkill, profileSkills, onSearch, onReport, onProfile, onSelectSkill }) {
  const selected = skills.find((skill) => skill.id === selectedSkill) || skills[0] || INITIAL_SKILLS[0];
  const profileSummary = buildProfileSummary({ currentMember, profileSkills, skills });
  const topMembers = members
    .map((member) => ({
      ...member,
      level: member.skills[selected.id] || 0,
      interest: Math.max(1, Math.min(3, (member.skills[selected.id] || 0) - 1)),
    }))
    .filter((member) => member.level > 0)
    .sort((a, b) => b.level - a.level)
    .slice(0, 4);

  return (
    <aside className="desktop-companion" aria-label="Desktop preview">
      <section className="panel companion-card companion-search">
        <div className="panel-head">
          <h2>Tìm nhanh</h2>
          <button type="button" onClick={onSearch}>Mở</button>
        </div>
        <div className="skill-focus">
          <SkillIcon skill={selected} />
          <div>
            <strong>{selected.name}</strong>
            <small>{topMembers.length} người phù hợp nhất</small>
          </div>
        </div>
        <div className="mini-member-list">
          {topMembers.map((member) => (
            <button key={member.id} type="button" onClick={() => onSelectSkill(selected.id)}>
              <span className="face">{member.avatar}</span>
              <span>
                <strong>{member.name}</strong>
                <small>Level {member.level} · Quan tâm {member.interest}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel companion-card">
        <div className="panel-head">
          <h2>Hồ sơ của bạn</h2>
          <button type="button" onClick={onProfile}>Sửa</button>
        </div>
        <div className="desktop-profile">
          <ProfileAvatar summary={profileSummary} />
          <div>
            <strong>{profileSummary.name}</strong>
            <small>{profileSummary.skillCount} kỹ năng nổi bật · {profileSummary.learningCount} đang học</small>
          </div>
        </div>
        <div className="desktop-skill-tags">
          {profileSummary.featuredSkills.map((skill) => <b key={skill}>{skill}</b>)}
        </div>
      </section>

      <button className="desktop-risk" type="button" onClick={onReport} data-gsap="image-reveal">
        <span>!</span>
        <strong>Kỹ năng cần bổ sung</strong>
        <small>DevOps, Testing, Security đang thiếu mentor.</small>
        <b>Xem báo cáo →</b>
      </button>
    </aside>
  );
}

function SearchScreen({ skills, query, setQuery, selected, selectedSkill, setSelectedSkill, rows, onBack, onShowHeatmap }) {
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const selectedMember = rows.find((member) => member.id === selectedMemberId) || null;

  return (
    <div className="screen compact-screen">
      <TopBar title="Tìm theo kỹ năng" onBack={onBack} />
      <label className="inline-search">
        ⌕
        <input aria-label="Tìm kỹ năng hoặc thành viên" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}>×</button>
      </label>

      <div className="result-head">
        <strong>Kết quả ({rows.length})</strong>
        <div className="skill-chip-row" role="listbox" aria-label="Chọn kỹ năng">
          {skills.slice(0, 5).map((skill) => (
            <button
              key={skill.id}
              type="button"
              className={selectedSkill === skill.id ? 'active' : ''}
              onClick={() => {
                setSelectedSkill(skill.id);
                setQuery(skill.name);
                setSelectedMemberId(null);
              }}
            >
              <SkillIcon skill={skill} compact />
              {skill.name}
            </button>
          ))}
        </div>
      </div>

      <section className="skill-detail-card">
        <SkillIcon skill={selected} className="skill-big" />
        <div>
          <h2>{selected.name}</h2>
          <p>{rows.length} thành viên có kỹ năng này</p>
        </div>
        <div className="level-summary">
          {[4, 3, 2, 1].map((level) => (
            <span key={level}>
              <b>Lv.{level}</b>
              <small>{LEVEL_LABELS[level]}</small>
              <strong>{rows.filter((row) => row.level === level).length}</strong>
            </span>
          ))}
        </div>
        <button className="primary-wide" type="button" onClick={onShowHeatmap}>Xem heatmap với {selected.name}</button>
      </section>

      {selectedMember && (
        <section className="member-detail-card" aria-live="polite">
          <button type="button" aria-label="Đóng chi tiết thành viên" data-tooltip="Đóng" onClick={() => setSelectedMemberId(null)}>Close</button>
          <span className="face">{selectedMember.avatar}</span>
          <div>
            <strong>{selectedMember.name}</strong>
            {selectedMember.handle && <small>{selectedMember.handle}</small>}
            <p>{selected.name}: Level {selectedMember.level} · {LEVEL_LABELS[selectedMember.level]} · Quan tâm {selectedMember.interest}</p>
          </div>
        </section>
      )}

      <div className="member-list">
        {rows.map((member) => (
          <MemberResult
            member={member}
            key={member.id}
            active={selectedMemberId === member.id}
            onSelect={() => setSelectedMemberId((current) => (current === member.id ? null : member.id))}
          />
        ))}
      </div>
      {rows.length === 0 && (
        <section className="empty-panel">
          <strong>Không có thành viên phù hợp</strong>
          <p>Thử chọn kỹ năng khác hoặc xóa nội dung tìm kiếm hiện tại.</p>
        </section>
      )}
    </div>
  );
}

function MemberResult({ member, active, onSelect }) {
  return (
    <button className={`member-result${active ? ' active' : ''}`} type="button" onClick={onSelect} aria-expanded={active}>
      <span className="face">{member.avatar}</span>
      <span>
        <strong>{member.name}</strong>
        {member.handle && <small>{member.handle}</small>}
        <em className={`level-text level-text-${member.level}`}>Level {member.level} · {LEVEL_LABELS[member.level]}</em>
      </span>
      <b>Quan tâm {member.interest}</b>
      <i>›</i>
    </button>
  );
}

function ProfileScreen({
  profileSkillCatalog,
  profileSkills,
  onSaveProfileSkill,
  onDeleteProfileSkill,
  saving,
  currentMember,
  onBack,
}) {
  const [draft, setDraft] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState(null);
  const skillMap = new Map(profileSkillCatalog.map((skill) => [skill.id, skill]));
  const profileSkillMap = new Map(profileSkills.map((profileSkill) => [profileSkillKey(profileSkill), profileSkill]));
  const availableSkills = profileSkillCatalog.filter(
    (skill) => skill.skillId && !profileSkills.some((profileSkill) => profileSkill.id === skill.id),
  );
  const profileSummary = buildProfileSummary({
    currentMember,
    profileSkills,
    skills: profileSkillCatalog,
  });
  const pendingProfileSkills = currentMember?.pendingSkills || [];
  const canSaveDraft = draft
    ? !saving && (draft.customSkill ? draft.skillName.trim().length > 0 : !!(draft.memberSkillId || draft.memberSkillIds?.length || draft.skillId))
    : false;

  function openAddForm() {
    const firstSkill = availableSkills[0] || profileSkillCatalog[0];
    setDraft({
      mode: 'add',
      skillId: firstSkill?.id || '',
      customSkill: !firstSkill,
      skillName: '',
      category: 'Custom',
      level: 1,
      interest: 2,
      note: '',
    });
  }

  function openEditForm(profileSkill) {
    const skill = resolveProfileSkill(profileSkill, skillMap);
    setDraft({
      mode: 'edit',
      memberSkillId: profileSkill.rowId || null,
      memberSkillIds: profileSkill.memberSkillIds || [],
      profileSkillKey: profileSkillKey(profileSkill),
      skillId: profileSkill.id,
      skill,
      customSkill: false,
      level: profileSkill.level,
      interest: profileSkill.interest,
      note: profileSkill.note || '',
    });
  }

  async function saveDraft() {
    if (!draft) return;
    setError(null);
    try {
      await onSaveProfileSkill(draft);
      setDraft(null);
    } catch (saveError) {
      setError(saveError);
    }
  }

  function requestRemoveSkill(profileSkill) {
    setPendingDeleteId(profileSkillKey(profileSkill));
  }

  function cancelRemoveSkill() {
    setPendingDeleteId(null);
  }

  async function confirmRemoveSkill() {
    if (!pendingDeleteId) return;
    const profileSkill = profileSkillMap.get(pendingDeleteId);
    if (!profileSkill) return;
    const deleteKey = pendingDeleteId;
    setError(null);
    try {
      await onDeleteProfileSkill(profileSkill);
      setDraft((current) => (current?.profileSkillKey === deleteKey ? null : current));
      setPendingDeleteId(null);
    } catch (deleteError) {
      setError(deleteError);
    }
  }

  const pendingDeleteProfileSkill = pendingDeleteId ? profileSkillMap.get(pendingDeleteId) : null;
  const pendingDeleteSkill = pendingDeleteProfileSkill ? resolveProfileSkill(pendingDeleteProfileSkill, skillMap) : null;

  return (
    <div className="screen compact-screen">
      <TopBar title="Cá nhân" onBack={onBack} action="Settings" onAction={() => setSettingsOpen((open) => !open)} />
      {settingsOpen && (
        <section className="profile-settings" aria-live="polite">
          <strong>Cài đặt cá nhân</strong>
          <p>Hồ sơ của bạn đang hiển thị trong workspace hiện tại.</p>
        </section>
      )}
      <section className="profile-card">
        <ProfileAvatar summary={profileSummary} />
        <div>
          <h2>{profileSummary.name}</h2>
          <p>{[profileSummary.handle, `${profileSummary.skillCount} kỹ năng`, `${profileSummary.learningCount} đang học`].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" onClick={openAddForm} aria-label="Thêm kỹ năng" disabled={saving}>＋</button>
      </section>

      {error && (
        <section className="data-error" role="alert">
          <strong>Không lưu được hồ sơ</strong>
          <p>{error.message}</p>
        </section>
      )}

      <div className="profile-head">
        <strong>Kỹ năng của bạn ({profileSkills.length})</strong>
        <button type="button" onClick={openAddForm} disabled={saving}>+ Thêm kỹ năng</button>
      </div>

      {draft && (
        <section className="skill-form" aria-label={draft.mode === 'edit' ? 'Sửa kỹ năng' : 'Thêm kỹ năng'}>
          <div className="skill-form-head">
            <strong>{draft.mode === 'edit' ? 'Sửa kỹ năng' : 'Thêm kỹ năng mới'}</strong>
              <button type="button" onClick={() => setDraft(null)} disabled={saving}>Đóng</button>
          </div>

          <div className="skill-picker" role="listbox" aria-label="Chọn kỹ năng">
            {(draft.mode === 'edit'
              ? [draft.skill].filter(Boolean)
              : availableSkills
            ).map((skill) => (
              <button
                key={skill.id}
                type="button"
                className={!draft.customSkill && draft.skillId === skill.id ? 'active' : ''}
                onClick={() => setDraft((current) => ({ ...current, customSkill: false, skillId: skill.id }))}
              >
                <SkillIcon skill={skill} compact />
                {skill.name}
              </button>
            ))}
            {draft.mode === 'add' && (
              <button
                type="button"
                className={draft.customSkill ? 'active' : ''}
                onClick={() => setDraft((current) => ({ ...current, customSkill: true, skillId: '' }))}
              >
                <span aria-hidden="true">＋</span>
                Đề xuất skill
              </button>
            )}
          </div>

          {draft.mode === 'add' && draft.customSkill && (
            <div className="custom-skill-fields">
              <label className="text-field">
                <span>Tên kỹ năng</span>
                <input
                  value={draft.skillName}
                  maxLength="80"
                  onChange={(event) => setDraft((current) => ({ ...current, skillName: event.target.value }))}
                  placeholder="Ví dụ: Kafka Streams, Rust, SEO..."
                />
              </label>
              <label className="text-field">
                <span>Nhóm</span>
                <input
                  value={draft.category}
                  maxLength="40"
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                  placeholder="Backend, Design, Data..."
                />
              </label>
            </div>
          )}

          <label className="range-row">
            <span>Level <b>{draft.level}</b></span>
            <input
              type="range"
              min="0"
              max="4"
              value={draft.level}
              onChange={(event) => setDraft((current) => ({ ...current, level: event.target.value }))}
            />
            <small>{LEVEL_LABELS[Number(draft.level)]}</small>
          </label>

          <label className="range-row">
            <span>Quan tâm <b>{draft.interest}</b></span>
            <input
              type="range"
              min="0"
              max="3"
              value={draft.interest}
              onChange={(event) => setDraft((current) => ({ ...current, interest: event.target.value }))}
            />
            <small>{['Không tập trung', 'Tò mò', 'Đang học', 'Muốn nhận task'][Number(draft.interest)]}</small>
          </label>

          <label className="note-field">
            <span>Ghi chú</span>
            <textarea
              rows="2"
              value={draft.note}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder="Ví dụ: đã deploy CI/CD, muốn nhận task Docker..."
            />
          </label>

          <div className="form-actions-inline">
            <button type="button" onClick={() => setDraft(null)} disabled={saving}>Hủy</button>
            <button type="button" onClick={saveDraft} disabled={!canSaveDraft}>{saving ? 'Đang lưu...' : 'Lưu kỹ năng'}</button>
          </div>
        </section>
      )}

      {pendingProfileSkills.length > 0 && (
        <section className="pending-profile">
          <strong>Đang chờ duyệt</strong>
          {pendingProfileSkills.map((skill) => (
            <div key={skill.skillId}>
              <span>{skill.name}</span>
              <small>{skill.category} · Level {skill.level}</small>
            </div>
          ))}
        </section>
      )}

      {pendingDeleteSkill && (
        <section
          className="delete-confirm"
          role="alertdialog"
          aria-labelledby="delete-confirm-title"
          aria-describedby="delete-confirm-body"
        >
          <div>
            <strong id="delete-confirm-title">Xóa kỹ năng {pendingDeleteSkill.name}?</strong>
            <p id="delete-confirm-body">Hành động này sẽ xóa kỹ năng khỏi hồ sơ của bạn. Bạn có thể thêm lại sau nếu cần.</p>
          </div>
          <div className="delete-confirm-actions">
            <button type="button" onClick={cancelRemoveSkill} disabled={saving}>Hủy</button>
            <button type="button" onClick={confirmRemoveSkill} disabled={saving}>{saving ? 'Đang xóa...' : 'Xóa kỹ năng'}</button>
          </div>
        </section>
      )}

      <div className="profile-skills">
        {profileSkills.map((profileSkill) => {
          const { id, level, interest, note, status } = profileSkill;
          const actionKey = profileSkillKey(profileSkill);
          const skill = resolveProfileSkill(profileSkill, skillMap);
          return (
            <article className="profile-skill" key={actionKey}>
              <SkillIcon skill={skill} />
              <div>
                <strong>{skill.name}</strong>
                <small>Level {level}</small>
                <em>{LEVEL_LABELS[level]}</em>
                {status === 'pending' && <small>Đang chờ duyệt</small>}
                {note && <p>{note}</p>}
              </div>
              <b>Quan tâm {interest}</b>
              <button type="button" onClick={() => openEditForm(profileSkill)} aria-label={`Sửa ${skill.name}`} data-tooltip="Sửa" disabled={saving}>Edit</button>
              <button type="button" onClick={() => requestRemoveSkill(profileSkill)} aria-label={`Xóa ${skill.name}`} data-tooltip="Xóa" disabled={saving}>Delete</button>
            </article>
          );
        })}
      </div>

      {profileSkills.length === 0 && (
        <section className="empty-panel">
          <strong>Chưa có kỹ năng cá nhân</strong>
          <p>Thêm kỹ năng đầu tiên để team thấy năng lực và mức độ quan tâm của bạn.</p>
        </section>
      )}

      <button className="add-more" type="button" onClick={openAddForm} disabled={saving}>＋ Thêm kỹ năng khác</button>
    </div>
  );
}

function profileSkillKey(profileSkill) {
  return profileSkill?.rowId || profileSkill?.sourceSkillId || profileSkill?.skillId || profileSkill?.id;
}

function resolveProfileSkill(profileSkill, skillMap) {
  return skillMap.get(profileSkill.id) || {
    id: profileSkill.id,
    name: profileSkill.name || profileSkill.id,
    category: profileSkill.category || 'Custom',
    icon: profileSkill.name?.slice(0, 2).toUpperCase() || 'SK',
    iconUrl: null,
    iconAlt: `${profileSkill.name || profileSkill.id} icon`,
  };
}

function ReportScreen({ skills, onBack }) {
  const [fullOpen, setFullOpen] = useState(false);
  const risks = skills.filter((skill) => skill.risk);
  return (
    <div className="screen compact-screen">
      <TopBar title="Kỹ năng cần bổ sung" onBack={onBack} />
      <div className="warning-box">Các kỹ năng còn ít người ở mức Thành thạo hoặc Mentor</div>
      <div className="risk-list">
        {risks.map((skill) => (
          <article className="risk-card" key={skill.id}>
            <SkillIcon skill={skill} />
            <div>
              <strong>{skill.name}</strong>
              <small>{skill.total > 0 ? `${skill.total} người ở mức 3-4` : '0 người ở mức 3-4'}</small>
              <i style={{ '--fill': `${skill.total * 14}%` }} />
            </div>
            <b>{skill.total * 14}%</b>
            <em>›</em>
          </article>
        ))}
      </div>
      {risks.length === 0 && (
        <section className="empty-panel">
          <strong>Chưa phát hiện khoảng trống kỹ năng</strong>
          <p>Team hiện có đủ tín hiệu mentor/thành thạo trên các kỹ năng đang theo dõi.</p>
        </section>
      )}
      {fullOpen && (
        <section className="full-report" aria-live="polite">
          <strong>Tóm tắt báo cáo</strong>
          <p>Ưu tiên bổ sung mentor cho Testing và Security, sau đó nâng DevOps/PostgreSQL từ mức cơ bản lên thành thạo.</p>
        </section>
      )}
      <button className="add-more" type="button" onClick={() => setFullOpen((open) => !open)}>
        {fullOpen ? 'Thu gọn báo cáo' : 'Xem full báo cáo'}
      </button>
    </div>
  );
}

function TopBar({ title, onBack, action, onAction }) {
  return (
    <header className="topbar">
      <button type="button" onClick={onBack} aria-label="Quay lại" data-tooltip="Quay lại">Back</button>
      <strong>{title}</strong>
      {action ? (
        <button type="button" onClick={onAction} aria-label={title === 'Cá nhân' ? 'Cài đặt cá nhân' : `${title} action`} data-tooltip={title === 'Cá nhân' ? 'Cài đặt cá nhân' : `${title} action`}>{action}</button>
      ) : (
        <span aria-hidden="true" />
      )}
    </header>
  );
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function BottomNav({ active, onChange }) {
  const items = [
    ['overview', 'Map', 'Tổng quan'],
    ['search', 'Find', 'Tìm kiếm'],
    ['profile', 'Profile', 'Cá nhân'],
    ['report', 'Risk', 'Báo cáo'],
  ];
  return (
    <nav className="bottom-nav" aria-label="Điều hướng">
      {items.map(([id, icon, label]) => (
        <button
          key={id}
          type="button"
          className={active === id ? 'active' : ''}
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <span>{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
