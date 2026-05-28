# Skill Map Local Mock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local `?mock=1` Skill Map mode that lets the app run and mutate fake data without Mushy Shell or Supabase.

**Architecture:** Add a focused mock data module with pure in-memory state operations, then let the Skill Map data hook and mutation handlers switch to that module when mock mode is active. Keep production behavior untouched by gating mock mode behind `import.meta.env.DEV` and the URL query string.

**Tech Stack:** Vite, React 18, Node built-in test runner, existing Skill Map utility functions.

---

## File Structure

- Create `src/lib/skill-map-mock.js`: owns mock mode detection, fake context/scope, mock dataset creation, and in-memory mutation helpers.
- Modify `test/skill-map-utils.test.mjs`: add tests for mock mode detection and mock mutation behavior.
- Modify `src/lib/useSkillMapData.js`: return mock dataset and refresh support when mock mode is active.
- Modify `src/App.jsx`: route Skill Map mutations through mock helpers when mock mode is active.

## Task 1: Mock State Module

**Files:**
- Test: `test/skill-map-utils.test.mjs`
- Create: `src/lib/skill-map-mock.js`

- [ ] **Step 1: Write failing tests**

Append tests that import `createSkillMapMockStore`, `isSkillMapMockMode`, and verify:

- `isSkillMapMockMode('http://127.0.0.1:5173/?mock=1', true)` returns `true`.
- The same URL returns `false` when dev is `false`.
- `createSkillMapMockStore()` starts with current user's member skill list.
- `addMemberSkill()` creates or reuses a skill and adds it to the current user.
- `updateMemberSkillStatus()` changes status.
- `deleteMemberSkill()` removes the row.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test
```

Expected: FAIL because `src/lib/skill-map-mock.js` does not exist.

- [ ] **Step 3: Implement minimal mock module**

Create `src/lib/skill-map-mock.js` with:

- `isSkillMapMockMode(url, isDev)`
- `MOCK_CONTEXT`
- `MOCK_ACTIVE_SCOPE`
- `createSkillMapMockStore()`
- store methods: `getDataset`, `findOrCreateSkill`, `addMemberSkill`, `updateMemberSkillStatus`, `deleteMemberSkill`, `endorseMemberSkill`, `removeEndorsement`

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
npm test
```

Expected: PASS.

## Task 2: Hook and App Integration

**Files:**
- Modify: `src/lib/useSkillMapData.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Integrate mock mode in the hook**

When `isSkillMapMockMode(window.location.href, import.meta.env.DEV)` is true, `useSkillMapData()` should return mock context, mock scope, mock dataset, mock index, `loading: false`, and a `mockStore` object.

- [ ] **Step 2: Integrate mock mutations in App**

In `App.jsx`, branch each existing mutation:

- Add skill: use mock store in mock mode, real API otherwise.
- Change status: use mock store in mock mode, real API otherwise.
- Delete skill: use mock store in mock mode, real API otherwise.
- Endorse/remove endorsement: use mock store in mock mode, real API otherwise.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

## Task 3: Local Runtime

**Files:**
- No source edits expected.

- [ ] **Step 1: Start local server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

- [ ] **Step 2: Open mock URL**

Open:

```text
http://127.0.0.1:5173/?mock=1
```

Expected: Team Skill Map renders with mock members and My Skills form enabled.
