# Strict Task Execution Workflow (PRD-Driven)

This workflow is mandatory for every coding session.

## Scope

- Source of truth: `PRD.json`
- One active user story per worker/session
- No work outside the selected user story unless required to satisfy its acceptance criteria
- Sessions may run from a Git worktree inside a bare repo. In such case create
  new worktree for each story branch and place it in the current directory.

## Hard Rules

- Always pick the highest-priority ready unfinished story.
- A story is ready only when all `dependsOn` stories have `passes === true`.
- Multiple workers may run in parallel, but each worker may own only one active story at a time.
- If a story branch is already mapped to any existing worktree path, treat that story as already taken by another worker and do not select it.
- Keep all implementation in TypeScript.
- Use Bun for package management and script execution.
- Use Convex for all backend data and server-side logic.
- Do not include unrelated refactors, formatting sweeps, or dependency upgrades.
- Do not edit unrelated files.
- Do not ask the user to run obvious next steps; execute commit/push/PR steps directly when required by this workflow.

## Dependency Graph Rules

- Each story may include `dependsOn: string[]` with story IDs.
- `dependsOn` values must reference existing story IDs.
- `dependsOn` must not include the story's own ID.
- Dependency graph must remain acyclic.
- Stories without `dependsOn` are treated as `dependsOn: []`.

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
4. Exclude stories where any `dependsOn` story has `passes !== true`.
5. Exclude stories already assigned to a different worker when `assignee` is present.
6. Exclude stories whose required branch is already mapped by `git worktree list`.
7. Sort remaining stories by:
   - `priority` ascending,
   - then `id` ascending (lexicographic) as tie-breaker.
8. Select index `0` from that sorted list as the candidate story.
9. Validate branch/worktree availability for that candidate.
10. Only after availability is confirmed, set selected story `status` to `in-progress` and set `assignee` to current worker/owner.

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
- In worktree setups, each worktree should map to exactly one story branch.

## Worktree Safety Guardrails

- Never run `git checkout <story-branch>` in a workspace path that is not already mapped to that branch.
- In worktree mode, always create/use a dedicated worktree path per story branch.
- For a new story branch, always create a new worktree path first; do not repurpose the current path by branch switching.
- Before any checkout/switch, run:

```bash
git worktree list
git branch --show-current
pwd
```

- If the target branch is already attached to a different worktree path, do not switch in the current directory.
- In that case, treat that story as taken and select the next eligible story.
- Do not attempt to "steal" a branch from another worktree or detach it implicitly.

## Mandatory Session Procedure

1. From the `main` worktree, pull latest changes from `origin/main`.
2. Only after pulling latest `main`, check out/read `PRD.json`.
3. Select a ready active story using the deterministic selection logic above.
4. Validate branch/worktree availability for the selected story.
5. Ensure you are in the correct story branch for this worktree:
   - If the current branch already matches the story, keep it.
   - If working with worktrees, always create/use a new dedicated worktree path for the story branch.
   - If the story branch is already used by another worktree, treat that story as taken and re-run selection for the next eligible story.
   - Never switch branches inside an existing worktree path to start a different story.
6. After step 5 succeeds, update that story `status` to `in-progress` and set `assignee`.
7. Implement only what is needed for that story.
8. Verify all acceptance criteria one by one.
9. Run validation commands.
10. Update `PRD.json`:
    - `passes: true`
    - `status: completed`
    - clear `assignee`
11. Append useful session insights to `learnings.txt`.
12. Commit, push, and open/update PR.

## Required Validation Commands

Run these from project root (adapt only if repo uses different script names):

```bash
bun install
bun run typecheck
bun run lint
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

- If using worktrees, confirm branch/worktree mapping before push:

```bash
git worktree list
git branch --show-current
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
- bun run lint
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
