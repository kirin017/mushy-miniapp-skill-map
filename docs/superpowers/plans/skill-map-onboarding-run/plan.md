# Skill Map Onboarding UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce first-use friction by adding quick skill suggestions and action-oriented empty states to Team Skill Map.

**Architecture:** Add pure helper functions for onboarding decisions and skill suggestions, then wire them into the existing React workflow. Quick-add reuses the existing skill/member-skill mutation paths so real and mock modes stay aligned.

**Tech Stack:** React 18, Vite, Node built-in test runner, existing Mushy UI components.

---

## Task 1: Helper Tests and Logic

**Files:**
- Modify: `test/skill-map-utils.test.mjs`
- Modify: `src/lib/skill-map-utils.js`

- [ ] Write failing tests for onboarding visibility and suggestion filtering.
- [ ] Run `npm test` and verify RED.
- [ ] Implement helpers.
- [ ] Run `npm test` and verify GREEN.

## Task 2: Quick Start and Empty-State UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] Add quick-start panel when current user has no skills.
- [ ] Add one-click suggested skill buttons.
- [ ] Add selected-skill empty-state add action.
- [ ] Keep manual My Skills form available.

## Task 3: Evaluate

**Files:**
- Write: `feedback/iter-1.json`
- Write: `outcome.json`
- Write: `reports/meta-harness-report.md`

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run browser smoke on `/?mock=1`.
- [ ] Score rubric and write outcome.
