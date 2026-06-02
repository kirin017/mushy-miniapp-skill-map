# AI Coach Level Plan Design

## Summary

Skill Map will add a personal AI Coach that helps a user plan how to move their existing skills to the next level. The coach opens from the overview screen, asks for a personal goal, reads only the current user's skill profile, and returns a structured level-up plan.

The feature stores each coach result as a history session so users can revisit earlier plans. It does not update skill levels automatically and does not create new skills.

## Current State

The app is a Vite and React mini-app with the main UI in `src/App.jsx`.

Existing relevant behavior:

- The overview screen has quick cards for Team Coverage and skill search.
- The profile screen lets users add, edit, and delete personal skills.
- Personal skills include level, interest, note, and catalog skill metadata.
- `api/ai-proxy.js` already verifies Mushy requests and calls Gemini through a server-side `GEMINI_API_KEY`.
- The AI proxy already supports structured role-based skill suggestions through an action-based request.

The new coach should reuse this AI proxy pattern and the existing skill profile data rather than adding a separate AI client.

## Goals

- Add a personal AI Coach entry point from the overview screen.
- Let the user enter a goal such as a target role, target skill, or growth direction.
- Generate a level-up plan based on the user's own existing skills.
- Return structured JSON that the app can validate and render safely.
- Store coach sessions so the user can review multiple past plans.
- Keep private team data out of the AI prompt.

## Non-Goals

- Sending other team members' names, skills, or notes to AI.
- Sending team coverage data to AI in version 1.
- Automatically changing skill levels or saving new skills.
- Creating a chat interface.
- Building a long 30-day learning roadmap.
- Adding rule-based fallback generation when AI fails.
- Adding provider abstraction beyond the current Gemini proxy.

## Selected Approach

The selected approach is a personal AI Coach with saved history.

The overview screen will add an `AI Coach` quick card. Selecting it opens a dedicated `CoachScreen`. The screen contains:

- a goal input;
- a `Tạo kế hoạch` action;
- the newest generated plan;
- a history list of previous coach sessions.

The coach request sends only:

- the user's typed goal;
- the current user's personal skills;
- level labels used by the app.

The coach response is validated JSON. Valid results are persisted to a new database table and displayed in the coach screen.

## User Experience

### Entry Point

The overview screen will include a new `AI Coach` quick card near the existing quick actions. It opens the coach screen without adding a new bottom navigation tab.

### Coach Screen

The coach screen will use the existing compact screen pattern with a `TopBar`.

Primary content:

- Goal field with placeholder examples such as `Muốn lên Middle Frontend` or `Muốn cải thiện Docker`.
- Create button with loading state.
- Latest plan section.
- History section.

If the user has no personal skills, the screen shows an empty state asking them to add skills in the profile flow first.

### Plan Rendering

Each plan item shows:

- skill name;
- current level;
- target level;
- reason;
- next step.

The coach does not mutate profile data. Users still update levels through the existing `Cá nhân` flow.

## Data Model

Add an `ai_coach_sessions` table in the app schema.

Fields:

- `id` UUID primary key.
- `workspace_id` UUID, required.
- `user_id` UUID, required.
- `goal_text` text, required.
- `summary` text, required.
- `items` JSONB, required.
- `created_at` timestamptz, required with default `now()`.

RLS and query rules:

- Every row belongs to one `workspace_id`.
- Users can read and insert only their own sessions in the current workspace.
- Client queries must include `.eq('workspace_id', ctx.workspaceId)` or the active scope workspace.
- The table follows the mini-app rule that data lives in the app schema, not `public`.

The stored `items` JSON should contain only validated plan data, not raw model output.

## API Contract

Extend `api/ai-proxy.js` with action `coach_level_plan`.

Request body:

```json
{
  "action": "coach_level_plan",
  "goalText": "Muốn lên Middle Frontend",
  "profileSkills": [
    {
      "skill_id": "frontend.react",
      "name": "React",
      "category": "Frontend",
      "level": 2,
      "interest": 3,
      "note": "Đã làm form và API loading"
    }
  ],
  "levelLabels": ["Học", "Cơ bản", "Làm được", "Thành thạo", "Mentor"],
  "maxItems": 6
}
```

Successful response:

```json
{
  "summary": "Tập trung nâng React và TypeScript trước.",
  "items": [
    {
      "skill_id": "frontend.react",
      "current_level": 2,
      "target_level": 3,
      "reason": "React là nền tảng chính cho mục tiêu Frontend.",
      "next_step": "Build một màn hình có state, form validation và API loading."
    }
  ]
}
```

Validation rules:

- `goalText` must be non-empty and capped to a reasonable length.
- `profileSkills` must be a non-empty array.
- Only reduced personal skill fields are accepted.
- `maxItems` is clamped to a small range, such as 1 to 8.
- AI output must parse as JSON, including markdown-fenced JSON.
- `items` must be an array.
- `skill_id` must match one of the submitted personal skills.
- `current_level` must match the submitted current level for that skill.
- `target_level` must be greater than `current_level` and no higher than 4.
- Duplicate `skill_id` values are removed.
- `summary`, `reason`, and `next_step` are trimmed and length-capped.

If the AI returns mixed valid and invalid items, the server keeps valid items and drops invalid ones. If no valid items remain, the request fails with a structured validation error.

## Prompt Privacy

The Gemini prompt must not include:

- workspace name;
- team member names;
- team member skill data;
- team coverage data;
- private app context beyond the current user's personal skill profile.

The prompt may include:

- goal text;
- personal skill names and categories;
- current level and interest;
- short personal notes from the user's own profile;
- level labels.

## Client Data Flow

1. User opens overview.
2. User selects `AI Coach`.
3. App loads the user's current `profileSkills` from existing state.
4. User enters a goal.
5. Client calls `/api/ai-proxy` with `action: "coach_level_plan"`.
6. Server verifies the Mushy request.
7. Server prompts Gemini and validates the JSON.
8. Client stores the validated session in `ai_coach_sessions`.
9. Client renders the newest plan.
10. Client reloads session history for the current workspace and user.

If storing fails after a successful AI response, the app should show the generated plan but report that history was not saved.

## Error Handling

Client behavior:

- Empty goal disables generation or shows a local validation message.
- No personal skills shows an empty state and does not call AI.
- Loading disables duplicate generate actions.
- API errors show a clear retryable error.
- Failed history save does not discard the generated plan.

Server behavior:

- Missing API key returns a structured server error.
- Upstream Gemini failure returns a structured upstream error.
- Invalid JSON returns a structured validation error.
- Valid JSON with no usable items returns a structured validation error.

There is no rule-based fallback in version 1.

## Testing Plan

Unit tests:

- Coach JSON parser accepts strict JSON.
- Coach JSON parser accepts markdown-fenced JSON.
- Validator drops items with unknown `skill_id`.
- Validator rejects target levels that are not above the current level.
- Validator rejects target levels above the app maximum.
- Validator removes duplicate skills.
- Validator caps item count.
- Request handling rejects empty goal text.
- Request handling rejects empty personal skill lists.

Integration-oriented tests:

- AI proxy action `coach_level_plan` returns validated output with a mocked fetch response.
- Invalid model output returns a structured error.

Verification commands:

- `npm run test`
- `npm run build`

Manual pass:

- Open overview.
- Open `AI Coach`.
- Generate a plan from a valid goal.
- Confirm the plan shows current and target levels.
- Confirm history contains the saved session.
- Confirm no generation occurs when the user has no profile skills.

## Rollout Plan

1. Add coach parser, validator, and tests.
2. Extend `api/ai-proxy.js` with `coach_level_plan`.
3. Add migration for `ai_coach_sessions`.
4. Add client helpers for saving and loading coach sessions.
5. Add `CoachScreen` and overview quick card.
6. Verify with tests, build, and manual browser pass.

## Risks And Mitigations

- AI returns invalid or verbose output.
  Mitigation: parse defensively, validate strictly, and show retryable errors.

- AI suggests changing skills the user does not have.
  Mitigation: server drops unknown skills and requires every item to match submitted profile skills.

- The feature leaks team data.
  Mitigation: the prompt contract excludes team data, and request construction uses only `profileSkills`.

- Users expect the coach to update levels automatically.
  Mitigation: UI copy and behavior keep the coach as planning only; edits remain in the profile screen.

- History grows over time.
  Mitigation: load a limited recent history list in the UI and keep pagination or cleanup out of v1.
