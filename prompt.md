# Strict Task Execution Workflow (PRD-Driven)

This workflow is mandatory for every coding session.

## Scope
- Source of truth: `PRD.json`
- One active user story per session
- No work outside the selected user story unless required to satisfy its acceptance criteria

## Hard Rules
- Always pick the highest-priority unfinished story.
- Never start a second story before finishing, blocking, or explicitly pausing the current one.
- Keep all implementation in TypeScript.
- Use Bun for package management and script execution.
- Use Convex for all backend data and server-side logic.
- Do not include unrelated refactors, formatting sweeps, or dependency upgrades.
- Do not edit unrelated files.

## Status Model
Use only these values in the `status` key:
- `unstarted`
- `in-progress`
- `blocked`
- `completed`

## Deterministic Story Selection
Use this exact selection logic every session:

1. Parse `PRD.json.userStories`.
2. Filter stories where `passes === false`.
3. Exclude stories where `status === "blocked"` unless explicitly instructed to unblock.
4. Sort remaining stories by:
   - `priority` ascending,
   - then `id` ascending (lexicographic) as tie-breaker.
5. Select index `0` from that sorted list as the active story.
6. Immediately set selected story `status` to `in-progress`.

If no selectable stories exist:
- report "No actionable stories remaining" and stop implementation.

Reference `jq` check (optional):

```bash
jq -r '.userStories
  | map(select(.passes == false))
  | map(select(.status != "blocked"))
  | sort_by(.priority, .id)
  | .[0]' PRD.json
```

## Branch Naming
- Required format: `<owner>/<story-id>-<short-slug>`
- Example: `azemzale/us-005-create-server`
- Story ID in branch name must match the active user story.

## Mandatory Session Procedure

1. Read `PRD.json`.
2. Select the active story using the deterministic selection logic above.
3. Immediately update that story `status` to `in-progress`.
4. Create and switch to story branch.
5. Implement only what is needed for that story.
6. Verify all acceptance criteria one by one.
7. Run validation commands.
8. Update `PRD.json`:
   - `passes: true`
   - `status: completed`
9. Append useful session insights to `learnings.txt`.
10. Commit, push, and open/update PR.

## Required Validation Commands
Run these from project root (adapt only if repo uses different script names):

```bash
bun install
bun run typecheck
bun run test
bun run build
```

If a command does not exist:
- do not invent behavior,
- record which command is missing in PR notes,
- run the closest available equivalent.

## PRD Update Rules
- Never mark `passes: true` unless every acceptance criterion is satisfied.
- If partially done, keep `passes: false` and set blocked/in-progress state accurately.
- Do not reorder user stories unless explicitly instructed.
- Do not use a `notes` field in stories; use `status` only.

## Commit Rules
- One focused commit per completed story (or small logical series if necessary).
- Commit message format:

```text
feat(<story-id>): <short outcome>
```

- Examples:
  - `feat(us-003): add login/logout session flow`
  - `feat(us-006): implement channel create/delete permissions`

## Push and PR Rules
- Push current branch with upstream:

```bash
git push -u origin <branch-name>
```

- Create or update PR only with GitHub CLI (`gh`), never via browser-only flow.
- Before creating PR, verify auth and repo context:

```bash
gh auth status
gh repo view
```

- Create PR command (use from story branch):

```bash
gh pr create \
  --base main \
  --head <branch-name> \
  --title "feat(<story-id>): <short outcome>" \
  --body "$(cat <<'EOF'
## Story
- ID: <story-id>
- Title: <story-title>

## Acceptance Criteria
- [x] <criterion 1>
- [x] <criterion 2>
- [x] <criterion 3>

## Validation
- bun run typecheck
- bun run test
- bun run build

## Notes
- <important implementation detail>
- <blocker/deferred item if any>
EOF
)"
```

- If PR already exists for the branch, update it instead of creating a second PR:

```bash
gh pr edit --title "feat(<story-id>): <short outcome>" --body-file <path-to-body.md>
```

- After creating/updating, always capture and record PR URL:

```bash
gh pr view --json url --jq .url
```

- PR description must include:
  - Story ID + title
  - Acceptance criteria checklist
  - Validation commands run + results
  - Any blockers or deferred items

## learnings.txt Rules
After each session, append:
- Date
- Story ID
- What worked
- What failed/pitfalls
- Reusable pattern/decision

Template:

```text
## YYYY-MM-DD - <story-id>
- Worked: ...
- Pitfall: ...
- Decision: ...
- Reuse: ...
```

## Blocker Protocol
If blocked:
1. Update story `status` to `blocked`.
2. Commit safe partial progress.
3. Push branch.
4. Document exact unblock requirement in PR description and `learnings.txt`.

## Done Criteria (Strict)
A story is done only if all are true:
- All acceptance criteria pass.
- Validation commands executed (or documented missing scripts).
- `PRD.json` updated (`passes: true`, `status: completed`).
- `learnings.txt` appended.
- Branch committed and pushed.
- PR created/updated with verification details.
