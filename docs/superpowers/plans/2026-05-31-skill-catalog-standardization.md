# Skill Catalog Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace open-ended skill creation with a repo-versioned catalog, legacy skill mapping, pending proposals, and workspace admin review.

**Architecture:** The standard catalog lives in `src/lib/app/skill-catalog.js` and syncs into each workspace through `src/lib/app/skill-map-data.js`. Mapping and review logic stay in focused pure helpers so tests can cover cleanup without a live Supabase connection. React screens remain in `src/App.jsx`, with a small admin review panel wired into the existing overview/profile flow.

**Tech Stack:** Vite, React 18, Supabase JS, node:test, Postgres migration SQL.

---

## File Structure

- Create `src/lib/app/skill-catalog.js`: standard catalog entries, category/type constants, normalization, validation, and match helpers.
- Modify `src/lib/app/skill-map-data.js`: replace `PRESET_SKILLS` with catalog-derived rows, load approved/canonical skills only, create pending proposals, sync catalog rows, and add review actions.
- Modify `migrations/002_team_skill_map.sql`: add metadata columns and indexes for catalog/proposal/review state.
- Modify `test/skill-catalog.test.js`: catalog validation and mapper tests.
- Modify `test/skill-map-data.test.js`: data sync, pending filtering, proposal creation, merge preservation, and review action tests.
- Modify `test/profile-avatar-wiring.test.js`: source-level checks that profile creates proposals instead of approved custom skills.
- Modify `src/App.jsx`: route missing skill entry to proposal flow, show pending profile skills separately, and add a compact admin pending queue.
- Modify `src/App.css`: style pending badges and admin queue using existing visual system.

## Task 1: Add Standard Catalog and Validation

**Files:**
- Create: `src/lib/app/skill-catalog.js`
- Create: `test/skill-catalog.test.js`

- [ ] **Step 1: Write failing catalog validation tests**

Create `test/skill-catalog.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATALOG_CATEGORIES,
  CATALOG_SKILL_TYPES,
  STANDARD_SKILLS,
  normalizeSkillName,
  validateStandardCatalog,
} from '../src/lib/app/skill-catalog.js';

test('standard catalog has medium-sized unique approved entries', () => {
  const result = validateStandardCatalog(STANDARD_SKILLS);

  assert.deepEqual(result, { ok: true, errors: [] });
  assert.equal(STANDARD_SKILLS.length >= 50, true);
  assert.equal(STANDARD_SKILLS.length <= 70, true);
  assert.equal(new Set(STANDARD_SKILLS.map((skill) => skill.key)).size, STANDARD_SKILLS.length);
  assert.equal(STANDARD_SKILLS.every((skill) => skill.status === 'approved'), true);
});

test('standard catalog uses only known categories and skill types', () => {
  const categories = new Set(CATALOG_CATEGORIES);
  const types = new Set(CATALOG_SKILL_TYPES);

  assert.equal(STANDARD_SKILLS.every((skill) => categories.has(skill.category)), true);
  assert.equal(STANDARD_SKILLS.every((skill) => types.has(skill.skillType)), true);
});

test('standard catalog aliases are unique after normalization', () => {
  const seen = new Map();

  for (const skill of STANDARD_SKILLS) {
    for (const label of [skill.name, ...skill.aliases]) {
      const normalized = normalizeSkillName(label);
      assert.equal(seen.has(normalized), false, `${label} duplicates ${seen.get(normalized)}`);
      seen.set(normalized, skill.key);
    }
  }
});

test('normalizeSkillName handles accents, separators, and common punctuation', () => {
  assert.equal(normalizeSkillName('  React.js  '), 'reactjs');
  assert.equal(normalizeSkillName('CI / CD'), 'cicd');
  assert.equal(normalizeSkillName('Kiểm thử tự động'), 'kiemthutudong');
  assert.equal(normalizeSkillName('PostgreSQL'), 'postgresql');
});
```

- [ ] **Step 2: Run the failing test**

Run: `npm.cmd run test -- test/skill-catalog.test.js`

Expected: FAIL because `src/lib/app/skill-catalog.js` does not exist.

- [ ] **Step 3: Create the catalog module**

Create `src/lib/app/skill-catalog.js` with:

```js
export const CATALOG_CATEGORIES = [
  'Frontend',
  'Backend',
  'Database/Data',
  'AI/ML',
  'Mobile',
  'DevOps/Cloud',
  'Quality',
  'Security',
  'Design/Product',
];

export const CATALOG_SKILL_TYPES = ['capability', 'tool'];

export const STANDARD_SKILLS = [
  skill('frontend.html_css', 'HTML/CSS', 'Frontend', 'tool', ['HTML', 'CSS', 'Semantic HTML', 'Responsive CSS'], 'Build accessible, responsive web layouts with semantic markup and maintainable styling.', ['SFIA', 'O*NET']),
  skill('frontend.javascript', 'JavaScript', 'Frontend', 'tool', ['JS', 'ECMAScript', 'Vanilla JS'], 'Use JavaScript to build interactive browser and application behavior.', ['O*NET']),
  skill('frontend.typescript', 'TypeScript', 'Frontend', 'tool', ['TS', 'Typed JavaScript'], 'Use TypeScript types and tooling to improve JavaScript reliability.', ['O*NET']),
  skill('frontend.react', 'React', 'Frontend', 'tool', ['ReactJS', 'React.js'], 'Build component-based web interfaces with React.', ['O*NET']),
  skill('frontend.nextjs', 'Next.js', 'Frontend', 'tool', ['NextJS', 'Next'], 'Build React applications with routing, rendering, and deployment patterns in Next.js.', ['O*NET']),
  skill('frontend.state_management', 'State Management', 'Frontend', 'capability', ['Redux', 'Zustand', 'Client State', 'App State'], 'Model and manage UI/application state predictably.', ['SFIA']),
  skill('frontend.accessibility', 'Web Accessibility', 'Frontend', 'capability', ['A11y', 'Accessibility', 'WCAG'], 'Design and implement interfaces usable by people with accessibility needs.', ['SFIA']),
  skill('frontend.design_systems', 'Design Systems', 'Frontend', 'capability', ['Component Library', 'UI Kit', 'Design Tokens'], 'Create and maintain reusable interface patterns and tokens.', ['SFIA']),

  skill('backend.api_design', 'API Design', 'Backend', 'capability', ['REST API', 'GraphQL API', 'API Architecture'], 'Design clear service contracts, endpoints, payloads, and versioning strategies.', ['SFIA']),
  skill('backend.nodejs', 'Node.js', 'Backend', 'tool', ['NodeJS', 'Node'], 'Build server-side applications and tooling with Node.js.', ['O*NET']),
  skill('backend.python', 'Python', 'Backend', 'tool', ['Py'], 'Build application, automation, and data workflows with Python.', ['O*NET']),
  skill('backend.go', 'Go', 'Backend', 'tool', ['Golang'], 'Build backend services and tooling with Go.', ['O*NET']),
  skill('backend.java', 'Java', 'Backend', 'tool', ['JVM Java'], 'Build backend applications with Java and JVM tooling.', ['O*NET']),
  skill('backend.dotnet', '.NET', 'Backend', 'tool', ['Dotnet', 'C#', 'ASP.NET'], 'Build backend applications with .NET and C#.', ['O*NET']),
  skill('backend.auth', 'Authentication', 'Backend', 'capability', ['Auth', 'OAuth', 'OIDC', 'Login'], 'Implement identity, sessions, and access control flows.', ['SFIA', 'NICE']),
  skill('backend.performance', 'Backend Performance', 'Backend', 'capability', ['Performance', 'Optimization', 'Latency'], 'Diagnose and improve backend latency, throughput, and resource use.', ['SFIA']),

  skill('data.sql', 'SQL', 'Database/Data', 'tool', ['Structured Query Language'], 'Query and manipulate relational data with SQL.', ['O*NET']),
  skill('data.postgresql', 'PostgreSQL', 'Database/Data', 'tool', ['Postgres', 'PGSQL', 'PG'], 'Operate and develop against PostgreSQL databases.', ['O*NET']),
  skill('data.modeling', 'Data Modeling', 'Database/Data', 'capability', ['Schema Design', 'ERD', 'Database Design'], 'Design durable data structures, relationships, and constraints.', ['SFIA']),
  skill('data.analytics', 'Analytics', 'Database/Data', 'capability', ['Product Analytics', 'BI', 'Business Intelligence'], 'Turn product and business data into measurable insight.', ['SFIA']),
  skill('data.etl', 'ETL/Data Pipelines', 'Database/Data', 'capability', ['ETL', 'ELT', 'Data Pipeline'], 'Move, transform, and validate data across systems.', ['SFIA']),
  skill('data.visualization', 'Data Visualization', 'Database/Data', 'capability', ['Dashboard', 'Charts', 'Reporting'], 'Communicate data clearly through visualizations and dashboards.', ['SFIA']),

  skill('ai.ml_fundamentals', 'ML Fundamentals', 'AI/ML', 'capability', ['Machine Learning', 'ML'], 'Understand core machine learning concepts, model behavior, and evaluation.', ['SFIA']),
  skill('ai.llm_integration', 'LLM Integration', 'AI/ML', 'capability', ['LLM', 'OpenAI', 'ChatGPT API'], 'Integrate large language models into product workflows.', ['SFIA']),
  skill('ai.prompt_engineering', 'Prompt Engineering', 'AI/ML', 'capability', ['Prompting', 'Prompt Design'], 'Design prompts and context for reliable model behavior.', ['SFIA']),
  skill('ai.rag', 'RAG', 'AI/ML', 'capability', ['Retrieval Augmented Generation', 'Vector Search'], 'Build retrieval-augmented generation flows with external knowledge.', ['SFIA']),
  skill('ai.evaluation', 'AI Evaluation', 'AI/ML', 'capability', ['Eval', 'LLM Evaluation', 'Model Evaluation'], 'Measure and improve AI output quality, reliability, and safety.', ['SFIA']),

  skill('mobile.react_native', 'React Native', 'Mobile', 'tool', ['RN'], 'Build mobile applications with React Native.', ['O*NET']),
  skill('mobile.ios', 'iOS', 'Mobile', 'tool', ['Swift', 'UIKit', 'SwiftUI'], 'Build and ship iOS applications.', ['O*NET']),
  skill('mobile.android', 'Android', 'Mobile', 'tool', ['Kotlin Android', 'Android SDK'], 'Build and ship Android applications.', ['O*NET']),
  skill('mobile.release', 'Mobile Release', 'Mobile', 'capability', ['App Store', 'Play Store', 'Mobile Deployment'], 'Prepare, sign, release, and monitor mobile app versions.', ['SFIA']),

  skill('devops.git', 'Git', 'DevOps/Cloud', 'tool', ['Version Control', 'GitHub', 'GitLab'], 'Use Git workflows for version control and collaboration.', ['O*NET']),
  skill('devops.linux', 'Linux', 'DevOps/Cloud', 'tool', ['Unix', 'Shell'], 'Operate Linux environments and command-line workflows.', ['O*NET']),
  skill('devops.docker', 'Docker', 'DevOps/Cloud', 'tool', ['Container', 'Containers', 'Docker Compose'], 'Package and run applications with Docker containers.', ['O*NET']),
  skill('devops.kubernetes', 'Kubernetes', 'DevOps/Cloud', 'tool', ['K8s'], 'Operate containerized workloads with Kubernetes.', ['O*NET']),
  skill('devops.ci_cd', 'CI/CD', 'DevOps/Cloud', 'capability', ['CI CD', 'Continuous Integration', 'Continuous Delivery', 'Pipeline'], 'Automate build, test, and deployment workflows.', ['SFIA']),
  skill('devops.cloud_platforms', 'Cloud Platforms', 'DevOps/Cloud', 'capability', ['AWS', 'GCP', 'Azure', 'Cloud'], 'Use managed cloud services to deploy and operate applications.', ['SFIA', 'O*NET']),
  skill('devops.terraform_iac', 'Terraform/IaC', 'DevOps/Cloud', 'tool', ['Terraform', 'Infrastructure as Code', 'IaC'], 'Manage infrastructure declaratively with code.', ['SFIA']),
  skill('devops.observability', 'Observability', 'DevOps/Cloud', 'capability', ['Monitoring', 'Logging', 'Tracing', 'CloudWatch', 'Datadog'], 'Instrument and investigate production systems with logs, metrics, and traces.', ['SFIA']),

  skill('quality.testing_strategy', 'Testing Strategy', 'Quality', 'capability', ['Test Strategy', 'QA Strategy'], 'Plan the right testing layers, responsibilities, and risk coverage.', ['SFIA']),
  skill('quality.unit_testing', 'Unit Testing', 'Quality', 'capability', ['Unit Test', 'Jest', 'Vitest'], 'Test isolated functions and components with fast automated tests.', ['SFIA']),
  skill('quality.integration_testing', 'Integration Testing', 'Quality', 'capability', ['Integration Test'], 'Test interactions across modules, services, and data boundaries.', ['SFIA']),
  skill('quality.e2e_testing', 'E2E Testing', 'Quality', 'capability', ['End to End Testing', 'Playwright', 'Cypress'], 'Validate user-critical flows through end-to-end tests.', ['SFIA']),
  skill('quality.qa_automation', 'QA Automation', 'Quality', 'capability', ['Automation Test', 'Automated Testing', 'Test Automation'], 'Automate repeatable quality checks across product flows.', ['SFIA']),

  skill('security.secure_coding', 'Secure Coding', 'Security', 'capability', ['Security Coding', 'Secure Development'], 'Write application code that avoids common vulnerability patterns.', ['NICE']),
  skill('security.appsec', 'Application Security', 'Security', 'capability', ['AppSec', 'Web Security'], 'Assess and improve security of application behavior and dependencies.', ['NICE']),
  skill('security.vulnerability_assessment', 'Vulnerability Assessment', 'Security', 'capability', ['Vulnerability Scanning', 'Security Assessment'], 'Identify, triage, and track security vulnerabilities.', ['NICE']),
  skill('security.incident_response', 'Incident Response', 'Security', 'capability', ['Security Incident', 'IR'], 'Respond to security incidents with containment and recovery steps.', ['NICE']),
  skill('security.iam', 'IAM', 'Security', 'capability', ['Identity Access Management', 'Permissions', 'Access Control'], 'Design and manage identity, permissions, and least-privilege access.', ['NICE']),

  skill('product.figma', 'Figma', 'Design/Product', 'tool', ['FigJam'], 'Design, review, and collaborate on product interfaces in Figma.', ['O*NET']),
  skill('product.ux_research', 'UX Research', 'Design/Product', 'capability', ['User Research', 'Research'], 'Learn user needs through interviews, usability studies, and evidence.', ['SFIA']),
  skill('product.discovery', 'Product Discovery', 'Design/Product', 'capability', ['Discovery', 'Problem Discovery'], 'Frame problems, validate opportunities, and reduce product risk.', ['SFIA']),
  skill('product.roadmapping', 'Roadmapping', 'Design/Product', 'capability', ['Product Roadmap', 'Planning'], 'Sequence product work around goals, constraints, and impact.', ['SFIA']),
  skill('product.metrics', 'Product Metrics', 'Design/Product', 'capability', ['KPIs', 'North Star Metric', 'Activation'], 'Define and interpret metrics for product health and outcomes.', ['SFIA']),
];

export function normalizeSkillName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');
}

export function validateStandardCatalog(catalog = STANDARD_SKILLS) {
  const errors = [];
  const categories = new Set(CATALOG_CATEGORIES);
  const types = new Set(CATALOG_SKILL_TYPES);
  const keys = new Set();
  const labels = new Map();

  for (const entry of catalog) {
    if (!entry.key || keys.has(entry.key)) errors.push(`duplicate key: ${entry.key}`);
    keys.add(entry.key);
    if (!categories.has(entry.category)) errors.push(`invalid category for ${entry.key}`);
    if (!types.has(entry.skillType)) errors.push(`invalid skillType for ${entry.key}`);
    if (entry.status !== 'approved') errors.push(`invalid status for ${entry.key}`);
    for (const label of [entry.name, ...(entry.aliases || [])]) {
      const normalized = normalizeSkillName(label);
      if (!normalized) errors.push(`empty label for ${entry.key}`);
      if (labels.has(normalized)) errors.push(`duplicate alias: ${label}`);
      labels.set(normalized, entry.key);
    }
  }

  return { ok: errors.length === 0, errors };
}

function skill(key, name, category, skillType, aliases, description, sourceRefs) {
  return {
    key,
    name,
    category,
    skillType,
    aliases,
    description,
    sourceRefs,
    status: 'approved',
  };
}
```

- [ ] **Step 4: Run catalog tests**

Run: `npm.cmd run test -- test/skill-catalog.test.js`

Expected: PASS.

- [ ] **Step 5: Commit catalog module**

```bash
git add src/lib/app/skill-catalog.js test/skill-catalog.test.js
git commit -m "feat: add standard skill catalog"
```

## Task 2: Add Catalog Metadata Migration

**Files:**
- Modify: `migrations/002_team_skill_map.sql`

- [ ] **Step 1: Add migration assertions to the existing data test**

Append to `test/skill-map-data.test.js`:

```js
import { readFileSync } from 'node:fs';

test('skill map migration includes catalog review metadata', () => {
  const sql = readFileSync(new URL('../migrations/002_team_skill_map.sql', import.meta.url), 'utf8');

  assert.match(sql, /catalog_key text/);
  assert.match(sql, /status text not null default 'approved'/);
  assert.match(sql, /skill_type text not null default 'tool'/);
  assert.match(sql, /aliases jsonb not null default '\[\]'::jsonb/);
  assert.match(sql, /canonical_skill_id uuid references app_skill_map\.skills\(id\)/);
  assert.match(sql, /reviewed_by uuid references auth\.users\(id\)/);
  assert.match(sql, /idx_skills_workspace_status/);
  assert.match(sql, /idx_skills_workspace_catalog_key/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- test/skill-map-data.test.js`

Expected: FAIL because the migration does not define these columns yet.

- [ ] **Step 3: Extend `migrations/002_team_skill_map.sql`**

Add these columns inside the `create table if not exists app_skill_map.skills` statement after `is_preset`:

```sql
  catalog_key text,
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected', 'merged')),
  skill_type text not null default 'tool' check (skill_type in ('capability', 'tool')),
  aliases jsonb not null default '[]'::jsonb,
  description text not null default '' check (char_length(description) <= 500),
  source text not null default 'legacy' check (source in ('catalog', 'proposal', 'legacy')),
  canonical_skill_id uuid references app_skill_map.skills(id) on delete set null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text not null default '' check (char_length(review_note) <= 500),
```

Add idempotent alter statements after existing `is_preset` alters:

```sql
alter table app_skill_map.skills
  add column if not exists catalog_key text;

alter table app_skill_map.skills
  add column if not exists status text not null default 'approved' check (status in ('approved', 'pending', 'rejected', 'merged'));

alter table app_skill_map.skills
  add column if not exists skill_type text not null default 'tool' check (skill_type in ('capability', 'tool'));

alter table app_skill_map.skills
  add column if not exists aliases jsonb not null default '[]'::jsonb;

alter table app_skill_map.skills
  add column if not exists description text not null default '' check (char_length(description) <= 500);

alter table app_skill_map.skills
  add column if not exists source text not null default 'legacy' check (source in ('catalog', 'proposal', 'legacy'));

alter table app_skill_map.skills
  add column if not exists canonical_skill_id uuid references app_skill_map.skills(id) on delete set null;

alter table app_skill_map.skills
  add column if not exists reviewed_by uuid references auth.users(id);

alter table app_skill_map.skills
  add column if not exists reviewed_at timestamptz;

alter table app_skill_map.skills
  add column if not exists review_note text not null default '' check (char_length(review_note) <= 500);
```

Add indexes after existing skill indexes:

```sql
create index if not exists idx_skills_workspace_status on app_skill_map.skills (workspace_id, status);
create index if not exists idx_skills_workspace_catalog_key on app_skill_map.skills (workspace_id, catalog_key) where catalog_key is not null;
create index if not exists idx_skills_workspace_canonical on app_skill_map.skills (workspace_id, canonical_skill_id) where canonical_skill_id is not null;
```

- [ ] **Step 4: Run migration source test**

Run: `npm.cmd run test -- test/skill-map-data.test.js`

Expected: PASS.

- [ ] **Step 5: Commit migration**

```bash
git add migrations/002_team_skill_map.sql test/skill-map-data.test.js
git commit -m "feat: add skill catalog metadata schema"
```

## Task 3: Implement Mapping Helpers

**Files:**
- Modify: `src/lib/app/skill-catalog.js`
- Modify: `test/skill-catalog.test.js`

- [ ] **Step 1: Add failing mapper tests**

Append to `test/skill-catalog.test.js`:

```js
import { matchCatalogSkill } from '../src/lib/app/skill-catalog.js';

test('matchCatalogSkill maps exact and alias names', () => {
  assert.deepEqual(matchCatalogSkill('React.js'), {
    status: 'matched',
    key: 'frontend.react',
    confidence: 1,
    reason: 'alias',
  });
  assert.deepEqual(matchCatalogSkill('Postgres'), {
    status: 'matched',
    key: 'data.postgresql',
    confidence: 1,
    reason: 'alias',
  });
});

test('matchCatalogSkill maps safe fuzzy variants', () => {
  assert.deepEqual(matchCatalogSkill('CI CD'), {
    status: 'matched',
    key: 'devops.ci_cd',
    confidence: 0.94,
    reason: 'safe_fuzzy',
  });
});

test('matchCatalogSkill sends ambiguous broad terms to pending', () => {
  assert.deepEqual(matchCatalogSkill('backend'), {
    status: 'pending',
    key: null,
    confidence: 0,
    reason: 'ambiguous',
  });
  assert.deepEqual(matchCatalogSkill('cloud'), {
    status: 'pending',
    key: null,
    confidence: 0,
    reason: 'ambiguous',
  });
});

test('matchCatalogSkill sends unknown skills to pending', () => {
  assert.deepEqual(matchCatalogSkill('Kafka Streams'), {
    status: 'pending',
    key: null,
    confidence: 0,
    reason: 'no_match',
  });
});
```

- [ ] **Step 2: Run mapper tests to verify failure**

Run: `npm.cmd run test -- test/skill-catalog.test.js`

Expected: FAIL because `matchCatalogSkill` is not exported.

- [ ] **Step 3: Add mapper implementation**

Append before the private `skill()` helper in `src/lib/app/skill-catalog.js`:

```js
const AMBIGUOUS_NORMALIZED = new Set(['cloud', 'backend', 'automation', 'ai']);

const SAFE_FUZZY = new Map([
  ['cicd', 'devops.ci_cd'],
  ['continuousintegrationcontinuousdelivery', 'devops.ci_cd'],
  ['postgres', 'data.postgresql'],
  ['reactjs', 'frontend.react'],
]);

export function matchCatalogSkill(value, catalog = STANDARD_SKILLS) {
  const normalized = normalizeSkillName(value);
  if (!normalized) {
    return pending('no_match');
  }
  if (AMBIGUOUS_NORMALIZED.has(normalized)) {
    return pending('ambiguous');
  }

  const labelIndex = buildLabelIndex(catalog);
  const exact = labelIndex.get(normalized);
  if (exact) {
    return {
      status: 'matched',
      key: exact.key,
      confidence: 1,
      reason: exact.reason,
    };
  }

  const fuzzyKey = SAFE_FUZZY.get(normalized);
  if (fuzzyKey && catalog.some((entry) => entry.key === fuzzyKey)) {
    return {
      status: 'matched',
      key: fuzzyKey,
      confidence: 0.94,
      reason: 'safe_fuzzy',
    };
  }

  return pending('no_match');
}

export function catalogByKey(catalog = STANDARD_SKILLS) {
  return new Map(catalog.map((entry) => [entry.key, entry]));
}

function buildLabelIndex(catalog) {
  const index = new Map();
  for (const entry of catalog) {
    index.set(normalizeSkillName(entry.name), { key: entry.key, reason: 'name' });
    for (const alias of entry.aliases) {
      index.set(normalizeSkillName(alias), { key: entry.key, reason: 'alias' });
    }
  }
  return index;
}

function pending(reason) {
  return {
    status: 'pending',
    key: null,
    confidence: 0,
    reason,
  };
}
```

- [ ] **Step 4: Run mapper tests**

Run: `npm.cmd run test -- test/skill-catalog.test.js`

Expected: PASS.

- [ ] **Step 5: Commit mapper**

```bash
git add src/lib/app/skill-catalog.js test/skill-catalog.test.js
git commit -m "feat: map legacy skills to catalog"
```

## Task 4: Sync Catalog and Filter Approved Skills

**Files:**
- Modify: `src/lib/app/skill-map-data.js`
- Modify: `test/skill-map-data.test.js`

- [ ] **Step 1: Add failing data tests for catalog rows and filtering**

Update imports in `test/skill-map-data.test.js` to include:

```js
  buildCatalogSkillRows,
```

Replace the existing visual icon test with:

```js
test('catalog skills expose names categories and optional visual icon assets', () => {
  assert.equal(PRESET_SKILLS.length >= 50, true);
  assert.equal(PRESET_SKILLS.every((skill) => skill.name && skill.category), true);
  assert.equal(PRESET_SKILLS.some((skill) => skill.iconUrl?.startsWith('https://cdn.simpleicons.org/')), true);
  assert.equal(PRESET_SKILLS.every((skill) => skill.iconAlt === `${skill.name} icon`), true);
});
```

Replace the existing `buildPresetSkillRows creates RLS-ready preset rows for the active workspace` test with:

```js
test('buildPresetSkillRows creates RLS-ready approved catalog rows for the active workspace', () => {
  const rows = buildPresetSkillRows({ workspaceId: 'ws-1', userId: 'user-1' });

  assert.equal(rows.length >= 50, true);
  assert.equal(rows.every((row) => row.workspace_id === 'ws-1'), true);
  assert.equal(rows.every((row) => row.created_by === 'user-1'), true);
  assert.equal(rows.every((row) => row.is_preset === true), true);
  assert.equal(rows.every((row) => row.status === 'approved'), true);
  assert.equal(rows.every((row) => row.source === 'catalog'), true);
  assert.equal(rows.some((row) => row.catalog_key === 'frontend.react' && row.name === 'React'), true);
});
```

Add this new test:

```js
test('buildCatalogSkillRows creates approved catalog rows with aliases and metadata', () => {
  const rows = buildCatalogSkillRows({ workspaceId: 'ws-1', userId: 'user-1' });

  assert.equal(rows.length >= 50, true);
  assert.equal(rows.every((row) => row.workspace_id === 'ws-1'), true);
  assert.equal(rows.every((row) => row.created_by === 'user-1'), true);
  assert.equal(rows.every((row) => row.status === 'approved'), true);
  assert.equal(rows.every((row) => row.source === 'catalog'), true);
  assert.equal(rows.some((row) => row.catalog_key === 'frontend.react' && row.name === 'React'), true);
});

test('composeSkillMapView excludes pending rejected and merged skills from heatmap', () => {
  const view = composeSkillMapView({
    currentUserId: 'u-me',
    skills: [
      { id: 'skill-react', name: 'React', category: 'Frontend', is_preset: true, catalog_key: 'frontend.react', status: 'approved', skill_type: 'tool', aliases: ['ReactJS'] },
      { id: 'skill-kafka', name: 'Kafka Streams', category: 'Backend', is_preset: false, status: 'pending', skill_type: 'tool', aliases: [] },
      { id: 'skill-old', name: 'ReactJS', category: 'Frontend', is_preset: false, status: 'merged', canonical_skill_id: 'skill-react', skill_type: 'tool', aliases: [] },
    ],
    memberSkills: [
      { user_id: 'u-me', skill_id: 'skill-react', level: 3, interest: 3, note: 'Components' },
      { user_id: 'u-me', skill_id: 'skill-kafka', level: 2, interest: 3, note: 'Streams' },
      { user_id: 'u-2', skill_id: 'skill-old', level: 4, interest: 2, note: 'Legacy React' },
    ],
    members: [
      { user_id: 'u-me', full_name: 'Nguyen Ha My' },
      { user_id: 'u-2', full_name: 'Dau Van Nam' },
    ],
  });

  assert.deepEqual(view.skills.map((skill) => skill.name), ['React']);
  assert.equal(view.members[0].skills.react, 3);
  assert.equal(view.members[0].pendingSkills.length, 1);
  assert.equal(view.members[0].pendingSkills[0].name, 'Kafka Streams');
});
```

- [ ] **Step 2: Run data tests to verify failure**

Run: `npm.cmd run test -- test/skill-map-data.test.js`

Expected: FAIL because `buildCatalogSkillRows` and pending filtering are not implemented.

- [ ] **Step 3: Update imports and row builders**

In `src/lib/app/skill-map-data.js`, import catalog helpers:

```js
import { STANDARD_SKILLS, matchCatalogSkill } from './skill-catalog.js';
```

Replace `PRESET_SKILLS` with a catalog-derived export:

```js
export const PRESET_SKILLS = STANDARD_SKILLS.map((skill) => ({
  id: skill.key.split('.').pop().replace(/_/g, '_'),
  key: skill.key,
  name: skill.name,
  icon: fallbackIcon(skill.name),
  iconUrl: simpleIconUrl(skill.key),
  iconAlt: `${skill.name} icon`,
  category: skill.category,
  aliases: skill.aliases,
  skillType: skill.skillType,
  description: skill.description,
}));
```

Add row builder:

```js
export function buildCatalogSkillRows({ workspaceId, userId }) {
  return STANDARD_SKILLS.map((skill) => ({
    workspace_id: workspaceId,
    created_by: userId,
    name: skill.name,
    category: skill.category,
    is_preset: true,
    catalog_key: skill.key,
    status: 'approved',
    skill_type: skill.skillType,
    aliases: skill.aliases,
    description: skill.description,
    source: 'catalog',
    canonical_skill_id: null,
    review_note: '',
  }));
}

export function buildPresetSkillRows(args) {
  return buildCatalogSkillRows(args);
}
```

Add helpers near existing private helpers:

```js
function isApprovedSkill(skill) {
  return !skill.status || skill.status === 'approved';
}

function fallbackIcon(name) {
  return String(name || 'SK').slice(0, 2).toUpperCase();
}

function simpleIconUrl(key) {
  const iconByKey = {
    'frontend.react': 'https://cdn.simpleicons.org/react/61DAFB',
    'frontend.nextjs': 'https://cdn.simpleicons.org/nextdotjs/FFFFFF',
    'frontend.typescript': 'https://cdn.simpleicons.org/typescript/3178C6',
    'backend.nodejs': 'https://cdn.simpleicons.org/nodedotjs/5FA04E',
    'backend.python': 'https://cdn.simpleicons.org/python/3776AB',
    'backend.go': 'https://cdn.simpleicons.org/go/00ADD8',
    'backend.java': 'https://cdn.simpleicons.org/openjdk/FFFFFF',
    'data.postgresql': 'https://cdn.simpleicons.org/postgresql/4169E1',
    'devops.docker': 'https://cdn.simpleicons.org/docker/2496ED',
    'devops.kubernetes': 'https://cdn.simpleicons.org/kubernetes/326CE5',
    'product.figma': 'https://cdn.simpleicons.org/figma/F24E1E',
  };
  return iconByKey[key] || null;
}
```

- [ ] **Step 4: Filter composed view**

In `composeSkillMapView`, replace `const skillRows = [...skills].sort(compareSkills);` with:

```js
  const allSkillRows = [...skills].sort(compareSkills);
  const skillRows = allSkillRows.filter(isApprovedSkill);
  const pendingSkillRows = allSkillRows.filter((skill) => skill.status === 'pending');
```

In member initialization objects, add:

```js
      pendingSkills: [],
```

After processing approved member rows, add pending rows:

```js
  const pendingById = new Map(pendingSkillRows.map((skill) => [skill.id, skill]));
  for (const row of memberSkills) {
    const pendingSkill = pendingById.get(row.skill_id);
    if (!pendingSkill) continue;
    if (!membersById.has(row.user_id)) continue;
    membersById.get(row.user_id).pendingSkills.push({
      id: skillKey(pendingSkill.name),
      skillId: pendingSkill.id,
      name: pendingSkill.name,
      category: pendingSkill.category,
      level: clampInteger(row.level, 0, 4),
      interest: clampInteger(row.interest, 0, 3),
      note: row.note || '',
    });
  }
```

In `displaySkills`, derive preset by catalog key first:

```js
    const preset = PRESET_SKILLS.find((item) => item.key === skill.catalog_key)
      || PRESET_SKILLS.find((item) => item.id === key);
```

- [ ] **Step 5: Sync catalog on load**

In `loadSkillMapData`, replace empty-only seed with:

```js
  if (userId) {
    const rows = buildCatalogSkillRows({ workspaceId, userId });
    const { error } = await db.from('skills').upsert(rows, {
      onConflict: 'workspace_id,catalog_key',
      ignoreDuplicates: false,
    });
    if (error) throw new Error('sync catalog skills: ' + error.message);
  }
  let skills = await fetchSkills(db, workspaceId);
```

Update `fetchSkills` select:

```js
    .select('id,name,category,is_preset,catalog_key,status,skill_type,aliases,description,source,canonical_skill_id,created_at')
```

- [ ] **Step 6: Run data tests**

Run: `npm.cmd run test -- test/skill-map-data.test.js`

Expected: PASS.

- [ ] **Step 7: Commit sync and filtering**

```bash
git add src/lib/app/skill-map-data.js test/skill-map-data.test.js
git commit -m "feat: sync approved skill catalog"
```

## Task 5: Create Pending Proposals Instead of Approved Custom Skills

**Files:**
- Modify: `src/lib/app/skill-map-data.js`
- Modify: `test/skill-map-data.test.js`
- Modify: `test/profile-avatar-wiring.test.js`

- [ ] **Step 1: Add failing proposal tests**

In `test/skill-map-data.test.js`, replace the existing custom skill test with:

```js
test('buildCustomSkillUpsert creates a pending proposal row', () => {
  assert.deepEqual(
    buildCustomSkillUpsert({
      workspaceId: 'ws-active',
      userId: 'u-me',
      name: '  Kafka Streams  ',
      category: '  Backend  ',
      note: 'Needed for event processing work',
    }),
    {
      workspace_id: 'ws-active',
      created_by: 'u-me',
      name: 'Kafka Streams',
      category: 'Backend',
      is_preset: false,
      catalog_key: null,
      status: 'pending',
      skill_type: 'tool',
      aliases: [],
      description: 'Needed for event processing work',
      source: 'proposal',
      canonical_skill_id: null,
      review_note: '',
    },
  );
});
```

Update the save test name and assertions:

```js
test('saveProfileSkill creates a pending proposal before attaching it to the current profile', async () => {
  const calls = [];
  const db = {
    from(table) {
      return {
        upsert(row, options) {
          calls.push({ table, row, options });
          return {
            select() {
              return {
                single() {
                  if (table === 'skills') {
                    return Promise.resolve({ data: { id: 'skill-kafka', name: row.name, status: row.status }, error: null });
                  }
                  return Promise.resolve({ data: { id: 'member-skill-1', ...row }, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const saved = await saveProfileSkill({
    db,
    workspaceId: 'ws-active',
    userId: 'u-me',
    skillName: 'Kafka Streams',
    category: 'Backend',
    level: 2,
    interest: 3,
    note: 'Want production tasks',
  });

  assert.equal(saved.skill_id, 'skill-kafka');
  assert.deepEqual(calls.map((call) => call.table), ['skills', 'member_skills']);
  assert.equal(calls[0].row.status, 'pending');
  assert.equal(calls[0].row.source, 'proposal');
  assert.equal(calls[1].row.skill_id, 'skill-kafka');
});
```

In `test/profile-avatar-wiring.test.js`, update the second test to assert proposal text:

```js
test('ProfileScreen keeps an always-available skill proposal path', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const profileScreenStart = source.indexOf('function ProfileScreen');
  const reportScreenStart = source.indexOf('function ReportScreen');
  const profileScreenSource = source.slice(profileScreenStart, reportScreenStart);

  assert.match(profileScreenSource, /Đề xuất skill/);
  assert.match(profileScreenSource, /skillName/);
  assert.match(profileScreenSource, /customSkill/);
  assert.doesNotMatch(profileScreenSource, /disabled=\{!availableSkills\.length \|\| saving\}/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd run test`

Expected: FAIL because custom skills are still created as non-preset approved rows and the UI text still says `Skill mới`.

- [ ] **Step 3: Update proposal builder**

In `buildCustomSkillUpsert`, return:

```js
  return {
    workspace_id: workspaceId,
    created_by: userId,
    name: skillName.slice(0, 80),
    category: String(category || 'Custom').trim().slice(0, 40) || 'Custom',
    is_preset: false,
    catalog_key: null,
    status: 'pending',
    skill_type: 'tool',
    aliases: [],
    description: String(note || '').trim().slice(0, 500),
    source: 'proposal',
    canonical_skill_id: null,
    review_note: '',
  };
```

Update the signature to:

```js
export function buildCustomSkillUpsert({ workspaceId, userId, name, category, note }) {
```

Update `createCustomSkill` call:

```js
  const row = buildCustomSkillUpsert({ workspaceId, userId, name: skillName, category, note });
```

Update `createCustomSkill` signature:

```js
async function createCustomSkill({ db, workspaceId, userId, skillName, category, note }) {
```

Update `saveProfileSkill` custom path:

```js
  const resolvedSkillId = skillId || await createCustomSkill({ db, workspaceId, userId, skillName, category, note });
```

- [ ] **Step 4: Update profile UI text**

In `src/App.jsx`, replace user-facing custom skill labels:

```jsx
Đề xuất skill
```

Use it for the custom option button and add-more button where it currently says `Skill mới` or implies immediate creation.

- [ ] **Step 5: Run tests**

Run: `npm.cmd run test`

Expected: PASS.

- [ ] **Step 6: Commit proposal flow**

```bash
git add src/lib/app/skill-map-data.js src/App.jsx test/skill-map-data.test.js test/profile-avatar-wiring.test.js
git commit -m "feat: create pending skill proposals"
```

## Task 6: Add Legacy Cleanup and Merge Helpers

**Files:**
- Modify: `src/lib/app/skill-map-data.js`
- Modify: `test/skill-map-data.test.js`

- [ ] **Step 1: Add failing legacy cleanup tests**

Add to `test/skill-map-data.test.js`:

```js
import {
  buildLegacySkillCleanupPlan,
} from '../src/lib/app/skill-map-data.js';

test('buildLegacySkillCleanupPlan maps obvious legacy skills and leaves unknown pending', () => {
  const plan = buildLegacySkillCleanupPlan({
    skills: [
      { id: 'legacy-react', name: 'React.js', status: 'approved', catalog_key: null },
      { id: 'legacy-kafka', name: 'Kafka Streams', status: 'approved', catalog_key: null },
      { id: 'catalog-react', name: 'React', status: 'approved', catalog_key: 'frontend.react' },
    ],
  });

  assert.deepEqual(plan.memberSkillMoves, [
    { fromSkillId: 'legacy-react', toSkillId: 'catalog-react' },
  ]);
  assert.deepEqual(plan.skillUpdates, [
    { id: 'legacy-react', status: 'merged', canonical_skill_id: 'catalog-react', review_note: 'Auto-merged by catalog alias: frontend.react' },
    { id: 'legacy-kafka', status: 'pending', source: 'legacy', review_note: 'Needs workspace admin review' },
  ]);
});
```

- [ ] **Step 2: Run cleanup test to verify failure**

Run: `npm.cmd run test -- test/skill-map-data.test.js`

Expected: FAIL because `buildLegacySkillCleanupPlan` is not implemented.

- [ ] **Step 3: Implement cleanup planner**

In `src/lib/app/skill-map-data.js`, add:

```js
export function buildLegacySkillCleanupPlan({ skills }) {
  const canonicalByCatalogKey = new Map(
    skills
      .filter((skill) => skill.catalog_key && (!skill.status || skill.status === 'approved'))
      .map((skill) => [skill.catalog_key, skill]),
  );
  const memberSkillMoves = [];
  const skillUpdates = [];

  for (const skill of skills) {
    if (skill.catalog_key || skill.status === 'pending' || skill.status === 'merged' || skill.status === 'rejected') {
      continue;
    }
    const match = matchCatalogSkill(skill.name);
    if (match.status === 'matched') {
      const canonical = canonicalByCatalogKey.get(match.key);
      if (canonical && canonical.id !== skill.id) {
        memberSkillMoves.push({ fromSkillId: skill.id, toSkillId: canonical.id });
        skillUpdates.push({
          id: skill.id,
          status: 'merged',
          canonical_skill_id: canonical.id,
          review_note: `Auto-merged by catalog alias: ${match.key}`,
        });
      }
    } else {
      skillUpdates.push({
        id: skill.id,
        status: 'pending',
        source: 'legacy',
        review_note: 'Needs workspace admin review',
      });
    }
  }

  return { memberSkillMoves, skillUpdates };
}
```

- [ ] **Step 4: Add Supabase cleanup executor**

Add:

```js
export async function cleanupLegacySkills({ db, workspaceId, skills }) {
  const plan = buildLegacySkillCleanupPlan({ skills });

  for (const move of plan.memberSkillMoves) {
    const { error } = await db
      .from('member_skills')
      .update({ skill_id: move.toSkillId })
      .eq('workspace_id', workspaceId)
      .eq('skill_id', move.fromSkillId);
    if (error) throw new Error('cleanup move member skills: ' + error.message);
  }

  for (const update of plan.skillUpdates) {
    const { id, ...patch } = update;
    const { error } = await db
      .from('skills')
      .update(patch)
      .eq('workspace_id', workspaceId)
      .eq('id', id);
    if (error) throw new Error('cleanup update skills: ' + error.message);
  }

  return plan;
}
```

Call it in `loadSkillMapData` after fetching skills:

```js
  const cleanupPlan = await cleanupLegacySkills({ db, workspaceId, skills });
  if (cleanupPlan.skillUpdates.length || cleanupPlan.memberSkillMoves.length) {
    skills = await fetchSkills(db, workspaceId);
  }
```

- [ ] **Step 5: Run data tests**

Run: `npm.cmd run test -- test/skill-map-data.test.js`

Expected: PASS.

- [ ] **Step 6: Commit cleanup helpers**

```bash
git add src/lib/app/skill-map-data.js test/skill-map-data.test.js
git commit -m "feat: cleanup legacy skill records"
```

## Task 7: Add Admin Review Actions

**Files:**
- Modify: `src/lib/app/skill-map-data.js`
- Modify: `test/skill-map-data.test.js`

- [ ] **Step 1: Add failing review action tests**

Add to `test/skill-map-data.test.js`:

```js
import {
  approvePendingSkill,
  mergePendingSkill,
  rejectPendingSkill,
} from '../src/lib/app/skill-map-data.js';

test('approvePendingSkill marks a proposal approved with audit metadata', async () => {
  const calls = [];
  const db = fakeUpdateDb(calls);

  await approvePendingSkill({
    db,
    workspaceId: 'ws-1',
    reviewerId: 'u-admin',
    skillId: 'skill-kafka',
    description: 'Kafka stream processing',
  });

  assert.deepEqual(calls[0], {
    table: 'skills',
    patch: {
      status: 'approved',
      source: 'proposal',
      description: 'Kafka stream processing',
      reviewed_by: 'u-admin',
      reviewed_at: calls[0].patch.reviewed_at,
      review_note: 'Approved as workspace skill',
    },
    filters: { workspace_id: 'ws-1', id: 'skill-kafka' },
  });
});

test('mergePendingSkill moves member skill rows and marks proposal merged', async () => {
  const calls = [];
  const db = fakeUpdateDb(calls);

  await mergePendingSkill({
    db,
    workspaceId: 'ws-1',
    reviewerId: 'u-admin',
    fromSkillId: 'skill-reactjs',
    toSkillId: 'skill-react',
  });

  assert.equal(calls[0].table, 'member_skills');
  assert.deepEqual(calls[0].patch, { skill_id: 'skill-react' });
  assert.deepEqual(calls[0].filters, { workspace_id: 'ws-1', skill_id: 'skill-reactjs' });
  assert.equal(calls[1].table, 'skills');
  assert.equal(calls[1].patch.status, 'merged');
  assert.equal(calls[1].patch.canonical_skill_id, 'skill-react');
});

test('rejectPendingSkill marks proposal rejected with review note', async () => {
  const calls = [];
  const db = fakeUpdateDb(calls);

  await rejectPendingSkill({
    db,
    workspaceId: 'ws-1',
    reviewerId: 'u-admin',
    skillId: 'skill-cloud',
    note: 'Too broad',
  });

  assert.equal(calls[0].patch.status, 'rejected');
  assert.equal(calls[0].patch.review_note, 'Too broad');
});

function fakeUpdateDb(calls) {
  return {
    from(table) {
      const call = { table, patch: null, filters: {} };
      calls.push(call);
      return {
        update(patch) {
          call.patch = patch;
          return {
            eq(column, value) {
              call.filters[column] = value;
              return this;
            },
            then(resolve) {
              resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd run test -- test/skill-map-data.test.js`

Expected: FAIL because review functions are missing.

- [ ] **Step 3: Implement review action functions**

Add to `src/lib/app/skill-map-data.js`:

```js
export async function approvePendingSkill({ db, workspaceId, reviewerId, skillId, description = '' }) {
  const patch = {
    status: 'approved',
    source: 'proposal',
    description: String(description || '').trim().slice(0, 500),
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_note: 'Approved as workspace skill',
  };
  const { error } = await db
    .from('skills')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', skillId);
  if (error) throw new Error('approve skill: ' + error.message);
}

export async function mergePendingSkill({ db, workspaceId, reviewerId, fromSkillId, toSkillId }) {
  const move = await db
    .from('member_skills')
    .update({ skill_id: toSkillId })
    .eq('workspace_id', workspaceId)
    .eq('skill_id', fromSkillId);
  if (move.error) throw new Error('merge skill member rows: ' + move.error.message);

  const patch = {
    status: 'merged',
    canonical_skill_id: toSkillId,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_note: `Merged into ${toSkillId}`,
  };
  const update = await db
    .from('skills')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', fromSkillId);
  if (update.error) throw new Error('merge skill: ' + update.error.message);
}

export async function rejectPendingSkill({ db, workspaceId, reviewerId, skillId, note }) {
  const patch = {
    status: 'rejected',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_note: String(note || 'Rejected by workspace admin').trim().slice(0, 500),
  };
  const { error } = await db
    .from('skills')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', skillId);
  if (error) throw new Error('reject skill: ' + error.message);
}
```

- [ ] **Step 4: Run review tests**

Run: `npm.cmd run test -- test/skill-map-data.test.js`

Expected: PASS.

- [ ] **Step 5: Commit review actions**

```bash
git add src/lib/app/skill-map-data.js test/skill-map-data.test.js
git commit -m "feat: add skill proposal review actions"
```

## Task 8: Wire Pending Profile and Admin Queue UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Modify: `test/profile-avatar-wiring.test.js`

- [ ] **Step 1: Add source-level UI tests**

Append to `test/profile-avatar-wiring.test.js`:

```js
test('App exposes pending skill review UI and pending profile section', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(source, /function PendingSkillReview/);
  assert.match(source, /Đang chờ duyệt/);
  assert.match(source, /approvePendingSkill/);
  assert.match(source, /mergePendingSkill/);
  assert.match(source, /rejectPendingSkill/);
});
```

- [ ] **Step 2: Run UI source test to verify failure**

Run: `npm.cmd run test -- test/profile-avatar-wiring.test.js`

Expected: FAIL because the UI is not wired yet.

- [ ] **Step 3: Import review actions and admin hook**

In `src/App.jsx`, extend imports:

```js
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
```

In `SkillMapApp`, add:

```js
  const isWorkspaceAdmin = useIsCurrentWorkspaceAdmin(activeScope.workspaceId);
```

Add handlers:

```js
  async function handleApprovePendingSkill(skillId) {
    setSaving(true);
    try {
      await approvePendingSkill({ db, workspaceId: activeScope.workspaceId, reviewerId: ctx.userId, skillId });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleMergePendingSkill(fromSkillId, toSkillId) {
    setSaving(true);
    try {
      await mergePendingSkill({ db, workspaceId: activeScope.workspaceId, reviewerId: ctx.userId, fromSkillId, toSkillId });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleRejectPendingSkill(skillId) {
    setSaving(true);
    try {
      await rejectPendingSkill({ db, workspaceId: activeScope.workspaceId, reviewerId: ctx.userId, skillId, note: 'Rejected from Skill Map review queue' });
      await reload();
    } finally {
      setSaving(false);
    }
  }
```

Pass to `Overview`:

```jsx
          isWorkspaceAdmin={isWorkspaceAdmin}
          onApprovePendingSkill={handleApprovePendingSkill}
          onMergePendingSkill={handleMergePendingSkill}
          onRejectPendingSkill={handleRejectPendingSkill}
          saving={saving}
```

- [ ] **Step 4: Add pending review UI**

Update `Overview` signature:

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
  isWorkspaceAdmin,
  onApprovePendingSkill,
  onMergePendingSkill,
  onRejectPendingSkill,
  saving,
}) {
```

Derive pending proposals:

```js
  const pendingSkills = members
    .flatMap((member) => (member.pendingSkills || []).map((skill) => ({ ...skill, memberName: member.name })))
    .filter((skill, index, list) => list.findIndex((item) => item.skillId === skill.skillId) === index);
```

Add after profile card:

```jsx
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
```

Add component before `SearchScreen`:

```jsx
function PendingSkillReview({ pendingSkills, approvedSkills, saving, onApprove, onMerge, onReject }) {
  const firstApproved = approvedSkills[0];
  return (
    <section className="panel pending-review">
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
```

- [ ] **Step 5: Show pending profile skills**

In `ProfileScreen`, derive pending:

```js
  const pendingProfileSkills = currentMember?.pendingSkills || [];
```

Render above the empty state:

```jsx
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
```

- [ ] **Step 6: Add CSS**

Append to `src/App.css`:

```css
.pending-review,
.pending-profile {
  display: grid;
  gap: 12px;
}

.pending-review-list {
  display: grid;
  gap: 10px;
}

.pending-review-list article,
.pending-profile div {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--taste-line, var(--mushy-line));
  border-radius: 16px;
  background: rgba(247, 241, 227, 0.08);
}

.pending-review-list article > div:last-child {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pending-review-list button {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--taste-line, var(--mushy-line));
  border-radius: 999px;
  background: var(--taste-paper, #fff);
  color: #11130f;
  font-weight: 900;
}

.pending-profile {
  padding: 14px;
  border: 1px solid var(--taste-line, var(--mushy-line));
  border-radius: 18px;
  background: rgba(247, 241, 227, 0.08);
}

.pending-profile strong,
.pending-profile span,
.pending-profile small {
  display: block;
}
```

- [ ] **Step 7: Run UI tests**

Run: `npm.cmd run test -- test/profile-avatar-wiring.test.js`

Expected: PASS.

- [ ] **Step 8: Commit UI wiring**

```bash
git add src/App.jsx src/App.css test/profile-avatar-wiring.test.js
git commit -m "feat: add skill proposal review UI"
```

## Task 9: Full Verification and Cleanup

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run full test suite**

Run: `npm.cmd run test`

Expected: PASS with all node:test tests.

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`

Expected: PASS. The existing Vite chunk-size warning can remain if no new warning/errors appear.

- [ ] **Step 3: Run local visual check**

Run a temporary dev server and open the app:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Expected:

- Overview heatmap shows only approved skills.
- Profile custom flow says `Đề xuất skill`.
- Pending proposals show under profile.
- Admin review queue appears only for workspace admin.
- No horizontal overflow on mobile or desktop.

- [ ] **Step 4: Inspect final diff**

Run: `git status --short`

Expected: only intended files are modified or untracked.

Run: `git diff --stat`

Expected: changes align with catalog, migration, data logic, tests, and small UI wiring.

- [ ] **Step 5: Final commit if any verification fixes were needed**

If Step 1-4 required edits, commit them:

```bash
git add src/lib/app/skill-catalog.js src/lib/app/skill-map-data.js src/App.jsx src/App.css test/skill-catalog.test.js test/skill-map-data.test.js test/profile-avatar-wiring.test.js migrations/002_team_skill_map.sql
git commit -m "fix: complete skill catalog verification"
```

Expected: commit succeeds, or there are no additional edits to commit.

## Self-Review

- Spec coverage: catalog source, DB metadata, mapper, sync, proposal flow, admin review, filtering, tests, and rollout are represented in Tasks 1-9.
- Red-flag scan: this plan avoids open-ended work items and uses concrete file paths, code snippets, commands, and expected outputs.
- Type consistency: catalog uses `skillType` in JS and `skill_type` in DB rows; skill status values are consistently `approved`, `pending`, `rejected`, and `merged`.
