# Skill Profile Progress Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing one-time quick-start prompt with a compact profile progress checklist that helps interns complete useful skill profiles.

**Architecture:** Add a pure `getProfileProgress()` helper in `src/lib/skill-map-utils.js`, render it through a presentational `ProfileProgressCard` component, and wire it into `App.jsx` using the existing dataset and quick-add mutation path. No database, API, or mock-store schema changes are required.

**Tech Stack:** React 18, Vite, plain CSS, Node `node:test`.

---

## File Structure

- Modify `test/skill-map-utils.test.mjs`: add focused tests for profile progress behavior before implementation.
- Modify `src/lib/skill-map-utils.js`: add `getProfileProgress()` as a pure helper that derives checklist state and suggestions from already-loaded data.
- Create `src/components/ProfileProgressCard.jsx`: render the card, progress bar, checklist rows, and quick-add buttons.
- Modify `src/App.jsx`: import the new component/helper, replace `QuickStartPanel`, and remove unused quick-start logic.
- Modify `src/App.css`: add compact mobile-first styles for the progress card.

Implementation parallelism: Sequential

Reason: this is a small, tightly coupled UI/helper/test change. Keeping it sequential avoids merge conflicts in `App.jsx`, `App.css`, and `skill-map-utils.js`.

---

### Task 1: Add Failing Tests For Profile Progress

**Files:**
- Modify: `test/skill-map-utils.test.mjs`
- Test: `test/skill-map-utils.test.mjs`

- [ ] **Step 1: Import `getProfileProgress` in the utility test file**

In `test/skill-map-utils.test.mjs`, update the existing import from `../src/lib/skill-map-utils.js` so it includes `getProfileProgress`:

```js
import {
  buildSkillMapIndex,
  endorsementSourceTypeForRole,
  getOnboardingSkillSuggestions,
  getProfileProgress,
  groupMemberSkills,
  normalizeSkillName,
  rankSkillMatches,
  shouldShowSkillOnboarding,
} from '../src/lib/skill-map-utils.js';
```

- [ ] **Step 2: Append profile progress tests**

Add these tests to the bottom of `test/skill-map-utils.test.mjs`:

```js
function profileProgressItem(progress, id) {
  return progress.items.find((item) => item.id === id);
}

test('getProfileProgress returns empty progress and suggestions for a new profile', () => {
  const groups = [
    { id: 'g1', name: 'Coding', sort_order: 10 },
    { id: 'g2', name: 'Testing', sort_order: 20 },
  ];
  const skills = [
    { id: 's2', name: 'Test cases', group_id: 'g2' },
    { id: 's1', name: 'React', group_id: 'g1' },
    { id: 's3', name: 'API integration', group_id: 'g1' },
  ];

  const progress = getProfileProgress({
    groups,
    skills,
    memberSkills: [],
    endorsements: [],
    userId: 'u1',
    suggestionLimit: 2,
  });

  assert.equal(progress.total, 5);
  assert.equal(progress.completed, 0);
  assert.equal(progress.complete, false);
  assert.deepEqual(progress.items.map((item) => item.done), [false, false, false, false, false]);
  assert.deepEqual(progress.suggestions.map((skill) => skill.id), ['s1', 's3']);
});

test('getProfileProgress marks skill count, group coverage, usable, learning, and received endorsement items', () => {
  const groups = [
    { id: 'g1', name: 'Coding', sort_order: 10 },
    { id: 'g2', name: 'Testing', sort_order: 20 },
    { id: 'g3', name: 'Git', sort_order: 30 },
  ];
  const skills = [
    { id: 's1', name: 'React', group_id: 'g1' },
    { id: 's2', name: 'Test cases', group_id: 'g2' },
    { id: 's3', name: 'Manual testing', group_id: 'g2' },
    { id: 's4', name: 'Pull requests', group_id: 'g3' },
  ];
  const memberSkills = [
    { id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'usable' },
    { id: 'ms2', user_id: 'u1', skill_id: 's2', status: 'learning' },
    { id: 'ms3', user_id: 'u1', skill_id: 's3', status: 'usable' },
    { id: 'ms4', user_id: 'u2', skill_id: 's4', status: 'usable' },
  ];
  const endorsements = [
    { id: 'e1', member_skill_id: 'ms1', endorser_user_id: 'u2' },
  ];

  const progress = getProfileProgress({
    groups,
    skills,
    memberSkills,
    endorsements,
    userId: 'u1',
    suggestionLimit: 4,
  });

  assert.equal(progress.completed, 5);
  assert.equal(progress.complete, true);
  assert.equal(profileProgressItem(progress, 'skill-count').done, true);
  assert.equal(profileProgressItem(progress, 'group-coverage').done, true);
  assert.equal(profileProgressItem(progress, 'usable-skill').done, true);
  assert.equal(profileProgressItem(progress, 'learning-skill').done, true);
  assert.equal(profileProgressItem(progress, 'endorsement').done, true);
  assert.deepEqual(progress.suggestions.map((skill) => skill.id), ['s4']);
});

test('getProfileProgress treats a sent endorsement as endorsement progress', () => {
  const progress = getProfileProgress({
    groups: [{ id: 'g1', name: 'Coding', sort_order: 10 }],
    skills: [{ id: 's1', name: 'React', group_id: 'g1' }],
    memberSkills: [
      { id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'usable' },
      { id: 'ms2', user_id: 'u2', skill_id: 's1', status: 'usable' },
    ],
    endorsements: [
      { id: 'e1', member_skill_id: 'ms2', endorser_user_id: 'u1' },
    ],
    userId: 'u1',
  });

  assert.equal(profileProgressItem(progress, 'endorsement').done, true);
});
```

- [ ] **Step 3: Run the targeted test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL with an import/export error similar to `The requested module '../src/lib/skill-map-utils.js' does not provide an export named 'getProfileProgress'`.

- [ ] **Step 4: Commit only the failing tests**

Run:

```bash
git add test/skill-map-utils.test.mjs
git commit -m "test: cover skill profile progress"
```

Expected: commit succeeds. It is acceptable that the test suite is failing at this checkpoint because implementation comes next.

---

### Task 2: Implement `getProfileProgress`

**Files:**
- Modify: `src/lib/skill-map-utils.js`
- Test: `test/skill-map-utils.test.mjs`

- [ ] **Step 1: Add the helper implementation**

In `src/lib/skill-map-utils.js`, add this exported helper after `getOnboardingSkillSuggestions()` and before `buildSkillMapIndex()`:

```js
export function getProfileProgress({
  groups = [],
  skills = [],
  memberSkills = [],
  endorsements = [],
  userId,
  suggestionLimit = 6,
}) {
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const userMemberSkills = memberSkills.filter((row) => row.user_id === userId);
  const userMemberSkillIds = new Set(userMemberSkills.map((row) => row.id));
  const userGroupIds = new Set(
    userMemberSkills
      .map((row) => skillsById.get(row.skill_id)?.group_id)
      .filter(Boolean),
  );
  const hasReceivedEndorsement = endorsements.some((endorsement) => (
    userMemberSkillIds.has(endorsement.member_skill_id)
  ));
  const hasSentEndorsement = endorsements.some((endorsement) => (
    endorsement.endorser_user_id === userId
  ));

  const items = [
    {
      id: 'skill-count',
      label: 'Thêm ít nhất 3 skill',
      done: userMemberSkills.length >= 3,
    },
    {
      id: 'group-coverage',
      label: 'Có skill ở ít nhất 2 nhóm',
      done: userGroupIds.size >= 2,
    },
    {
      id: 'usable-skill',
      label: 'Có 1 skill dùng được',
      done: userMemberSkills.some((row) => row.status === 'usable'),
    },
    {
      id: 'learning-skill',
      label: 'Giữ 1 skill đang học',
      done: userMemberSkills.some((row) => row.status === 'learning'),
    },
    {
      id: 'endorsement',
      label: 'Có 1 lượt endorse',
      done: hasReceivedEndorsement || hasSentEndorsement,
    },
  ];
  const completed = items.filter((item) => item.done).length;

  return {
    total: items.length,
    completed,
    complete: completed === items.length,
    items,
    suggestions: getOnboardingSkillSuggestions({
      groups,
      skills,
      memberSkills,
      userId,
      limit: suggestionLimit,
    }),
  };
}
```

- [ ] **Step 2: Run the tests to verify the helper passes**

Run:

```bash
npm test
```

Expected: PASS for all tests in `test/skill-map-utils.test.mjs`.

- [ ] **Step 3: Commit the utility implementation**

Run:

```bash
git add src/lib/skill-map-utils.js test/skill-map-utils.test.mjs
git commit -m "feat: calculate skill profile progress"
```

Expected: commit succeeds with the helper and passing tests.

---

### Task 3: Create `ProfileProgressCard`

**Files:**
- Create: `src/components/ProfileProgressCard.jsx`

- [ ] **Step 1: Create the presentational component**

Create `src/components/ProfileProgressCard.jsx` with this content:

```jsx
import React from 'react';

export default function ProfileProgressCard({ progress, saving = false, onAddSkill }) {
  if (!progress) return null;

  const percent = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;
  const suggestions = progress.suggestions || [];

  return (
    <section className="mushy-card profile-progress" aria-labelledby="profile-progress-title">
      <div className="profile-progress__head">
        <div className="profile-progress__copy">
          <h2 id="profile-progress-title">Hoàn thiện skill profile</h2>
          <p>Một profile đủ rõ giúp team biết khi nào nên hỏi bạn và mentor thấy nhóm đang thiếu gì.</p>
        </div>
        <span className="profile-progress__label">{progress.completed}/{progress.total} bước</span>
      </div>

      <div
        className="profile-progress__bar"
        role="progressbar"
        aria-label="Tiến độ hoàn thiện skill profile"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.completed}
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      <ul className="profile-progress__checklist" aria-label="Checklist hoàn thiện skill profile">
        {progress.items.map((item) => (
          <li
            className={item.done ? 'profile-progress__item profile-progress__item--done' : 'profile-progress__item'}
            key={item.id}
          >
            <span className="profile-progress__check" aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {suggestions.length > 0 ? (
        <div className="profile-progress__actions" aria-label="Gợi ý skill để thêm nhanh">
          {suggestions.map((skill) => (
            <button
              className="quick-skill"
              disabled={saving}
              key={skill.id}
              type="button"
              onClick={() => onAddSkill?.(skill)}
            >
              Thêm {skill.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="profile-progress__empty">Bạn đã thêm hết skill gợi ý hiện có.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Run tests to verify no existing behavior changed**

Run:

```bash
npm test
```

Expected: PASS. The component is not wired yet, so this verifies the utility tests still pass.

- [ ] **Step 3: Commit the new component**

Run:

```bash
git add src/components/ProfileProgressCard.jsx
git commit -m "feat: add profile progress card component"
```

Expected: commit succeeds.

---

### Task 4: Wire The Progress Card Into `App.jsx`

**Files:**
- Modify: `src/App.jsx`
- Create already done: `src/components/ProfileProgressCard.jsx`
- Test: `test/skill-map-utils.test.mjs`

- [ ] **Step 1: Update imports in `App.jsx`**

In `src/App.jsx`, add the new component import after `MemberDetailModal`:

```jsx
import ProfileProgressCard from './components/ProfileProgressCard.jsx';
```

Update the `skill-map-utils.js` import to remove `getOnboardingSkillSuggestions` and `shouldShowSkillOnboarding`, and include `getProfileProgress`:

```jsx
import {
  displayNameForMember,
  getProfileProgress,
  rankSkillMatches,
} from './lib/skill-map-utils.js';
```

- [ ] **Step 2: Replace onboarding-derived state with profile progress**

In `SkillMapApp()`, remove this line:

```js
const showOnboarding = shouldShowSkillOnboarding({ canEditOwnProfile, loading, mySkills });
```

Remove the `onboardingSuggestions` `useMemo` block:

```js
const onboardingSuggestions = useMemo(() => getOnboardingSkillSuggestions({
  groups: dataset.groups,
  skills: dataset.skills,
  memberSkills: dataset.memberSkills,
  userId: ctx?.userId,
  limit: 6,
}), [ctx?.userId, dataset.groups, dataset.memberSkills, dataset.skills]);
```

Add this `useMemo` after `canAddActiveSkill`:

```js
const profileProgress = useMemo(() => getProfileProgress({
  groups: dataset.groups,
  skills: dataset.skills,
  memberSkills: dataset.memberSkills,
  endorsements: dataset.endorsements,
  userId: ctx?.userId,
  suggestionLimit: 6,
}), [ctx?.userId, dataset.endorsements, dataset.groups, dataset.memberSkills, dataset.skills]);
const showProfileProgress = Boolean(canEditOwnProfile && !loading && !profileProgress.complete);
```

- [ ] **Step 3: Replace the old quick-start render**

In the returned JSX, replace:

```jsx
{showOnboarding && (
  <QuickStartPanel
    saving={saving}
    suggestions={onboardingSuggestions}
    onAddSkill={quickAddSkill}
  />
)}
```

with:

```jsx
{showProfileProgress && (
  <ProfileProgressCard
    progress={profileProgress}
    saving={saving}
    onAddSkill={quickAddSkill}
  />
)}
```

- [ ] **Step 4: Remove the old `QuickStartPanel` function**

Delete the entire `QuickStartPanel` function from the bottom of `src/App.jsx`:

```jsx
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
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected:

- `npm test`: PASS.
- `npm run build`: PASS with Vite production output.

- [ ] **Step 6: Commit the app wiring**

Run:

```bash
git add src/App.jsx src/components/ProfileProgressCard.jsx src/lib/skill-map-utils.js test/skill-map-utils.test.mjs
git commit -m "feat: show skill profile progress"
```

Expected: commit succeeds. If `src/components/ProfileProgressCard.jsx`, `src/lib/skill-map-utils.js`, or `test/skill-map-utils.test.mjs` are already clean from earlier commits, Git will stage only the remaining modified files.

---

### Task 5: Add Progress Card Styles

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add compact progress card CSS**

In `src/App.css`, add this block after the existing `.main-grid` rule:

```css
.profile-progress {
  display: grid;
  gap: 14px;
  margin-bottom: 12px;
  border-color: color-mix(in srgb, var(--brand) 18%, var(--hairline));
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(255, 247, 247, 0.92)),
    var(--surface);
}

.profile-progress__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.profile-progress__copy {
  min-width: 0;
}

.profile-progress__copy h2 {
  margin: 0;
  color: var(--ink);
  font-size: 18px;
  font-weight: 850;
  line-height: 1.15;
  letter-spacing: 0;
}

.profile-progress__copy p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}

.profile-progress__label {
  flex: 0 0 auto;
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand-soft) 68%, #fff);
  color: var(--brand-pressed);
  font-size: 12px;
  font-weight: 850;
  line-height: 1;
  padding: 0 10px;
  white-space: nowrap;
}

.profile-progress__bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-muted) 82%, #fff);
}

.profile-progress__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--brand), color-mix(in srgb, var(--success) 72%, var(--brand)));
  transition: width 180ms ease;
}

.profile-progress__checklist {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile-progress__item {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
}

.profile-progress__item--done {
  color: var(--ink);
}

.profile-progress__check {
  position: relative;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border: 1px solid var(--hairline);
  border-radius: 999px;
  background: #fff;
}

.profile-progress__item--done .profile-progress__check {
  border-color: rgba(16, 185, 129, 0.28);
  background: rgba(16, 185, 129, 0.14);
}

.profile-progress__item--done .profile-progress__check::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 5px;
  width: 7px;
  height: 4px;
  border-bottom: 2px solid #047857;
  border-left: 2px solid #047857;
  transform: rotate(-45deg);
}

.profile-progress__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: start;
}

.profile-progress__empty {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}
```

- [ ] **Step 2: Add responsive checklist layout**

Inside the existing `@media (min-width: 560px)` block, add:

```css
  .profile-progress__checklist {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS with no CSS syntax errors.

- [ ] **Step 4: Commit styles**

Run:

```bash
git add src/App.css
git commit -m "style: add skill profile progress card"
```

Expected: commit succeeds.

---

### Task 6: Final Verification And Browser Smoke

**Files:**
- Verify: `src/App.jsx`
- Verify: `src/App.css`
- Verify: `src/components/ProfileProgressCard.jsx`
- Verify: `src/lib/skill-map-utils.js`
- Verify: `test/skill-map-utils.test.mjs`

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm test
npm run build
```

Expected:

- `npm test`: all `node:test` tests pass.
- `npm run build`: Vite build completes successfully.

- [ ] **Step 2: Start local dev server in mock mode**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 3: Open the mock URL in a browser**

Open:

```text
http://127.0.0.1:5173/?mock=1
```

Expected:

- The page loads without a context error.
- `Hoàn thiện skill profile` appears near the top when the mock current user profile is incomplete.
- The progress label shows a value like `3/5 bước` based on the seeded mock data.
- Checklist rows fit on mobile width without overlapping.
- Quick-add buttons are visible when suggestions remain.

- [ ] **Step 4: Smoke quick-add behavior**

In the browser:

1. Click one `Thêm {skill.name}` button.
2. Confirm the skill appears in `My Skills`.
3. Confirm the progress label updates after the mutation refreshes data.
4. If progress reaches `5/5`, confirm the card hides.

Expected: all interactions work through the existing quick-add mutation path, both in mock mode and without introducing new dialogs.

- [ ] **Step 5: Inspect git state**

Run:

```bash
git status --short
```

Expected:

- Only intentional implementation files are modified or clean.
- Existing unrelated changes in `.codex/skills/meta-harness` may still appear and must not be reverted or staged unless explicitly requested.

- [ ] **Step 6: Final commit if any verification fixes were needed**

If verification required a fix, commit only the implementation files:

```bash
git add src/App.jsx src/App.css src/components/ProfileProgressCard.jsx src/lib/skill-map-utils.js test/skill-map-utils.test.mjs
git commit -m "fix: polish skill profile progress"
```

Expected: commit succeeds. Skip this step if Task 1 through Task 5 commits already contain the final verified code.

---

## Self-Review

Spec coverage:

- The plan replaces `QuickStartPanel` with `ProfileProgressCard`.
- The checklist has exactly five items matching the approved design.
- The progress helper uses existing loaded data only.
- Render conditions cover loading, editable profile, completed profile, and read-only scope.
- Tests cover empty state, count, groups, usable, learning, received endorsement, sent endorsement, and suggestion exclusion.
- Verification includes `npm test`, `npm run build`, and local mock browser smoke.

Review result:

- No unresolved markers remain.
- Function names and item ids are consistent across tests, implementation, and UI.
- The feature remains no-DB-change and no-API-change.
