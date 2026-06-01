# Team Coverage Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Overview skill heatmap with a practical Team Coverage board and convert the Report screen into prioritized coverage actions.

**Architecture:** Add one pure coverage derivation module that turns existing `skills` and `members` view data into category groups, status counts, and action lists. Wire `SkillMapApp` to compute the derived model once, then pass it into `Overview` and `ReportScreen`. Keep persistence, profile editing, Search, and catalog data unchanged.

**Tech Stack:** React 18, Vite, Node built-in test runner, plain CSS, existing Skill Map data model.

---

## File Structure

- Create `src/lib/app/team-coverage.js`: pure helper functions for per-skill coverage, category grouping, action sorting, and text search.
- Create `test/team-coverage.test.js`: unit tests for status rules, people role buckets, category summaries, action ordering, and search.
- Modify `src/App.jsx`: import coverage helper, compute `teamCoverage`, replace heatmap UI in `Overview`, and update `ReportScreen`.
- Modify `src/App.css`: add coverage board, status chip, coverage row, and report action styles; keep existing classes that other screens still use.
- Modify `test/profile-avatar-wiring.test.js`: add source-level checks that the Report screen uses coverage actions and no longer renders fake `skill.total * 14%`.

## Data Contract

`deriveTeamCoverage({ skills, members, query = '', mode = 'grouped' })` returns:

```js
{
  groups: [
    {
      category: 'Frontend',
      skillCount: 2,
      healthyCount: 1,
      thinCount: 1,
      missingCount: 0,
      growingCount: 0,
      topActions: [coverageRow],
      rows: [coverageRow]
    }
  ],
  actions: [coverageRow],
  allRows: [coverageRow],
  visibleRowCount: 1,
  statusCounts: { healthy: 1, thin: 1, missing: 0, growing: 0 }
}
```

Each `coverageRow` has:

```js
{
  skill,
  status: 'healthy',
  action: 'Duy trì coverage',
  primary: memberOrNull,
  mentors: [member],
  backups: [member],
  trainees: [member],
  people: [member],
  category: 'Frontend'
}
```

Status priority is `missing`, `thin`, `growing`, `healthy`.

---

### Task 1: Add Failing Coverage Helper Tests

**Files:**
- Create: `test/team-coverage.test.js`

- [ ] **Step 1: Create unit tests**

Create `test/team-coverage.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COVERAGE_STATUS_PRIORITY,
  deriveSkillCoverage,
  deriveTeamCoverage,
} from '../src/lib/app/team-coverage.js';

const skills = [
  { id: 'react', name: 'React', category: 'Frontend', icon: 'R' },
  { id: 'docker', name: 'Docker', category: 'DevOps/Cloud', icon: 'D' },
  { id: 'rag', name: 'RAG', category: 'AI/ML', icon: 'RAG' },
  { id: 'security', name: 'Security', category: 'Security', icon: 'SEC' },
];

const members = [
  {
    id: 'u-1',
    userId: 'u-1',
    name: 'An Nguyen',
    handle: '@an',
    avatar: 'AN',
    skills: { react: 4, docker: 3, rag: 1 },
    interests: { react: 2, docker: 2, rag: 3 },
  },
  {
    id: 'u-2',
    userId: 'u-2',
    name: 'Binh Tran',
    handle: '@binh',
    avatar: 'BT',
    skills: { react: 2, docker: 0, rag: 2 },
    interests: { react: 3, docker: 1, rag: 3 },
  },
  {
    id: 'u-3',
    userId: 'u-3',
    name: 'Chi Le',
    handle: '@chi',
    avatar: 'CL',
    skills: { react: 3, docker: 1, security: 0 },
    interests: { react: 1, docker: 1, security: 0 },
  },
];

test('deriveSkillCoverage marks primary plus backup as healthy', () => {
  const row = deriveSkillCoverage({ skill: skills[0], members });

  assert.equal(row.status, 'healthy');
  assert.equal(row.action, 'Duy trì coverage');
  assert.equal(row.primary.name, 'An Nguyen');
  assert.deepEqual(row.mentors.map((member) => member.name), ['An Nguyen']);
  assert.deepEqual(row.backups.map((member) => member.name), ['Chi Le', 'Binh Tran']);
});

test('deriveSkillCoverage marks one primary and no backup as thin', () => {
  const row = deriveSkillCoverage({ skill: skills[1], members });

  assert.equal(row.status, 'thin');
  assert.equal(row.action, 'Thêm backup');
  assert.equal(row.primary.name, 'An Nguyen');
  assert.deepEqual(row.backups, []);
});

test('deriveSkillCoverage marks interested low-level members as growing', () => {
  const row = deriveSkillCoverage({ skill: skills[2], members });

  assert.equal(row.status, 'growing');
  assert.equal(row.action, 'Ghép trainee với mentor');
  assert.equal(row.primary, null);
  assert.deepEqual(row.trainees.map((member) => member.name), ['Binh Tran', 'An Nguyen']);
});

test('deriveSkillCoverage marks no primary and no trainee as missing', () => {
  const row = deriveSkillCoverage({ skill: skills[3], members });

  assert.equal(row.status, 'missing');
  assert.equal(row.action, 'Cần primary owner');
  assert.equal(row.primary, null);
  assert.deepEqual(row.trainees, []);
});

test('deriveTeamCoverage summarizes categories and orders actions by severity', () => {
  const coverage = deriveTeamCoverage({ skills, members });

  assert.deepEqual(COVERAGE_STATUS_PRIORITY, ['missing', 'thin', 'growing', 'healthy']);
  assert.deepEqual(coverage.actions.map((row) => row.status), ['missing', 'thin', 'growing']);
  assert.deepEqual(coverage.statusCounts, {
    healthy: 1,
    thin: 1,
    missing: 1,
    growing: 1,
  });

  const frontend = coverage.groups.find((group) => group.category === 'Frontend');
  assert.equal(frontend.skillCount, 1);
  assert.equal(frontend.healthyCount, 1);
});

test('deriveTeamCoverage filters by skill, category, and related member names', () => {
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, query: 'cloud' }).allRows.map((row) => row.skill.name),
    ['Docker'],
  );
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, query: 'Binh' }).allRows.map((row) => row.skill.name),
    ['React', 'RAG'],
  );
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, query: 'security' }).allRows.map((row) => row.skill.name),
    ['Security'],
  );
});

test('deriveTeamCoverage mode filters visible rows', () => {
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, mode: 'needs' }).allRows.map((row) => row.skill.name),
    ['Security', 'Docker'],
  );
  assert.deepEqual(
    deriveTeamCoverage({ skills, members, mode: 'growth' }).allRows.map((row) => row.skill.name),
    ['RAG'],
  );
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npm run test -- test/team-coverage.test.js
```

Expected: FAIL with `Cannot find module '../src/lib/app/team-coverage.js'`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add test/team-coverage.test.js
git commit -m "test: add team coverage helper expectations"
```

---

### Task 2: Implement Pure Coverage Helper

**Files:**
- Create: `src/lib/app/team-coverage.js`
- Test: `test/team-coverage.test.js`

- [ ] **Step 1: Add the helper implementation**

Create `src/lib/app/team-coverage.js` with:

```js
export const COVERAGE_STATUS_PRIORITY = ['missing', 'thin', 'growing', 'healthy'];

const STATUS_ACTIONS = {
  healthy: 'Duy trì coverage',
  thin: 'Thêm backup',
  missing: 'Cần primary owner',
  growing: 'Ghép trainee với mentor',
};

const STATUS_RANK = new Map(COVERAGE_STATUS_PRIORITY.map((status, index) => [status, index]));

export function deriveTeamCoverage({ skills = [], members = [], query = '', mode = 'grouped' } = {}) {
  const normalizedQuery = normalizeText(query);
  const allRows = skills
    .map((skill) => deriveSkillCoverage({ skill, members }))
    .filter((row) => matchesQuery(row, normalizedQuery))
    .filter((row) => matchesMode(row, mode))
    .sort(compareCoverageRows);

  const groupsByCategory = new Map();
  for (const row of allRows) {
    const category = row.category || 'Custom';
    if (!groupsByCategory.has(category)) {
      groupsByCategory.set(category, {
        category,
        skillCount: 0,
        healthyCount: 0,
        thinCount: 0,
        missingCount: 0,
        growingCount: 0,
        topActions: [],
        rows: [],
      });
    }
    const group = groupsByCategory.get(category);
    group.skillCount += 1;
    group[`${row.status}Count`] += 1;
    group.rows.push(row);
  }

  const groups = [...groupsByCategory.values()]
    .map((group) => ({
      ...group,
      rows: group.rows.sort(compareCoverageRows),
      topActions: group.rows.filter((row) => row.status !== 'healthy').slice(0, 3),
    }))
    .sort(compareCoverageGroups);

  const actions = allRows.filter((row) => row.status !== 'healthy').sort(compareCoverageRows);
  const statusCounts = allRows.reduce((counts, row) => {
    counts[row.status] += 1;
    return counts;
  }, { healthy: 0, thin: 0, missing: 0, growing: 0 });

  return {
    groups,
    actions,
    allRows,
    visibleRowCount: allRows.length,
    statusCounts,
  };
}

export function deriveSkillCoverage({ skill, members = [] }) {
  const people = members.map((member) => {
    const level = clampInteger(member.skills?.[skill.id], 0, 4);
    const interest = clampInteger(member.interests?.[skill.id], 0, 3);
    return { ...member, level, interest };
  });

  const primaries = people
    .filter((member) => member.level >= 3)
    .sort(comparePeopleForLead);
  const primary = primaries[0] || null;
  const mentors = people
    .filter((member) => member.level >= 4)
    .sort(comparePeopleForLead);
  const backups = people
    .filter((member) => member.level >= 2 && member.id !== primary?.id)
    .sort(comparePeopleForLead);
  const trainees = people
    .filter((member) => member.interest >= 2 && member.level <= 2)
    .sort((a, b) => b.interest - a.interest || b.level - a.level || compareNames(a, b));

  const status = getCoverageStatus({ primary, backups, trainees });

  return {
    skill,
    category: skill.category || 'Custom',
    status,
    action: STATUS_ACTIONS[status],
    primary,
    mentors,
    backups,
    trainees,
    people: uniquePeople([primary, ...mentors, ...backups, ...trainees]),
  };
}

function getCoverageStatus({ primary, backups, trainees }) {
  if (primary && backups.length > 0) return 'healthy';
  if (primary) return 'thin';
  if (trainees.length > 0) return 'growing';
  return 'missing';
}

function matchesMode(row, mode) {
  if (mode === 'needs') return row.status === 'missing' || row.status === 'thin';
  if (mode === 'growth') return row.status === 'growing';
  return true;
}

function matchesQuery(row, normalizedQuery) {
  if (!normalizedQuery) return true;
  const peopleText = row.people.map((member) => `${member.name} ${member.handle}`).join(' ');
  return normalizeText(`${row.skill.name} ${row.category} ${peopleText}`).includes(normalizedQuery);
}

function compareCoverageGroups(a, b) {
  return groupSeverity(a) - groupSeverity(b) || a.category.localeCompare(b.category, 'vi');
}

function groupSeverity(group) {
  if (group.missingCount > 0) return 0;
  if (group.thinCount > 0) return 1;
  if (group.growingCount > 0) return 2;
  return 3;
}

function compareCoverageRows(a, b) {
  return STATUS_RANK.get(a.status) - STATUS_RANK.get(b.status)
    || a.category.localeCompare(b.category, 'vi')
    || a.skill.name.localeCompare(b.skill.name, 'vi');
}

function comparePeopleForLead(a, b) {
  return b.level - a.level || b.interest - a.interest || compareNames(a, b);
}

function compareNames(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
}

function uniquePeople(people) {
  const seen = new Set();
  return people.filter((member) => {
    if (!member?.id || seen.has(member.id)) return false;
    seen.add(member.id);
    return true;
  });
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function clampInteger(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
```

- [ ] **Step 2: Run helper tests**

Run:

```bash
npm run test -- test/team-coverage.test.js
```

Expected: PASS for all tests in `team-coverage.test.js`.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 4: Commit the helper**

```bash
git add src/lib/app/team-coverage.js test/team-coverage.test.js
git commit -m "feat: derive team coverage from skill map data"
```

---

### Task 3: Wire Coverage Data Into App

**Files:**
- Modify: `src/App.jsx`
- Test: `npm run test`

- [ ] **Step 1: Import the helper**

In `src/App.jsx`, add this import below the `skill-map-data.js` import block:

```js
import { deriveTeamCoverage } from './lib/app/team-coverage.js';
```

- [ ] **Step 2: Compute coverage in `SkillMapApp`**

After:

```js
const profileSkills = view.profileSkills;
```

add:

```js
const teamCoverage = useMemo(() => deriveTeamCoverage({ skills, members }), [skills, members]);
```

- [ ] **Step 3: Pass coverage into Overview**

In the `<Overview />` props, add:

```jsx
teamCoverage={teamCoverage}
```

- [ ] **Step 4: Pass coverage into ReportScreen**

Replace:

```jsx
{tab === 'report' && <ReportScreen skills={skills} onBack={() => setTab('overview')} />}
```

with:

```jsx
{tab === 'report' && <ReportScreen teamCoverage={teamCoverage} onBack={() => setTab('overview')} />}
```

- [ ] **Step 5: Update function signatures without changing behavior**

Update `Overview` parameters to include `teamCoverage`:

```js
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
  teamCoverage,
  isWorkspaceAdmin,
  saving,
  onApprovePendingSkill,
  onMergePendingSkill,
  onRejectPendingSkill,
}) {
```

Temporarily update `ReportScreen` to preserve old rendering while accepting the new prop:

```js
function ReportScreen({ teamCoverage, onBack }) {
  const [fullOpen, setFullOpen] = useState(false);
  const risks = teamCoverage.actions;
```

Leave the rest of `ReportScreen` unchanged in this task.

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 7: Commit wiring**

```bash
git add src/App.jsx
git commit -m "feat: wire team coverage into app screens"
```

---

### Task 4: Replace Overview Heatmap With Team Coverage Board

**Files:**
- Modify: `src/App.jsx`
- Test: source still builds after Task 6

- [ ] **Step 1: Replace heatmap mode state**

Inside `Overview`, replace:

```js
const [filterOpen, setFilterOpen] = useState(false);
const [heatMode, setHeatMode] = useState('top');
```

with:

```js
const [filterOpen, setFilterOpen] = useState(false);
const [coverageMode, setCoverageMode] = useState('grouped');
```

- [ ] **Step 2: Replace heatmap-derived values**

Remove `skillMatches`, `memberMatches`, `heatSkills`, `heatMembers`, and `searchMode`.

Add this block after `normalizedSearch`:

```js
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
```

- [ ] **Step 3: Update quick card copy**

In the first `.quick-card`, replace:

```jsx
<strong>Heatmap tổng quan</strong>
<small>Xem năng lực theo kỹ năng</small>
```

with:

```jsx
<strong>Team Coverage</strong>
<small>Xem owner, backup và trainee</small>
```

- [ ] **Step 4: Update filter panel buttons**

Replace the filter panel button group with:

```jsx
<section className="filter-panel" aria-label="Bộ lọc Team Coverage">
  <button type="button" className={coverageMode === 'grouped' ? 'active' : ''} onClick={() => setCoverageMode('grouped')}>Theo nhóm</button>
  <button type="button" className={coverageMode === 'needs' ? 'active' : ''} onClick={() => setCoverageMode('needs')}>Cần xử lý</button>
  <button type="button" className={coverageMode === 'growth' ? 'active' : ''} onClick={() => setCoverageMode('growth')}>Đang phát triển</button>
  <button type="button" onClick={() => setOverviewSearch('')}>Xóa tìm kiếm</button>
</section>
```

- [ ] **Step 5: Replace the heat panel markup**

Replace the whole `<section className="panel heat-panel" ...>` block with:

```jsx
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
```

- [ ] **Step 6: Add status label helper**

Add this helper near `normalizeText`:

```js
function coverageStatusLabel(status) {
  if (status === 'missing') return 'Missing';
  if (status === 'thin') return 'Thin';
  if (status === 'growing') return 'Growing';
  return 'Healthy';
}
```

- [ ] **Step 7: Update banner copy and motion cards**

Replace the gap banner copy with:

```jsx
<strong>Hành động ưu tiên</strong>
<small>{teamCoverage.actions.length ? `${teamCoverage.actions.length} điểm coverage cần xử lý.` : 'Team chưa có coverage risk nổi bật.'}</small>
```

Replace `motion-stack` map source:

```jsx
{heatSkills.slice(0, 3).map((skill, index) => (
```

with:

```jsx
{teamCoverage.actions.slice(0, 3).map((row, index) => (
```

Then update inside each card from `skill` to `row.skill` and `row.status`:

```jsx
<article key={row.skill.id} data-gsap="image-reveal">
  <div className="motion-image" data-skill-state={row.status === 'healthy' ? 'stable' : 'risk'} aria-hidden="true" />
  <span>{String(index + 1).padStart(2, '0')}</span>
  <strong>{row.skill.name}</strong>
  <small>{row.action}</small>
</article>
```

If `teamCoverage.actions` is empty, render:

```jsx
{teamCoverage.actions.length === 0 && (
  <article data-gsap="image-reveal">
    <div className="motion-image" data-skill-state="stable" aria-hidden="true" />
    <span>01</span>
    <strong>Coverage ổn định</strong>
    <small>Chưa có hành động ưu tiên trong dữ liệu hiện tại.</small>
  </article>
)}
```

- [ ] **Step 8: Commit Overview changes**

```bash
git add src/App.jsx
git commit -m "feat: replace overview heatmap with coverage board"
```

---

### Task 5: Redesign Report Screen Around Prioritized Actions

**Files:**
- Modify: `src/App.jsx`
- Modify: `test/profile-avatar-wiring.test.js`

- [ ] **Step 1: Replace `ReportScreen` implementation**

Replace the current `ReportScreen` function with:

```jsx
function ReportScreen({ teamCoverage, onBack }) {
  const [fullOpen, setFullOpen] = useState(false);
  const critical = teamCoverage.actions.filter((row) => row.status === 'missing');
  const thin = teamCoverage.actions.filter((row) => row.status === 'thin');
  const growth = teamCoverage.actions.filter((row) => row.status === 'growing');
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
                <em>›</em>
              </article>
            ))}
          </section>
        ))}
      </div>

      {teamCoverage.actions.length === 0 && (
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
```

- [ ] **Step 2: Add report summary helper**

Add near `coverageStatusLabel`:

```js
function buildCoverageReportSummary(teamCoverage) {
  const missing = teamCoverage.statusCounts.missing;
  const thin = teamCoverage.statusCounts.thin;
  const growing = teamCoverage.statusCounts.growing;
  if (missing + thin + growing === 0) {
    return 'Không có khoảng trống coverage nổi bật trong dữ liệu hiện tại.';
  }
  return `Ưu tiên xử lý ${missing} kỹ năng thiếu primary, ${thin} kỹ năng thiếu backup, và ${growing} kỹ năng có trainee cần được dẫn dắt.`;
}
```

- [ ] **Step 3: Add source-level regression tests**

Append to `test/profile-avatar-wiring.test.js`:

```js
test('ReportScreen renders coverage actions instead of fake risk percentages', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const reportScreenStart = source.indexOf('function ReportScreen');
  const topBarStart = source.indexOf('function TopBar');
  const reportSource = source.slice(reportScreenStart, topBarStart);

  assert.match(reportSource, /Hành động ưu tiên/);
  assert.match(reportSource, /teamCoverage\.actions/);
  assert.match(reportSource, /Primary:/);
  assert.doesNotMatch(reportSource, /skill\.total \* 14/);
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit report changes**

```bash
git add src/App.jsx test/profile-avatar-wiring.test.js
git commit -m "feat: turn risk report into coverage actions"
```

---

### Task 6: Add Coverage Board Styles

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add coverage CSS near existing heatmap/risk styles**

Append these styles after the existing `.heat-empty` or related panel styles:

```css
.coverage-panel {
  overflow: hidden;
}

.coverage-groups {
  display: grid;
  gap: 14px;
}

.coverage-group {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  overflow: hidden;
}

.coverage-group > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.coverage-group > header strong,
.coverage-skill strong,
.coverage-owner strong,
.coverage-metric strong {
  display: block;
}

.coverage-group > header small,
.coverage-skill small,
.coverage-owner small,
.coverage-metric small {
  color: var(--muted);
}

.coverage-counts {
  display: flex;
  align-items: center;
  gap: 6px;
}

.coverage-counts span {
  min-width: 26px;
  height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
}

.coverage-rows {
  display: grid;
}

.coverage-row {
  width: 100%;
  min-height: 72px;
  display: grid;
  grid-template-columns: minmax(180px, 1.4fr) 92px minmax(150px, 1fr) 72px 72px;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.coverage-row:last-child {
  border-bottom: 0;
}

.coverage-row:hover {
  background: rgba(255, 255, 255, 0.055);
}

.coverage-skill,
.coverage-owner {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.coverage-skill span,
.coverage-owner span {
  min-width: 0;
}

.coverage-skill strong,
.coverage-owner strong,
.coverage-skill small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coverage-owner i {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  color: var(--muted);
  font-style: normal;
  font-weight: 800;
}

.coverage-status {
  min-width: 72px;
  justify-self: start;
  border-radius: 999px;
  padding: 6px 9px;
  font-size: 11px;
  font-weight: 850;
  text-align: center;
}

.coverage-status--missing,
.status-missing {
  background: rgba(255, 102, 122, 0.16);
  color: #ff8d9c;
}

.coverage-status--thin,
.status-thin {
  background: rgba(247, 200, 91, 0.16);
  color: #f7c85b;
}

.coverage-status--growing,
.status-growing {
  background: rgba(143, 183, 255, 0.16);
  color: #8fb7ff;
}

.coverage-status--healthy,
.status-healthy {
  background: rgba(100, 223, 196, 0.16);
  color: #64dfc4;
}

.coverage-metric {
  min-width: 0;
}

.coverage-metric strong {
  font-size: 20px;
  line-height: 1;
}

.coverage-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
  color: var(--muted);
  font-size: 12px;
}

.coverage-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.coverage-legend i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.action-report-list {
  gap: 14px;
}

.action-report-group {
  display: grid;
  gap: 10px;
}

.action-report-group > header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  color: var(--muted);
}

.action-card span {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
}
```

- [ ] **Step 2: Add responsive coverage CSS**

Inside the existing mobile media query or at the end of `src/App.css`, add:

```css
@media (max-width: 760px) {
  .coverage-row {
    grid-template-columns: 1fr auto;
    align-items: start;
  }

  .coverage-owner,
  .coverage-metric {
    grid-column: 1 / -1;
  }

  .coverage-status {
    justify-self: end;
  }

  .coverage-metric {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 42px;
  }
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 4: Commit styles**

```bash
git add src/App.css
git commit -m "style: add team coverage board presentation"
```

---

### Task 7: Final Verification

**Files:**
- Verify: `src/App.jsx`
- Verify: `src/App.css`
- Verify: `src/lib/app/team-coverage.js`
- Verify: `test/team-coverage.test.js`

- [ ] **Step 1: Run full tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Search for removed fake percentage formula**

Run:

```bash
rg "skill\\.total \\* 14|Heatmap năng lực|Top kỹ năng|Cần bổ sung" src test
```

Expected: no matches for `skill.total * 14`, `Heatmap năng lực`, or `Top kỹ năng` in the new Overview/Report implementation. Existing unrelated copy can be evaluated manually if the command returns matches.

- [ ] **Step 4: Manual browser pass**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL. Open the app and verify:

- Overview shows `Team Coverage`.
- Mode button cycles `Theo nhóm`, `Cần xử lý`, `Đang phát triển`.
- Search filters by skill, category, and member name.
- Clicking a coverage row opens Search focused on that skill.
- Report shows `Hành động ưu tiên`.
- Report does not show fake percentage bars.
- Mobile width does not overflow coverage rows.

- [ ] **Step 5: Commit any verification fixes**

If verification required code changes, commit them with:

```bash
git add src/App.jsx src/App.css src/lib/app/team-coverage.js test/team-coverage.test.js test/profile-avatar-wiring.test.js
git commit -m "fix: polish team coverage board verification issues"
```

If verification required no code changes, do not create an empty commit.

---

## Self-Review

- Spec coverage: the plan replaces the Overview heatmap, uses existing categories, derives primary/backup/trainee/status/action, keeps Search click-through, updates Report to prioritized actions, avoids migration and AI, and includes empty states.
- Placeholder scan: no task asks for unspecified behavior; every code-changing step includes concrete code or exact replacement text.
- Type consistency: `deriveTeamCoverage`, `deriveSkillCoverage`, `teamCoverage`, `coverageMode`, `coverageStatusLabel`, and `buildCoverageReportSummary` are consistently named across tasks.
