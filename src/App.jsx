import React, { useMemo, useState } from 'react';
import './App.css';

const SKILLS = [
  { id: 'react', name: 'React', icon: '⚛️', total: 6, risk: 0 },
  { id: 'golang', name: 'Golang', icon: '🐹', total: 4, risk: 1 },
  { id: 'docker', name: 'Docker', icon: '🐳', total: 5, risk: 0 },
  { id: 'ai', name: 'AI/ML', icon: '🧠', total: 3, risk: 1 },
  { id: 'devops', name: 'DevOps', icon: '∞', total: 1, risk: 1 },
  { id: 'testing', name: 'Testing', icon: '🧪', total: 0, risk: 1 },
  { id: 'security', name: 'Security', icon: '🛡️', total: 0, risk: 1 },
  { id: 'postgres', name: 'PostgreSQL', icon: '🐘', total: 1, risk: 1 },
];

const MEMBERS = [
  {
    id: 'nam',
    name: 'Đậu Văn Nam',
    handle: '@namdv',
    avatar: '👨🏻‍💻',
    skills: { react: 3, golang: 2, docker: 4, ai: 2, devops: 1 },
  },
  {
    id: 'my',
    name: 'Nguyễn Hà My',
    handle: '@hamy',
    avatar: '🐱',
    skills: { react: 3, golang: 2, docker: 3, ai: 2, devops: 2 },
  },
  {
    id: 'duc',
    name: 'Trần Minh Đức',
    handle: '@ducmt',
    avatar: '🧑🏻‍💼',
    skills: { react: 1, golang: 2, docker: 2, ai: 4, devops: 3 },
  },
  {
    id: 'anh',
    name: 'Lê Phương Anh',
    handle: '@anhle',
    avatar: '👩🏻‍🎨',
    skills: { react: 1, golang: 2, docker: 2, ai: 1, devops: 2 },
  },
  {
    id: 'bao',
    name: 'Phạm Quốc Bảo',
    handle: '@baopq',
    avatar: '🧑🏽‍💻',
    skills: { react: 0, golang: 3, docker: 1, ai: 0, devops: 1 },
  },
  {
    id: 'huy',
    name: 'Võ Gia Huy',
    handle: '@huyyg',
    avatar: '🧑🏻',
    skills: { react: 1, golang: 3, docker: 2, ai: 2, devops: 2 },
  },
  {
    id: 'linh',
    name: 'Mai Khánh Linh',
    handle: '@linhmk',
    avatar: '👩🏻‍💻',
    skills: { react: 4, golang: 1, docker: 3, ai: 3, devops: 0 },
  },
];

const LEVEL_LABELS = ['Học', 'Cơ bản', 'Làm được', 'Thành thạo', 'Mentor'];
const LEVEL_BADGES = ['0 Học', '1 Cơ bản', '2 Làm được', '3 Thành thạo', '4 Mentor'];
const PROFILE_SKILL_CATALOG = [
  ...SKILLS,
  { id: 'figma', name: 'Figma', icon: '🎨', total: 2, risk: 0 },
  { id: 'mobile', name: 'Mobile', icon: '📱', total: 2, risk: 0 },
  { id: 'pm', name: 'Product', icon: '🧭', total: 1, risk: 0 },
];
const INITIAL_PROFILE_SKILLS = [
  { id: 'react', level: 3, interest: 3, note: 'Component UI, state management' },
  { id: 'golang', level: 2, interest: 2, note: 'API cơ bản' },
  { id: 'docker', level: 3, interest: 3, note: 'Deploy và compose' },
  { id: 'ai', level: 2, interest: 3, note: 'Prompting, prototype AI' },
  { id: 'figma', level: 1, interest: 2, note: 'Wireframe nhanh' },
];

export default function App() {
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('Docker');
  const [selectedSkill, setSelectedSkill] = useState('docker');
  const [profileSkills, setProfileSkills] = useState(INITIAL_PROFILE_SKILLS);

  const selected = SKILLS.find((skill) => skill.id === selectedSkill) || SKILLS[2];
  const searchRows = useMemo(() => {
        const q = normalizeText(query.trim());
    return MEMBERS
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
  }, [query, selected.name, selectedSkill]);

  return (
    <main className="mushy-shell">
      {tab === 'overview' && (
        <Overview
          onSearch={() => setTab('search')}
          onReport={() => setTab('report')}
          onProfile={() => setTab('profile')}
          profileSkills={profileSkills}
          selectedSkill={selectedSkill}
          onSelectSkill={(skillId) => {
            setSelectedSkill(skillId);
            setQuery(SKILLS.find((skill) => skill.id === skillId)?.name || '');
            setTab('search');
          }}
        />
      )}

      {tab === 'search' && (
        <SearchScreen
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
          profileSkills={profileSkills}
          setProfileSkills={setProfileSkills}
          onBack={() => setTab('overview')}
        />
      )}
      {tab === 'report' && <ReportScreen onBack={() => setTab('overview')} />}

      <BottomNav active={tab} onChange={setTab} />
    </main>
  );
}

function Overview({ onSearch, onReport, onProfile, onSelectSkill, selectedSkill, profileSkills }) {
  const topSkills = SKILLS.slice(0, 4);
  const [overviewSearch, setOverviewSearch] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [heatMode, setHeatMode] = useState('top');
  const searchText = overviewSearch.trim();
  const normalizedSearch = normalizeText(searchText);
  const skillMatches = useMemo(() => {
    if (!normalizedSearch) return SKILLS.slice(0, 5);
    const matches = SKILLS.filter((skill) => normalizeText(skill.name).includes(normalizedSearch));
    return matches.length ? matches.slice(0, 5) : SKILLS.slice(0, 5);
  }, [normalizedSearch]);
  const memberMatches = useMemo(() => {
    if (!normalizedSearch) return MEMBERS.slice(0, 6);
    const matchedSkillIds = SKILLS
      .filter((skill) => normalizeText(skill.name).includes(normalizedSearch))
      .map((skill) => skill.id);
    return MEMBERS.filter((member) => {
      const memberText = normalizeText(`${member.name} ${member.handle}`);
      const matchesMember = memberText.includes(normalizedSearch);
      const matchesSkill = matchedSkillIds.some((skillId) => (member.skills[skillId] || 0) > 0);
      return matchesMember || matchesSkill;
    });
  }, [normalizedSearch]);
  const heatSkills = heatMode === 'risk'
    ? SKILLS.filter((skill) => skill.risk).slice(0, 5)
    : skillMatches;
  const heatMembers = memberMatches.slice(0, 6);
  const searchMode = normalizedSearch
    ? `${memberMatches.length} kết quả phù hợp`
    : heatMode === 'risk'
      ? 'Hiển thị kỹ năng cần bổ sung'
      : 'Hiển thị top kỹ năng';
  const profileSkillMap = new Map(PROFILE_SKILL_CATALOG.map((skill) => [skill.id, skill]));
  const learningCount = profileSkills.filter((skill) => skill.level <= 2).length;
  const featuredProfileSkills = profileSkills.slice(0, 4).map((skill) => profileSkillMap.get(skill.id)?.name || skill.id);

  return (
    <div className="screen screen--overview">
      <div className="overview-main">
        <header className="home-header">
          <img className="mushy-avatar" src="/mushy.png" alt="Mushy" />
          <div>
            <h1>Skill Map</h1>
            <p>Hiểu năng lực team, hợp lực phát triển 🚀</p>
          </div>
          <button className="ghost-icon" type="button" aria-label="Thông báo" aria-expanded={noticeOpen} onClick={() => setNoticeOpen((open) => !open)}>🔔</button>
          <button className="ghost-icon" type="button" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋮</button>
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

        <div className="quick-grid">
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
            <span className="quick-people" aria-hidden="true">👫</span>
            <span>
              <strong>Tìm theo kỹ năng</strong>
              <small>Tìm người phù hợp</small>
            </span>
          </button>
        </div>

        <div className="search-row">
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
          <button className="filter-pill" type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>⚗ Bộ lọc</button>
        </div>

        {filterOpen && (
          <section className="filter-panel" aria-label="Bộ lọc heatmap">
            <button type="button" className={heatMode === 'top' ? 'active' : ''} onClick={() => setHeatMode('top')}>Top kỹ năng</button>
            <button type="button" className={heatMode === 'risk' ? 'active' : ''} onClick={() => setHeatMode('risk')}>Cần bổ sung</button>
            <button type="button" onClick={() => setOverviewSearch('')}>Xóa tìm kiếm</button>
          </section>
        )}

        <section className="panel heat-panel">
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
                      <span>{skill.icon}</span>
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
                        <small>{member.handle}</small>
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
                      <small>{member.handle}</small>
                    </span>
                  </div>
                  <div>
                    {heatSkills.map((skill) => (
                      <button key={skill.id} type="button" onClick={() => onSelectSkill(skill.id)}>
                        <span>{skill.icon} {skill.name}</span>
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

        <button className="gap-banner" type="button" onClick={onReport}>
          <span>🏆</span>
          <span>
            <strong>Kỹ năng cần bổ sung</strong>
            <small>Một số kỹ năng chưa có người ở mức Mentor hoặc Thành thạo.</small>
          </span>
          <b>Xem chi tiết →</b>
        </button>

        <section className="panel popular-panel">
          <div className="panel-head">
            <h2>Kỹ năng phổ biến trong team</h2>
            <button type="button" onClick={onSearch}>Xem tất cả</button>
          </div>
          <div className="popular-grid">
            {topSkills.map((skill) => (
              <button key={skill.id} className="popular-card" type="button" onClick={() => onSelectSkill(skill.id)}>
                <span>{skill.icon}</span>
                <strong>{skill.name}</strong>
                <small>{skill.total}/7 người</small>
                <i style={{ '--fill': `${Math.max(12, skill.total * 14)}%` }} />
              </button>
            ))}
          </div>
        </section>

        <section className="panel overview-profile-card">
          <div className="panel-head">
            <h2>Hồ sơ của bạn</h2>
            <button type="button" onClick={onProfile}>Sửa</button>
          </div>
          <div className="desktop-profile">
            <span>🐱</span>
            <div>
              <strong>Nguyễn Hà My</strong>
              <small>{profileSkills.length} kỹ năng nổi bật · {learningCount} đang học</small>
            </div>
          </div>
          <div className="desktop-skill-tags">
            {featuredProfileSkills.map((skill) => <b key={skill}>{skill}</b>)}
          </div>
        </section>
      </div>

      <DesktopCompanion
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

function DesktopCompanion({ selectedSkill, profileSkills, onSearch, onReport, onProfile, onSelectSkill }) {
  const selected = SKILLS.find((skill) => skill.id === selectedSkill) || SKILLS[2];
  const profileSkillMap = new Map(PROFILE_SKILL_CATALOG.map((skill) => [skill.id, skill]));
  const learningCount = profileSkills.filter((skill) => skill.level <= 2).length;
  const featuredProfileSkills = profileSkills.slice(0, 4).map((skill) => profileSkillMap.get(skill.id)?.name || skill.id);
  const topMembers = MEMBERS
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
          <span>{selected.icon}</span>
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
          <span>🐱</span>
          <div>
            <strong>Nguyễn Hà My</strong>
            <small>{profileSkills.length} kỹ năng nổi bật · {learningCount} đang học</small>
          </div>
        </div>
        <div className="desktop-skill-tags">
          {featuredProfileSkills.map((skill) => <b key={skill}>{skill}</b>)}
        </div>
      </section>

      <button className="desktop-risk" type="button" onClick={onReport}>
        <span>🏆</span>
        <strong>Kỹ năng cần bổ sung</strong>
        <small>DevOps, Testing, Security đang thiếu mentor.</small>
        <b>Xem báo cáo →</b>
      </button>
    </aside>
  );
}

function SearchScreen({ query, setQuery, selected, selectedSkill, setSelectedSkill, rows, onBack, onShowHeatmap }) {
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
          {SKILLS.slice(0, 5).map((skill) => (
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
              <span>{skill.icon}</span>
              {skill.name}
            </button>
          ))}
        </div>
      </div>

      <section className="skill-detail-card">
        <span className="skill-big">{selected.icon}</span>
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
          <button type="button" aria-label="Đóng chi tiết thành viên" onClick={() => setSelectedMemberId(null)}>×</button>
          <span className="face">{selectedMember.avatar}</span>
          <div>
            <strong>{selectedMember.name}</strong>
            <small>{selectedMember.handle}</small>
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
    </div>
  );
}

function MemberResult({ member, active, onSelect }) {
  return (
    <button className={`member-result${active ? ' active' : ''}`} type="button" onClick={onSelect} aria-expanded={active}>
      <span className="face">{member.avatar}</span>
      <span>
        <strong>{member.name}</strong>
        <small>{member.handle}</small>
        <em className={`level-text level-text-${member.level}`}>Level {member.level} · {LEVEL_LABELS[member.level]}</em>
      </span>
      <b>Quan tâm {member.interest}</b>
      <i>›</i>
    </button>
  );
}

function ProfileScreen({ profileSkills, setProfileSkills, onBack }) {
  const [draft, setDraft] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const skillMap = new Map(PROFILE_SKILL_CATALOG.map((skill) => [skill.id, skill]));
  const availableSkills = PROFILE_SKILL_CATALOG.filter(
    (skill) => !profileSkills.some((profileSkill) => profileSkill.id === skill.id),
  );
  const learningCount = profileSkills.filter((skill) => skill.level <= 2).length;

  function openAddForm() {
    const firstSkill = availableSkills[0] || PROFILE_SKILL_CATALOG[0];
    setDraft({
      mode: 'add',
      skillId: firstSkill.id,
      level: 1,
      interest: 2,
      note: '',
    });
  }

  function openEditForm(profileSkill) {
    setDraft({
      mode: 'edit',
      skillId: profileSkill.id,
      level: profileSkill.level,
      interest: profileSkill.interest,
      note: profileSkill.note || '',
    });
  }

  function saveDraft() {
    if (!draft) return;
    if (draft.mode === 'edit') {
      setProfileSkills((current) => current.map((skill) => (
        skill.id === draft.skillId
          ? { ...skill, level: Number(draft.level), interest: Number(draft.interest), note: draft.note.trim() }
          : skill
      )));
    } else if (!profileSkills.some((skill) => skill.id === draft.skillId)) {
      setProfileSkills((current) => [
        ...current,
        {
          id: draft.skillId,
          level: Number(draft.level),
          interest: Number(draft.interest),
          note: draft.note.trim(),
        },
      ]);
    }
    setDraft(null);
  }

  function requestRemoveSkill(skillId) {
    setPendingDeleteId(skillId);
  }

  function cancelRemoveSkill() {
    setPendingDeleteId(null);
  }

  function confirmRemoveSkill() {
    if (!pendingDeleteId) return;
    const skillId = pendingDeleteId;
    setProfileSkills((current) => current.filter((skill) => skill.id !== skillId));
    setDraft((current) => (current?.skillId === skillId ? null : current));
    setPendingDeleteId(null);
  }

  const pendingDeleteSkill = pendingDeleteId ? skillMap.get(pendingDeleteId) : null;

  return (
    <div className="screen compact-screen">
      <TopBar title="Cá nhân" onBack={onBack} action="⚙" onAction={() => setSettingsOpen((open) => !open)} />
      {settingsOpen && (
        <section className="profile-settings" aria-live="polite">
          <strong>Cài đặt cá nhân</strong>
          <p>Hồ sơ của bạn đang hiển thị trong workspace hiện tại.</p>
        </section>
      )}
      <section className="profile-card">
        <span className="profile-face">🐱</span>
        <div>
          <h2>Nguyễn Hà My</h2>
          <p>@hamy · {profileSkills.length} kỹ năng · {learningCount} đang học</p>
        </div>
        <button type="button" onClick={openAddForm} aria-label="Thêm kỹ năng">＋</button>
      </section>

      <div className="profile-head">
        <strong>Kỹ năng của bạn ({profileSkills.length})</strong>
        <button type="button" onClick={openAddForm}>+ Thêm kỹ năng</button>
      </div>

      {draft && (
        <section className="skill-form" aria-label={draft.mode === 'edit' ? 'Sửa kỹ năng' : 'Thêm kỹ năng'}>
          <div className="skill-form-head">
            <strong>{draft.mode === 'edit' ? 'Sửa kỹ năng' : 'Thêm kỹ năng mới'}</strong>
            <button type="button" onClick={() => setDraft(null)}>Đóng</button>
          </div>

          <div className="skill-picker" role="listbox" aria-label="Chọn kỹ năng">
            {(draft.mode === 'edit'
              ? [skillMap.get(draft.skillId)].filter(Boolean)
              : availableSkills
            ).map((skill) => (
              <button
                key={skill.id}
                type="button"
                className={draft.skillId === skill.id ? 'active' : ''}
                onClick={() => setDraft((current) => ({ ...current, skillId: skill.id }))}
              >
                <span>{skill.icon}</span>
                {skill.name}
              </button>
            ))}
          </div>

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
            <button type="button" onClick={() => setDraft(null)}>Hủy</button>
            <button type="button" onClick={saveDraft}>Lưu kỹ năng</button>
          </div>
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
            <strong id="delete-confirm-title">Xoa ky nang {pendingDeleteSkill.name}?</strong>
            <p id="delete-confirm-body">Hanh dong nay se xoa ky nang khoi ho so cua ban. Ban co the them lai sau neu can.</p>
          </div>
          <div className="delete-confirm-actions">
            <button type="button" onClick={cancelRemoveSkill}>Huy</button>
            <button type="button" onClick={confirmRemoveSkill}>Xoa ky nang</button>
          </div>
        </section>
      )}

      <div className="profile-skills">
        {profileSkills.map(({ id, level, interest, note }) => {
          const skill = skillMap.get(id);
          return (
            <article className="profile-skill" key={id}>
              <span>{skill.icon}</span>
              <div>
                <strong>{skill.name}</strong>
                <small>Level {level}</small>
                <em>{LEVEL_LABELS[level]}</em>
                {note && <p>{note}</p>}
              </div>
              <b>Quan tâm {interest}</b>
              <button type="button" onClick={() => openEditForm({ id, level, interest, note })} aria-label={`Sửa ${skill.name}`}>✎</button>
              <button type="button" onClick={() => requestRemoveSkill(id)} aria-label={`Xóa ${skill.name}`}>🗑</button>
            </article>
          );
        })}
      </div>

      <button className="add-more" type="button" onClick={openAddForm}>＋ Thêm kỹ năng khác</button>
    </div>
  );
}

function ReportScreen({ onBack }) {
  const [fullOpen, setFullOpen] = useState(false);
  const risks = SKILLS.filter((skill) => skill.risk);
  return (
    <div className="screen compact-screen">
      <TopBar title="Kỹ năng cần bổ sung" onBack={onBack} />
      <div className="warning-box">🏅 Các kỹ năng còn ít người ở mức Thành thạo hoặc Mentor</div>
      <div className="risk-list">
        {risks.map((skill) => (
          <article className="risk-card" key={skill.id}>
            <span>{skill.icon}</span>
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
      <button type="button" onClick={onBack} aria-label="Quay lại">‹</button>
      <strong>{title}</strong>
      {action ? (
        <button type="button" onClick={onAction} aria-label={title === 'Cá nhân' ? 'Cài đặt cá nhân' : `${title} action`}>{action}</button>
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

function BottomNav({ active, onChange }) {
  const items = [
    ['overview', '⌂', 'Tổng quan'],
    ['search', '⌕', 'Tìm kiếm'],
    ['profile', '♙', 'Cá nhân'],
    ['report', '▥', 'Báo cáo'],
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
