import React, { useMemo, useState } from 'react';
import MemberDetailModal from './components/MemberDetailModal.jsx';
import ScopeSwitcher from './components/ScopeSwitcher.jsx';
import ShareManageModal from './components/ShareManageModal.jsx';
import SkillStatusBadge from './components/SkillStatusBadge.jsx';
import SkillTypeahead from './components/SkillTypeahead.jsx';
import { useDialog } from './components/Dialog.jsx';
import {
  deleteMemberSkill,
  endorseMemberSkill,
  findOrCreateSkill,
  removeEndorsement,
  saveMemberSkill,
  updateMemberSkillStatus,
} from './lib/skill-map-api.js';
import { useSkillMapData } from './lib/useSkillMapData.js';
import { displayNameForMember, rankSkillMatches } from './lib/skill-map-utils.js';
import './App.css';

export default function App() {
  const dialog = useDialog();
  const { activeScope, ctx, ctxError, dataset, error, index, loading, refresh } = useSkillMapData();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [selectedSkillId, setSelectedSkillId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCurrentUserAdmin = ['owner', 'admin'].includes(ctx?.role);
  const mySkills = ctx ? index.memberSkillsByUser.get(ctx.userId) || [] : [];
  const selectedMember = dataset.members.find((member) => member.user_id === selectedMemberId);
  const selectedMemberSkills = selectedMemberId ? index.memberSkillsByUser.get(selectedMemberId) || [] : [];

  const visibleSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dataset.skills
      .filter((skill) => groupId === 'all' || skill.group_id === groupId)
      .filter((skill) => !normalizedQuery || skill.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [dataset.skills, groupId, query]);

  const activeSkill = visibleSkills.find((skill) => skill.id === selectedSkillId) || visibleSkills[0] || null;

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
    await runMutation(async () => {
      const skill = await findOrCreateSkill({
        workspaceId: activeScope.workspaceId,
        groupId: nextGroupId,
        name,
        createdBy: ctx.userId,
      });
      await saveMemberSkill({
        workspaceId: activeScope.workspaceId,
        userId: ctx.userId,
        skillId: skill.id,
        status,
      });
      setSelectedSkillId(skill.id);
    }, 'Không thêm được skill');
  }

  async function changeStatus(row, status) {
    await runMutation(
      () => updateMemberSkillStatus({ id: row.id, workspaceId: activeScope.workspaceId, status }),
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
      () => deleteMemberSkill({ id: row.id, workspaceId: activeScope.workspaceId }),
      'Không xóa được skill',
    );
  }

  async function endorse(row) {
    await runMutation(
      () => endorseMemberSkill({
        workspaceId: activeScope.workspaceId,
        memberSkill: row,
        currentUserRole: activeScope.workspaceId === ctx.workspaceId ? ctx.role : 'member',
      }),
      'Không endorse được skill',
    );
  }

  async function removeEndorsementRow(row) {
    await runMutation(
      () => removeEndorsement({ id: row.id, workspaceId: activeScope.workspaceId }),
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
        <ScopeSwitcher onManageGrants={() => setShareOpen(true)} />
      </header>

      {error && (
        <section className="mushy-card error-card">
          Không tải được dữ liệu: {error.message}
        </section>
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

          <SkillTypeahead
            groups={dataset.groups}
            skills={dataset.skills}
            disabled={saving || loading || !ctx}
            onSubmit={addSkill}
          />

          <div className="my-skill-list">
            {mySkills.length === 0 && <p className="empty-copy">Bạn chưa khai báo skill nào.</p>}
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

      <ShareManageModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

function SkillResults({
  activeSkill,
  index,
  loading,
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

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}
