# Role-Based Skill Suggestions Design

## Summary

Skill Map will add role-based skill suggestions to the profile skill entry flow. Users can type a role such as `AI engineer` or choose a quick role chip, then receive suggested skills from the existing approved catalog.

The selected approach is a hybrid AI and local fallback design:

- Gemini is the primary suggestion engine through the existing server-side proxy.
- The proxy returns validated JSON instead of free-form text.
- Suggestions are restricted to existing catalog skills by `catalog_key`.
- Local fallback covers common roles when the AI call fails or returns unusable output.
- Users still save skills through the current profile flow, including level, interest, and note.

## Current State

The app is a Vite/React mini-app. The profile flow lives in `src/App.jsx`, mostly inside `ProfileScreen`.

Current behavior:

- `PRESET_SKILLS` is derived from `STANDARD_SKILLS`.
- Approved catalog skills appear in the profile picker.
- Users can add an approved catalog skill or propose a custom skill.
- Unknown skills are created as pending proposals, not approved catalog entries.
- `api/ai-proxy.js` exists and calls Gemini with `GEMINI_API_KEY`, but it currently accepts a generic prompt and returns free-form text.

The new feature should reuse this structure rather than adding a new persistence model.

## Goals

- Help users choose skills faster by starting from a role.
- Support preset role chips and free-form role input.
- Use Gemini via a server-side proxy so API keys stay off the client.
- Return structured, validated JSON from the proxy.
- Keep skill data clean by allowing only existing catalog skills in suggestions.
- Keep the first version small enough to test and ship safely.

## Non-Goals

- Generating new catalog skills with AI.
- Automatically saving suggested skills without user confirmation.
- Persisting role input or suggestion history.
- Building a full role taxonomy database.
- Replacing the existing custom skill proposal flow.
- Adding a provider-agnostic AI abstraction in v1.

## Selected Approach

The feature will use Gemini through the existing `api/ai-proxy.js`, but the endpoint behavior will become action-based.

For role suggestions, the client sends:

- `action`: `suggest_role_skills`
- `roleText`: the typed or selected role
- `catalog`: a reduced catalog list with `key`, `name`, `category`, `skillType`, and `aliases`
- `maxSuggestions`: default 10

The proxy prompts Gemini to return JSON only:

```json
{
  "role": "AI Engineer",
  "suggestions": [
    {
      "catalog_key": "aiml.rag",
      "reason": "Common for building LLM products with private knowledge."
    }
  ]
}
```

The server parses and validates the response before returning it to the client. The server must drop any suggestion that does not reference a known catalog key.

## Architecture

### Server

`api/ai-proxy.js` will keep request verification through `_verify.js`.

The proxy will support `action: "suggest_role_skills"` and may keep the old generic prompt path only if needed for backward compatibility. The role suggestion path should be explicit and validated.

Validation rules:

- `roleText` must be a non-empty string with a reasonable max length.
- `catalog` must be an array of catalog entries with stable keys.
- `maxSuggestions` is clamped to a small range, such as 1 to 12.
- Gemini output must parse as JSON, including when wrapped in a markdown JSON fence.
- `suggestions` must be an array.
- Every `catalog_key` must exist in the supplied catalog.
- Duplicate `catalog_key` values are removed.
- Reasons are optional and trimmed to a short length.
- The response is capped by `maxSuggestions`.

If Gemini fails or returns malformed JSON, the proxy returns a non-2xx structured error so the client can use fallback. If Gemini returns valid JSON but none of the suggested keys survive validation, the proxy returns `200` with an empty `suggestions` array.

### Client

The client will add a small role suggestion panel inside `ProfileScreen`, visible when the add-skill form is open.

The panel includes:

- A role text input.
- Quick role chips such as `AI Engineer`, `Frontend Engineer`, `Backend Engineer`, `DevOps Engineer`, and `Product Designer`.
- A `Gợi ý skill` button.
- Loading, error, empty, and result states.

Suggested skills are mapped from `catalog_key` to the existing `profileSkillCatalog` rows. Skills already present in `profileSkills` are hidden or disabled so users cannot add duplicates.

Clicking a suggestion updates the existing draft:

- `customSkill = false`
- `skillId = selected skill id`

The user then chooses level, interest, and note, and saves through the existing `saveProfileSkill` flow.

### Local Fallback

A local fallback map will cover common roles. It should live near the catalog helpers rather than inside JSX when possible.

Initial role coverage:

- `AI Engineer`: Prompt Engineering, LLM Integration, RAG, Embeddings, Vector Databases, Machine Learning, Python Backend, REST API Design, PostgreSQL.
- `Frontend Engineer`: React, Next.js, TypeScript, Tailwind CSS, Web Accessibility, State Management.
- `Backend Engineer`: Node.js, Python Backend, FastAPI, REST API Design, PostgreSQL, Redis, Docker.
- `DevOps Engineer`: Docker, Kubernetes, AWS, Google Cloud, Azure, CI/CD, Infrastructure as Code, Monitoring.
- `Product Designer`: UX Research, UI Design, Design Systems, Prototyping, Figma, Product Management.

Free-form input should match fallback roles through simple normalized aliases such as `ai engineer`, `ml engineer`, `frontend dev`, `devops`, and `designer`.

Fallback output must also be filtered through the active catalog so stale keys do not appear.

## Data Flow

1. User opens `Cá nhân` and taps `+ Thêm kỹ năng`.
2. User types a role or selects a quick role chip.
3. Client sends a role suggestion request to `/api/ai-proxy`.
4. Proxy verifies the user request.
5. Proxy calls Gemini with the reduced catalog and JSON-only instructions.
6. Proxy parses and validates Gemini output.
7. Client maps valid `catalog_key` suggestions to existing skill rows.
8. Client filters out skills already in the user's profile.
9. User selects one suggested skill.
10. Existing profile save flow persists the member skill.

If steps 3-6 fail, the client computes fallback suggestions locally and continues without saving any AI data.

## UI Behavior

The suggestion panel should be compact because it appears inside the existing profile form.

States:

- Idle: shows role input, quick chips, and button.
- Loading: disables suggestion button and shows a short loading label.
- Results: shows suggested skill chips with icons and optional short reasons.
- Empty: shows that no matching catalog skills were found.
- Error with fallback: shows fallback results if available and a subtle note that AI suggestions were unavailable.

The panel should not introduce a new screen or modal in v1.

## Error Handling

Server-side errors:

- Missing API key returns a structured error.
- Upstream Gemini errors return a structured upstream error.
- Invalid Gemini output returns a structured validation error.
- Valid Gemini output with no usable catalog keys returns success with an empty `suggestions` array.

Client behavior:

- Never crash the add-skill form because suggestions failed.
- Fall back locally for known roles.
- Show an empty state if there are no valid catalog skills.
- Keep the user's typed role in the input after errors.
- Do not save role text, AI output, or reasons to the database.

## Security and Privacy

- `GEMINI_API_KEY` remains server-side only.
- The proxy continues to require a verified Mushy request.
- The prompt includes only the role text and reduced public catalog metadata.
- No member profile, notes, levels, interests, workspace names, or private team data are sent to Gemini.
- The client does not accept AI-created skill names as approved skills.

## Testing Plan

Unit tests:

- Role suggestion JSON parser accepts strict JSON.
- Parser accepts markdown-fenced JSON.
- Parser drops unknown catalog keys.
- Parser removes duplicate keys.
- Parser clamps suggestions to `maxSuggestions`.
- Parser handles malformed JSON as a validation failure.
- Fallback role matching maps `AI engineer` and aliases to known catalog keys.
- Fallback returns no stale keys if a key is absent from the active catalog.
- Client/helper filtering removes skills already present in `profileSkills`.

Verification commands:

- `npm run test`
- `npm run build`

Manual visual pass after implementation:

- Open local app.
- Open profile add-skill form.
- Try a quick role chip.
- Try typed `AI engineer`.
- Simulate proxy failure and confirm fallback results.
- Confirm selecting a suggestion fills the normal add-skill form and saving still works.

## Rollout Plan

1. Add role suggestion helper functions and tests.
2. Update `api/ai-proxy.js` with the `suggest_role_skills` action and validation.
3. Add client request helper for role suggestions.
4. Add the role suggestion panel to `ProfileScreen`.
5. Filter suggestions against existing profile skills.
6. Verify with tests, build, and a local visual pass.

## Risks and Mitigations

- Gemini returns invalid or verbose output.
  Mitigation: parse defensively, support JSON fences, validate keys, and fall back locally.

- AI suggests skills that do not exist in the catalog.
  Mitigation: drop unknown keys server-side and client-side.

- Sending the full catalog increases prompt size.
  Mitigation: send only reduced catalog metadata and cap catalog fields.

- The profile form becomes visually crowded.
  Mitigation: keep the panel compact, only show it in add mode, and reuse existing chip styles.

- Model/API behavior changes.
  Mitigation: keep the local fallback and structured validation as the contract.
