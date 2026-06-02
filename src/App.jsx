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
import { deriveTeamCoverage } from './lib/app/team-coverage.js';
import {
  ROLE_PRESETS,
  buildCatalogPayload,
  filterSuggestedSkills,
  suggestRoleSkillsFallback,
} from './lib/app/role-suggestions.js';
import {
  buildCoachLevelPlanRequest,
  listCoachSessions,
  saveCoachSession,
} from './lib/app/ai-coach.js';
import { STANDARD_SKILLS } from './lib/app/skill-catalog.js';

const LEVEL_LABELS = ['Học', 'Cơ bản', 'Làm được', 'Thành thạo', 'Mentor'];
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
  const teamCoverage = useMemo(() => deriveTeamCoverage({ skills, members }), [skills, members]);

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
          onCoach={() => setTab('coach')}
          profileSkills={profileSkills}
          teamCoverage={teamCoverage}
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
          ctx={ctx}
          activeScope={activeScope}
          profileSkillCatalog={skills}
          profileSkills={profileSkills}
          onSaveProfileSkill={handleSaveProfileSkill}
          onDeleteProfileSkill={handleDeleteProfileSkill}
          saving={saving}
          currentMember={members.find((member) => member.userId === ctx.userId)}
          onBack={() => setTab('overview')}
        />
      )}
      {tab === 'coach' && (
        <CoachScreen
          ctx={ctx}
          activeScope={activeScope}
          profileSkills={profileSkills}
          skillCatalog={skills}
          onBack={() => setTab('overview')}
          onProfile={() => setTab('profile')}
        />
      )}
      {tab === 'report' && <ReportScreen teamCoverage={teamCoverage} onBack={() => setTab('overview')} />}

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

function MemberAvatar({ member }) {
  if (member?.avatarUrl) {
    return (
      <span className="face face--image">
        <img src={member.avatarUrl} alt="" loading="lazy" onError={handleAssetFallback} />
        <span className="profile-avatar-fallback" hidden>{member.avatar}</span>
      </span>
    );
  }
  return <span className="face">{member?.avatar}</span>;
}

function SkillIcon({ skill, className = '', compact = false }) {
  const classes = ['skill-icon', compact ? 'skill-icon--compact' : '', className].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-hidden="true">
      {skill.iconUrl && <img src={skill.iconUrl} alt="" decoding="async" onError={handleAssetFallback} />}
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
  onCoach,
  onSelectSkill,
  selectedSkill,
  profileSkills,
  teamCoverage,
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
  const [coverageMode, setCoverageMode] = useState('grouped');
  const searchText = overviewSearch.trim();
  const normalizedSearch = normalizeText(searchText);
  const coverage = useMemo(() => deriveTeamCoverage({
    skills,
    members,
    query: overviewSearch,
    mode: coverageMode,
  }), [coverageMode, members, overviewSearch, skills]);
  const coverageStatus = normalizedSearch
    ? `${coverage.visibleRowCount} kỹ năng phù hợp`
    : coverageMode === 'needs'
      ? `${coverage.statusCounts.missing + coverage.statusCounts.thin} hành động cần xử lý`
      : coverageMode === 'growth'
        ? `${coverage.statusCounts.growing} kỹ năng đang phát triển`
        : 'Theo nhóm kỹ năng';
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

        <section className="skill-marquee" aria-label="Kỹ năng đang theo dõi" data-gsap="fade-up">
          <div className="skill-marquee-track">
            {[...skills.slice(0, 8), ...skills.slice(0, 8)].map((skill, index) => (
              <span className="skill-marquee-item" key={`${skill.id}-${index}`}>
                <SkillIcon skill={skill} compact />
                {skill.name}
              </span>
            ))}
          </div>
        </section>

        <div className="quick-grid" data-gsap="fade-up">
          <button className="quick-card" type="button" onClick={onReport}>
            <span className="quick-icon heat-icon" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i /><i />
            </span>
            <span>
              <strong>Team Coverage</strong>
              <small>Xem owner, backup và trainee</small>
            </span>
          </button>
          <button className="quick-card" type="button" onClick={onSearch}>
            <span className="quick-people" aria-hidden="true">2x</span>
            <span>
              <strong>Tìm theo kỹ năng</strong>
              <small>Tìm người phù hợp</small>
            </span>
          </button>
          <button className="quick-card" type="button" onClick={onCoach}>
            <span className="quick-icon coach-icon" aria-hidden="true">
              <i /><i /><i />
            </span>
            <span>
              <strong>AI Coach</strong>
              <small>Lập kế hoạch nâng level</small>
            </span>
          </button>
        </div>

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
          <button className="filter-pill" type="button" data-tooltip="Lọc Team Coverage" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>
            <span aria-hidden="true">Filter</span>
            Bộ lọc
          </button>
        </div>

        {filterOpen && (
          <section className="filter-panel" aria-label="Bộ lọc Team Coverage">
            <button type="button" className={coverageMode === 'grouped' ? 'active' : ''} onClick={() => setCoverageMode('grouped')}>Theo nhóm</button>
            <button type="button" className={coverageMode === 'needs' ? 'active' : ''} onClick={() => setCoverageMode('needs')}>Cần xử lý</button>
            <button type="button" className={coverageMode === 'growth' ? 'active' : ''} onClick={() => setCoverageMode('growth')}>Đang phát triển</button>
            <button type="button" onClick={() => setOverviewSearch('')}>Xóa tìm kiếm</button>
          </section>
        )}

        <section className="panel coverage-panel" data-gsap="image-reveal">
          <div className="panel-head">
            <div>
              <h2>Team Coverage</h2>
              <small>{coverageStatus}</small>
            </div>
            <button
              className="tiny-select"
              type="button"
              aria-label="Đổi chế độ Team Coverage"
              onClick={() => setCoverageMode((mode) => {
                if (mode === 'grouped') return 'needs';
                if (mode === 'needs') return 'growth';
                return 'grouped';
              })}
            >
              {coverageMode === 'grouped' ? 'Theo nhóm' : coverageMode === 'needs' ? 'Cần xử lý' : 'Đang phát triển'}⌄
            </button>
          </div>
          <div className="coverage-groups">
            {coverage.groups.map((group) => (
              <section className="coverage-group" key={group.category}>
                <header>
                  <div>
                    <strong>{group.category}</strong>
                    <small>{group.skillCount} kỹ năng</small>
                  </div>
                  <div className="coverage-counts" aria-label={`Tổng quan ${group.category}`}>
                    <span className="status-missing">{group.missingCount}</span>
                    <span className="status-thin">{group.thinCount}</span>
                    <span className="status-growing">{group.growingCount}</span>
                    <span className="status-healthy">{group.healthyCount}</span>
                  </div>
                </header>

                <div className="coverage-rows">
                  {group.rows.map((row) => (
                    <button className="coverage-row" key={row.skill.id} type="button" onClick={() => onSelectSkill(row.skill.id)}>
                      <span className="coverage-skill">
                        <SkillIcon skill={row.skill} compact />
                        <span>
                          <strong>{row.skill.name}</strong>
                          <small>{row.action}</small>
                        </span>
                      </span>
                      <span className={`coverage-status coverage-status--${row.status}`}>{coverageStatusLabel(row.status)}</span>
                      <span className="coverage-owner">
                        {row.primary ? <MemberAvatar member={row.primary} /> : <i aria-hidden="true">?</i>}
                        <span>
                          <small>Primary</small>
                          <strong>{row.primary?.name || 'Chưa có'}</strong>
                        </span>
                      </span>
                      <span className="coverage-metric">
                        <small>Backup</small>
                        <strong>{row.backups.length}</strong>
                      </span>
                      <span className="coverage-metric">
                        <small>Trainee</small>
                        <strong>{row.trainees.length}</strong>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {coverage.visibleRowCount === 0 && (
            <div className="heat-empty">
              <strong>Chưa tìm thấy coverage phù hợp</strong>
              <span>Thử tìm theo kỹ năng, nhóm kỹ năng hoặc tên thành viên.</span>
            </div>
          )}
          {searchText && (
            <div className="search-hint">
              Đang lọc theo <strong>{searchText}</strong>. Board chỉ hiển thị kỹ năng, nhóm hoặc thành viên khớp.
            </div>
          )}
          <div className="coverage-legend">
            <span><i className="status-missing" />Missing</span>
            <span><i className="status-thin" />Thin</span>
            <span><i className="status-growing" />Growing</span>
            <span><i className="status-healthy" />Healthy</span>
          </div>
        </section>

        <button className="gap-banner" type="button" onClick={onReport} data-gsap="image-reveal">
          <span aria-hidden="true">Gap</span>
          <span>
            <strong>Hành động ưu tiên</strong>
            <small>{teamCoverage.actions.length ? `${teamCoverage.actions.length} điểm coverage cần xử lý.` : 'Team chưa có điểm coverage cần xử lý.'}</small>
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
            <p>Mỗi hàng coverage biến thành tín hiệu cho owner, backup, mentoring và kế hoạch học tập tiếp theo.</p>
          </div>
          <div className="motion-stack">
            {teamCoverage.actions.slice(0, 3).map((row, index) => (
              <article key={row.skill.id} data-gsap="image-reveal">
                <div className="motion-image" data-skill-state={row.status === 'healthy' ? 'stable' : 'risk'} aria-hidden="true" />
                <span>{String(index + 1).padStart(2, '0')}</span>
                <em className={`coverage-status coverage-status--${row.status}`}>{coverageStatusLabel(row.status)}</em>
                <strong>{row.skill.name}</strong>
                <small>{row.action}</small>
              </article>
            ))}
            {teamCoverage.actions.length === 0 && (
              <article data-gsap="image-reveal">
                <div className="motion-image" data-skill-state="stable" aria-hidden="true" />
                <span>01</span>
                <strong>Coverage ổn định</strong>
                <small>Chưa có hành động ưu tiên trong dữ liệu hiện tại.</small>
              </article>
            )}
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
              <MemberAvatar member={member} />
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
        <button className="primary-wide" type="button" onClick={onShowHeatmap}>Xem Team Coverage với {selected.name}</button>
      </section>

      {selectedMember && (
        <section className="member-detail-card" aria-live="polite">
          <button type="button" aria-label="Đóng chi tiết thành viên" data-tooltip="Đóng" onClick={() => setSelectedMemberId(null)}>Close</button>
          <MemberAvatar member={selectedMember} />
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
      <MemberAvatar member={member} />
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
  ctx,
  activeScope,
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
  const [roleText, setRoleText] = useState('AI Engineer');
  const [roleSuggesting, setRoleSuggesting] = useState(false);
  const [roleSuggestionError, setRoleSuggestionError] = useState(null);
  const [roleSuggestionSource, setRoleSuggestionSource] = useState(null);
  const [roleSuggestions, setRoleSuggestions] = useState([]);
  const skillMap = new Map(profileSkillCatalog.map((skill) => [skill.id, skill]));
  const profileSkillMap = new Map(profileSkills.map((profileSkill) => [profileSkillKey(profileSkill), profileSkill]));
  const availableSkills = profileSkillCatalog.filter(
    (skill) => skill.skillId && !profileSkills.some((profileSkill) => profileSkill.id === skill.id),
  );
  const visibleRoleSuggestions = useMemo(() => filterSuggestedSkills({
    suggestions: roleSuggestions,
    profileSkillCatalog,
    profileSkills,
  }), [profileSkillCatalog, profileSkills, roleSuggestions]);
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

  function applyFallbackRoleSuggestions(nextRoleText) {
    const fallback = suggestRoleSkillsFallback(nextRoleText, STANDARD_SKILLS, 10);
    setRoleSuggestions(fallback);
    setRoleSuggestionSource(fallback.length ? 'fallback' : 'empty');
    return fallback;
  }

  async function requestRoleSuggestions(nextRoleText = roleText) {
    const trimmedRole = String(nextRoleText || '').trim();
    setRoleText(trimmedRole);
    setRoleSuggestionError(null);

    if (!trimmedRole) {
      setRoleSuggestions([]);
      setRoleSuggestionSource('empty');
      return;
    }

    setRoleSuggesting(true);
    try {
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.token}`,
          'X-Workspace-Id': activeScope.workspaceId,
          'X-Home-Workspace-Id': ctx.workspaceId,
        },
        body: JSON.stringify({
          action: 'suggest_role_skills',
          roleText: trimmedRole,
          catalog: buildCatalogPayload(STANDARD_SKILLS),
          maxSuggestions: 10,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || `role suggestion failed: ${response.status}`);
      }
      const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];
      setRoleSuggestions(suggestions);
      setRoleSuggestionSource(suggestions.length ? 'ai' : 'empty');
    } catch (suggestError) {
      setRoleSuggestionError(suggestError);
      applyFallbackRoleSuggestions(trimmedRole);
    } finally {
      setRoleSuggesting(false);
    }
  }

  function selectRoleSuggestion(skill) {
    setDraft((current) => ({
      ...current,
      customSkill: false,
      skillId: skill.id,
    }));
  }

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

          {draft.mode === 'add' && (
            <section className="role-suggestion-panel" aria-label="Gợi ý kỹ năng theo role">
              <div className="role-suggestion-head">
                <label className="text-field">
                  <span>Role</span>
                  <input
                    value={roleText}
                    maxLength="80"
                    onChange={(event) => setRoleText(event.target.value)}
                    placeholder="Ví dụ: AI engineer, frontend dev..."
                  />
                </label>
                <button type="button" onClick={() => requestRoleSuggestions()} disabled={saving || roleSuggesting}>
                  {roleSuggesting ? 'Đang gợi ý...' : 'Gợi ý skill'}
                </button>
              </div>
              <div className="role-chip-row" aria-label="Role phổ biến">
                {ROLE_PRESETS.map((role) => (
                  <button
                    key={role.label}
                    type="button"
                    onClick={() => requestRoleSuggestions(role.label)}
                    disabled={saving || roleSuggesting}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
              {roleSuggestionError && roleSuggestionSource === 'fallback' && (
                <p className="role-suggestion-note">AI chưa sẵn sàng, đang dùng gợi ý mặc định.</p>
              )}
              {roleSuggestionSource === 'empty' && !roleSuggesting && (
                <p className="role-suggestion-note">Chưa tìm thấy gợi ý phù hợp trong catalog.</p>
              )}
              {visibleRoleSuggestions.length > 0 && (
                <div className="role-suggestion-results">
                  {visibleRoleSuggestions.map(({ skill, reason }) => (
                    <button
                      key={skill.id}
                      type="button"
                      className={draft.skillId === skill.id && !draft.customSkill ? 'active' : ''}
                      onClick={() => selectRoleSuggestion(skill)}
                    >
                      <SkillIcon skill={skill} compact />
                      <span>
                        <strong>{skill.name}</strong>
                        {reason && <small>{reason}</small>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

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

function CoachScreen({ ctx, activeScope, profileSkills, skillCatalog, onBack, onProfile }) {
  const [goalText, setGoalText] = useState('');
  const [latestPlan, setLatestPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const skillMap = useMemo(() => new Map(skillCatalog.map((skill) => [skill.id, skill])), [skillCatalog]);
  const hasProfileSkills = profileSkills.length > 0;
  const canGenerate = hasProfileSkills && goalText.trim() && !generating;

  const reloadSessions = useCallback(async () => {
    setLoadingHistory(true);
    setLatestPlan(null);
    setSessions([]);
    try {
      const rows = await listCoachSessions({
        supabase: db,
        workspaceId: activeScope.workspaceId,
        userId: ctx.userId,
        limit: 10,
      });
      setSessions(rows);
      setLatestPlan(rows[0] || null);
    } catch (historyError) {
      setError(historyError);
    } finally {
      setLoadingHistory(false);
    }
  }, [activeScope.workspaceId, ctx.userId]);

  useEffect(() => {
    reloadSessions();
  }, [reloadSessions]);

  async function generatePlan() {
    const request = buildCoachLevelPlanRequest({
      goalText,
      profileSkills,
      levelLabels: LEVEL_LABELS,
      maxItems: 6,
    });
    if (!request.goalText || !request.profileSkills.length) return;

    setGenerating(true);
    setError(null);
    setSaveError(null);
    try {
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.token}`,
          'X-Workspace-Id': activeScope.workspaceId,
          'X-Home-Workspace-Id': ctx.workspaceId,
        },
        body: JSON.stringify(request),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || `coach failed: ${response.status}`);
      }

      const transientPlan = {
        id: `local-${Date.now()}`,
        workspace_id: activeScope.workspaceId,
        user_id: ctx.userId,
        goal_text: request.goalText,
        summary: json.summary,
        items: json.items || [],
        created_at: new Date().toISOString(),
      };
      setLatestPlan(transientPlan);

      try {
        const saved = await saveCoachSession({
          supabase: db,
          workspaceId: activeScope.workspaceId,
          userId: ctx.userId,
          goalText: request.goalText,
          plan: json,
        });
        setLatestPlan(saved);
        await reloadSessions();
      } catch (sessionError) {
        setSaveError(sessionError);
      }
    } catch (coachError) {
      setError(coachError);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="screen compact-screen coach-screen">
      <TopBar title="AI Coach" onBack={onBack} />

      {!hasProfileSkills && (
        <section className="empty-panel">
          <strong>Chưa có kỹ năng cá nhân</strong>
          <p>Thêm kỹ năng trong hồ sơ trước khi tạo kế hoạch nâng level.</p>
          <button type="button" onClick={onProfile}>Mở hồ sơ cá nhân</button>
        </section>
      )}

      {hasProfileSkills && (
        <section className="coach-goal-panel">
          <label className="text-field">
            <span>Mục tiêu</span>
            <textarea
              rows="3"
              value={goalText}
              maxLength="240"
              onChange={(event) => setGoalText(event.target.value)}
              placeholder="Ví dụ: Muốn lên Middle Frontend, muốn cải thiện Docker..."
            />
          </label>
          <button type="button" onClick={generatePlan} disabled={!canGenerate}>
            {generating ? 'Đang tạo...' : 'Tạo kế hoạch'}
          </button>
        </section>
      )}

      {error && (
        <section className="data-error" role="alert">
          <strong>Chưa tạo được kế hoạch</strong>
          <p>{error.message}</p>
        </section>
      )}

      {saveError && (
        <section className="data-error" role="alert">
          <strong>Kế hoạch đã tạo nhưng chưa lưu vào lịch sử</strong>
          <p>{saveError.message}</p>
        </section>
      )}

      {latestPlan && (
        <CoachPlanCard session={latestPlan} skillMap={skillMap} featured />
      )}

      <section className="coach-history">
        <header>
          <strong>Lịch sử coach</strong>
          <small>{loadingHistory ? 'Đang tải...' : `${sessions.length} phiên gần nhất`}</small>
        </header>
        {sessions.map((session) => (
          <button key={session.id} type="button" onClick={() => setLatestPlan(session)}>
            <span>{session.goal_text}</span>
            <small>{formatDateTime(session.created_at)}</small>
          </button>
        ))}
        {!loadingHistory && sessions.length === 0 && hasProfileSkills && (
          <p>Chưa có lịch sử. Tạo kế hoạch đầu tiên để lưu lại.</p>
        )}
      </section>
    </div>
  );
}

function CoachPlanCard({ session, skillMap, featured = false }) {
  return (
    <section className={featured ? 'coach-plan coach-plan--featured' : 'coach-plan'}>
      <header>
        <span>{formatDateTime(session.created_at)}</span>
        <strong>{session.goal_text}</strong>
        <p>{session.summary}</p>
      </header>
      <div className="coach-plan-items">
        {(session.items || []).map((item) => {
          const skill = skillMap.get(item.skill_id) || { name: item.skill_id, icon: 'SK', iconUrl: null };
          return (
            <article className="coach-plan-item" key={item.skill_id}>
              <SkillIcon skill={skill} compact />
              <div>
                <strong>{skill.name}</strong>
                <small>{LEVEL_LABELS[item.current_level]} {'->'} {LEVEL_LABELS[item.target_level]}</small>
                <p>{item.reason}</p>
                <em>{item.next_step}</em>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function ReportScreen({ teamCoverage, onBack }) {
  const [fullOpen, setFullOpen] = useState(false);
  const actions = teamCoverage?.actions ?? [];
  const critical = actions.filter((row) => row.status === 'missing');
  const thin = actions.filter((row) => row.status === 'thin');
  const growth = actions.filter((row) => row.status === 'growing');
  const groups = [
    { id: 'critical', title: 'Critical', rows: critical },
    { id: 'thin', title: 'Thin coverage', rows: thin },
    { id: 'growth', title: 'Growth opportunity', rows: growth },
  ].filter((group) => group.rows.length > 0);

  return (
    <div className="screen compact-screen">
      <TopBar title="Hành động ưu tiên" onBack={onBack} />
      <div className="warning-box">Danh sách này dựa trên primary owner, backup và trainee hiện có trong team.</div>

      <div className="risk-list action-report-list">
        {groups.map((group) => (
          <section className="action-report-group" key={group.id}>
            <header>
              <strong>{group.title}</strong>
              <small>{group.rows.length} hành động</small>
            </header>
            {group.rows.map((row) => (
              <article className="risk-card action-card" key={row.skill.id}>
                <SkillIcon skill={row.skill} />
                <div>
                  <strong>{row.skill.name}</strong>
                  <small>{row.category} · {row.action}</small>
                  <span>
                    Primary: {row.primary?.name || 'Chưa có'} · Backup: {row.backups.length} · Trainee: {row.trainees.length}
                  </span>
                </div>
                <b className={`coverage-status coverage-status--${row.status}`}>{coverageStatusLabel(row.status)}</b>
                <em aria-hidden="true">›</em>
              </article>
            ))}
          </section>
        ))}
      </div>

      {actions.length === 0 && (
        <section className="empty-panel">
          <strong>Chưa có hành động coverage ưu tiên</strong>
          <p>Team hiện có primary và backup đủ tốt cho các kỹ năng đang theo dõi.</p>
        </section>
      )}

      {fullOpen && (
        <section className="full-report" aria-live="polite">
          <strong>Tóm tắt báo cáo</strong>
          <p>{buildCoverageReportSummary(teamCoverage)}</p>
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

function coverageStatusLabel(status) {
  if (status === 'missing') return 'Missing';
  if (status === 'thin') return 'Thin';
  if (status === 'growing') return 'Growing';
  return 'Healthy';
}

function buildCoverageReportSummary(teamCoverage) {
  const statusCounts = teamCoverage?.statusCounts ?? {};
  const missing = statusCounts.missing ?? 0;
  const thin = statusCounts.thin ?? 0;
  const growing = statusCounts.growing ?? 0;
  if (missing + thin + growing === 0) {
    return 'Không có khoảng trống coverage nổi bật trong dữ liệu hiện tại.';
  }
  return `Ưu tiên xử lý ${missing} kỹ năng thiếu primary, ${thin} kỹ năng thiếu backup, và ${growing} kỹ năng có trainee cần được dẫn dắt.`;
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
