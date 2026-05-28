import React, { useMemo, useState } from 'react';
import MemberDetailModal from './components/MemberDetailModal.jsx';
import ScopeSwitcher from './components/ScopeSwitcher.jsx';
import ShareManageModal from './components/ShareManageModal.jsx';
import SkillStatusBadge from './components/SkillStatusBadge.jsx';
import SkillTypeahead from './components/SkillTypeahead.jsx';
import { useDialog } from './components/Dialog.jsx';
import { tryGetContext } from './lib/context.js';
import {
  deleteMemberSkill,
  endorseMemberSkill,
  findOrCreateSkill,
  removeEndorsement,
  saveMemberSkill,
  updateMemberSkillStatus,
} from './lib/skill-map-api.js';
import { isSkillMapMockMode } from './lib/skill-map-mock.js';
import { useSkillMapData } from './lib/useSkillMapData.js';
import {
  displayNameForMember,
  getOnboardingSkillSuggestions,
  rankSkillMatches,
  shouldShowSkillOnboarding,
} from './lib/skill-map-utils.js';
import './App.css';

export default function App() {
  const mockMode = typeof window !== 'undefined' && isSkillMapMockMode(window.location.href, import.meta.env.DEV);
  const { error: contextError } = mockMode ? { error: null } : tryGetContext();
  if (!mockMode && contextError) {
    return (
      <div className="mushy-page skill-map-page">
        <section className="mushy-card error-card">
          {contextError.message}
        </section>
      </div>
    );
  }

  return <SkillMapApp />;
}

function SkillMapApp() {
  const dialog = useDialog();
  const { activeScope, ctx, ctxError, dataset, error, index, loading, mockMode, mockStore, refresh } = useSkillMapData();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [selectedSkillId, setSelectedSkillId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentScopeMember = ctx ? dataset.members.find((member) => member.user_id === ctx.userId) : null;
  const currentUserRole = currentScopeMember?.role || ctx?.role || 'member';
  const canEditOwnProfile = Boolean(currentScopeMember);
  const isCurrentUserAdmin = ['owner', 'admin'].includes(currentUserRole);
  const mySkills = ctx && canEditOwnProfile ? index.memberSkillsByUser.get(ctx.userId) || [] : [];
  const selectedMember = dataset.members.find((member) => member.user_id === selectedMemberId);
  const selectedMemberSkills = selectedMemberId ? index.memberSkillsByUser.get(selectedMemberId) || [] : [];
  const showOnboarding = shouldShowSkillOnboarding({ canEditOwnProfile, loading, mySkills });

  const visibleSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dataset.skills
      .filter((skill) => groupId === 'all' || skill.group_id === groupId)
      .filter((skill) => !normalizedQuery || skill.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [dataset.skills, groupId, query]);

  const activeSkill = visibleSkills.find((skill) => skill.id === selectedSkillId) || visibleSkills[0] || null;
  const activeSkillAlreadyMine = activeSkill ? mySkills.some((row) => row.skill_id === activeSkill.id) : false;
  const canAddActiveSkill = Boolean(canEditOwnProfile && activeSkill && !activeSkillAlreadyMine);

  const onboardingSuggestions = useMemo(() => getOnboardingSkillSuggestions({
    groups: dataset.groups,
    skills: dataset.skills,
    memberSkills: dataset.memberSkills,
    userId: ctx?.userId,
    limit: 6,
  }), [ctx?.userId, dataset.groups, dataset.memberSkills, dataset.skills]);

  const rankedResults = useMemo(() => {
    if (!activeSkill) return [];
    return rankSkillMatches({
      members: dataset.members,
      skills: dataset.skills,
      memberSkills: dataset.memberSkills,
      endorsements: dataset.endorsements,
      skillId: activeSkill.id,
    });
  }, [activeSkill, dataset]);

  async function runMutation(action, errorTitle) {
    setSaving(true);
    try {
      await action();
      refresh();
    } catch (e) {
      await dialog.error(errorTitle, e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addSkill({ groupId: nextGroupId, name, status }) {
    if (!canEditOwnProfile) {
      await dialog.error('Không thể cập nhật profile', 'Bạn chỉ sửa skill profile trong workspace mà bạn là member trực tiếp.');
      return;
    }

    await runMutation(async () => {
      const skill = mockMode ? mockStore.findOrCreateSkill({
        workspaceId: activeScope.workspaceId,
        groupId: nextGroupId,
        name,
        createdBy: ctx.userId,
      }) : await findOrCreateSkill({
        workspaceId: activeScope.workspaceId,
        groupId: nextGroupId,
        name,
        createdBy: ctx.userId,
      });

      if (mockMode) {
        mockStore.addMemberSkill({
          workspaceId: activeScope.workspaceId,
          userId: ctx.userId,
          skillId: skill.id,
          status,
        });
      } else {
        await saveMemberSkill({
          workspaceId: activeScope.workspaceId,
          userId: ctx.userId,
          skillId: skill.id,
          status,
        });
      }

      setSelectedSkillId(skill.id);
    }, 'Không thêm được skill');
  }

  async function quickAddSkill(skill) {
    if (!canEditOwnProfile || !ctx || !skill) return;

    await runMutation(async () => {
      if (mockMode) {
        mockStore.addMemberSkill({
          workspaceId: activeScope.workspaceId,
          userId: ctx.userId,
          skillId: skill.id,
          status: 'usable',
        });
      } else {
        await saveMemberSkill({
          workspaceId: activeScope.workspaceId,
          userId: ctx.userId,
          skillId: skill.id,
          status: 'usable',
        });
      }
      setSelectedSkillId(skill.id);
    }, 'Không thêm được skill');
  }

  async function changeStatus(row, status) {
    await runMutation(
      () => (mockMode ? mockStore.updateMemberSkillStatus({
        id: row.id,
        workspaceId: activeScope.workspaceId,
        status,
      }) : updateMemberSkillStatus({ id: row.id, workspaceId: activeScope.workspaceId, status })),
      'Không cập nhật được skill',
    );
  }

  async function deleteSkill(row) {
    const ok = await dialog.confirm('Xóa skill khỏi profile?', row.skill?.name || 'Skill này', {
      danger: true,
      confirmLabel: 'Xóa',
      cancelLabel: 'Hủy',
    });
    if (!ok) return;
    await runMutation(
      () => (mockMode
        ? mockStore.deleteMemberSkill({ id: row.id, workspaceId: activeScope.workspaceId })
        : deleteMemberSkill({ id: row.id, workspaceId: activeScope.workspaceId })),
      'Không xóa được skill',
    );
  }

  async function endorse(row) {
    await runMutation(
      () => (mockMode ? mockStore.endorseMemberSkill({
        workspaceId: activeScope.workspaceId,
        memberSkill: row,
        currentUserRole,
      }) : endorseMemberSkill({
        workspaceId: activeScope.workspaceId,
        memberSkill: row,
        currentUserRole,
      })),
      'Không endorse được skill',
    );
  }

  async function removeEndorsementRow(row) {
    await runMutation(
      () => (mockMode
        ? mockStore.removeEndorsement({ id: row.id, workspaceId: activeScope.workspaceId })
        : removeEndorsement({ id: row.id, workspaceId: activeScope.workspaceId })),
      'Không gỡ được endorsement',
    );
  }

  if (ctxError) {
    return (
      <div className="mushy-page">
        <section className="mushy-card error-card">{ctxError.message}</section>
      </div>
    );
  }

  return (
    <div className="mushy-page skill-map-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">Team Skill Map</p>
          <h1>Ai mạnh mảng nào?</h1>
          <p>Tìm người support đúng kỹ năng trong workspace.</p>
        </div>
        {mockMode ? (
          <span className="mushy-btn mushy-btn--ghost" style={{ pointerEvents: 'none' }}>
            Mock Team
          </span>
        ) : (
          <ScopeSwitcher onManageGrants={() => setShareOpen(true)} />
        )}
      </header>

      {error && (
        <section className="mushy-card error-card">
          Không tải được dữ liệu: {error.message}
        </section>
      )}

      {showOnboarding && (
        <QuickStartPanel
          saving={saving}
          suggestions={onboardingSuggestions}
          onAddSkill={quickAddSkill}
        />
      )}

      <main className="main-grid">
        <section className="mushy-card explore-panel">
          <div className="section-head">
            <div>
              <h2>Explore</h2>
              <p>Tìm skill, xem ai phù hợp nhất.</p>
            </div>
            {loading && <span className="mushy-spinner" />}
          </div>

          <div className="filters">
            <input
              className="mushy-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skill..."
            />
            <div className="chip-row">
              <button className={groupId === 'all' ? 'chip chip--active' : 'chip'} type="button" onClick={() => setGroupId('all')}>
                Tất cả
              </button>
              {dataset.groups.map((group) => (
                <button
                  key={group.id}
                  className={groupId === group.id ? 'chip chip--active' : 'chip'}
                  type="button"
                  onClick={() => setGroupId(group.id)}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </div>

          <SkillResults
            activeSkill={activeSkill}
            index={index}
            loading={loading}
            rankedResults={rankedResults}
            selectedSkillId={selectedSkillId}
            skills={visibleSkills}
            canAddActiveSkill={canAddActiveSkill}
            onAddActiveSkill={quickAddSkill}
            onOpenMember={setSelectedMemberId}
            onPickSkill={setSelectedSkillId}
          />
        </section>

        <section className="mushy-card my-skills-panel">
          <div className="section-head">
            <div>
              <h2>My Skills</h2>
              <p>Cập nhật skill bạn có thể chia sẻ với team.</p>
            </div>
          </div>

          {!canEditOwnProfile && !loading ? (
            <div className="profile-readonly">
              Bạn đang xem scope được chia sẻ hoặc workspace mà bạn không phải member trực tiếp. Skill profile chỉ cập nhật trong workspace của bạn.
            </div>
          ) : (
            <>
              <SkillTypeahead
                groups={dataset.groups}
                skills={dataset.skills}
                disabled={saving || loading || !ctx}
                onSubmit={addSkill}
              />

              <div className="my-skill-list">
                {mySkills.length === 0 && (
                  <p className="empty-copy">
                    Bạn chưa khai báo skill nào. Chọn nhanh ở phần gợi ý phía trên hoặc nhập skill riêng tại đây.
                  </p>
                )}
                {mySkills.map((row) => (
                  <div className="my-skill-row" key={row.id}>
                    <div>
                      <strong>{row.skill?.name}</strong>
                      <span>{row.skill?.group?.name || 'Khác'}</span>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="ghost-link"
                        onClick={() => changeStatus(row, row.status === 'usable' ? 'learning' : 'usable')}
                      >
                        <SkillStatusBadge status={row.status} />
                      </button>
                      <button type="button" className="text-danger" onClick={() => deleteSkill(row)}>Xóa</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      {selectedMember && (
        <MemberDetailModal
          currentUserId={ctx?.userId}
          isCurrentUserAdmin={isCurrentUserAdmin}
          member={selectedMember}
          memberSkills={selectedMemberSkills}
          onClose={() => setSelectedMemberId(null)}
          onEndorse={endorse}
          onRemoveEndorsement={removeEndorsementRow}
        />
      )}

      {!mockMode && <ShareManageModal open={shareOpen} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function SkillResults({
  activeSkill,
  canAddActiveSkill,
  index,
  loading,
  onAddActiveSkill,
  onOpenMember,
  onPickSkill,
  rankedResults,
  skills,
}) {
  if (loading) return <p className="empty-copy">Đang tải skill map...</p>;
  if (skills.length === 0) return <p className="empty-copy">Không tìm thấy skill phù hợp.</p>;

  return (
    <div className="results">
      <div className="skill-picker">
        {skills.slice(0, 12).map((skill) => (
          <button
            key={skill.id}
            className={activeSkill?.id === skill.id ? 'skill-pill skill-pill--active' : 'skill-pill'}
            type="button"
            onClick={() => onPickSkill(skill.id)}
          >
            {skill.name}
          </button>
        ))}
      </div>

      {activeSkill && (
        <div className="target-skill">
          <span>Đang xem</span>
          <strong>{activeSkill.name}</strong>
        </div>
      )}

      {rankedResults.length === 0 ? (
        <div className="result-empty">
          <h3>{activeSkill?.name}</h3>
          <p>Chưa có ai khai báo skill này.</p>
          {canAddActiveSkill && activeSkill && (
            <button
              className="mushy-btn mushy-btn--primary result-empty__action"
              type="button"
              onClick={() => onAddActiveSkill(activeSkill)}
            >
              Thêm skill này vào profile
            </button>
          )}
        </div>
      ) : rankedResults.map((result) => {
        const related = index.memberSkillsByUser.get(result.member.user_id) || [];
        return (
          <button
            className="member-card"
            key={result.memberSkill.id}
            type="button"
            onClick={() => onOpenMember(result.member.user_id)}
          >
            <div className="avatar">{initials(displayNameForMember(result.member))}</div>
            <div className="member-card__body">
              <div className="member-card__top">
                <strong>{displayNameForMember(result.member)}</strong>
                <SkillStatusBadge status={result.memberSkill.status} />
              </div>
              <p>{result.member.role || 'member'}{result.member.work_phone ? ` · ${result.member.work_phone}` : ''}</p>
              <div className="related-skills">
                {related.slice(0, 3).map((row) => <span key={row.id}>{row.skill?.name}</span>)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function QuickStartPanel({ saving, suggestions, onAddSkill }) {
  return (
    <section className="mushy-card quick-start">
      <div className="quick-start__copy">
        <span className="quick-start__step">Bắt đầu trong 10 giây</span>
        <h2>Khai báo 3 skill đầu tiên</h2>
        <p>
          Skill Map chỉ hữu ích khi mọi người tự khai báo vài kỹ năng. Chọn nhanh các skill bạn có thể support team.
        </p>
      </div>
      <div className="quick-start__actions" aria-label="Gợi ý skill để thêm nhanh">
        {suggestions.length === 0 ? (
          <span className="quick-start__empty">Bạn đã thêm hết các skill gợi ý hiện có.</span>
        ) : suggestions.map((skill) => (
          <button
            className="quick-skill"
            disabled={saving}
            key={skill.id}
            type="button"
            onClick={() => onAddSkill(skill)}
          >
            + {skill.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}
