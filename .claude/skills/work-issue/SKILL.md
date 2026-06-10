---
name: work-issue
description: >-
    Work a Linear issue end-to-end in an isolated git worktree and open a GitHub
    PR. Use when the user wants to pick up, start, or "work the next" Linear issue
    (e.g. "work COD-23", "grab the next Todo issue", "knock out the backlog one by
    one"). Handles issue selection, In Progress, worktree setup, implementation,
    quality gates, code review, branch/commit/PR conventions, and moving the issue
    to In Review.
---

# Work a Linear issue → worktree → PR

A repeatable loop for taking one Linear issue from **Todo** to an open GitHub PR
in **In Review**, working in an isolated worktree so issues don't collide.

This skill operationalizes the conventions already documented in
[`AGENTS.md`](../../../AGENTS.md) ("Issue tracking — Linear"). Those are the
source of truth; this is the step-by-step execution.

## Ground rules

- **One issue per worktree, one issue at a time.** Worktrees give _file_
  isolation, not _logical_ isolation — two issues that touch the same files
  still merge-conflict. Finish (or park) one before starting another. Only run
  issues in parallel when they're in clearly separate areas of the codebase.
- **Issue tracker is Linear** via the `linear-server` MCP. Project: **Family
  Chat**, team **CodeVachon**, issue keys look like `COD-23`. (AGENTS.md uses
  `FAM-123` as a placeholder; the real prefix is `COD-`.)
- **The PR title is load-bearing.** `.github/workflows/release-linear.yml`
  scrapes issue keys out of release notes (built from merged PR titles) to move
  issues to Done on release. If the key isn't in the PR title, the issue never
  auto-closes.

## The loop

### 1. Pick the issue

- If the user named one (e.g. "work COD-23"), use it.
- Otherwise list candidates and pick the top one (highest priority, then oldest):
    ```
    Linear MCP: list_issues  project="Family Chat"  state="Todo"
    ```
    Confirm the choice with the user before starting if it wasn't named explicitly.
- Read the **full** issue — `get_issue COD-NN` — including description, acceptance
  criteria, and comments. Capture two things you'll reuse verbatim:
    - the **title** (for the PR title)
    - the **`gitBranchName`** field (Linear's canonical branch name, e.g.
      `corglen/cod-23-coerce-mention-hue-...`) — using it makes Linear's GitHub
      auto-linking work.

### 2. Move it to In Progress

```
Linear MCP: save_issue  id="COD-NN"  state="In Progress"
```

Assign it to the user if unassigned. This signals the issue is being worked and
prevents double-pickup.

### 3. Create the worktree

Run the helper from the **main checkout**:

```bash
.claude/skills/work-issue/setup-worktree.sh COD-NN "<gitBranchName>"
```

It creates `../family-chat-worktrees/COD-NN` off the latest `origin/main`,
symlinks the gitignored root `.env`, and runs `bun install`. **All subsequent
work happens in that directory** — `cd` into it.

> Why a sibling dir and a symlinked `.env`: the worktree is kept outside the repo
> so Turbo/ESLint/git never scan it, and a fresh worktree has no `.env` (it's
> gitignored) — without the symlink, `apps/web` and `packages/db` dotenv loads
> fail. Postgres (docker, host port **5433**) is shared across worktrees; there
> is one local DB, so be careful with destructive migrations.

### 4. Implement

- Make the change scoped to this issue. Match surrounding code style and the
  repo conventions in `AGENTS.md` (e.g. the `data-component` attribute on every
  React component's root element).
- New work you discover mid-task that you won't finish now → file a **new** Linear
  issue (`save_issue` into project "Family Chat"), don't silently expand scope.
- Reference `COD-NN` in commit messages.

### 5. Quality gates (must pass before pushing)

Run in the worktree, fix anything that fails:

```bash
bun run format                  # Prettier (whole repo) — required by AGENTS.md
bun run format:check            # Prettier --check — mirrors the CI gate exactly
bunx fallow audit --explain     # local gate; fix "fail" verdicts (fallow is a dev dep, run via bunx)
bun run lint                    # ESLint across the workspace
bun run typecheck               # tsc
```

> `format`/`format:check` run Prettier over the **whole repo** (all extensions —
> ts/tsx, md, json, css, yaml — respecting `.prettierignore`), matching the CI
> Prettier step. Markdown/JSON/YAML-only changes are covered, so a docs-only PR
> can't pass locally yet fail CI.

`fallow` gates only findings **introduced** by this changeset (`gate=new-only`).
Inherited findings on touched files are reported but non-blocking. Treat a JSON
`{ "error": true, ... }` as non-blocking. The same checks run in CI
(`.github/workflows/pr-checks.yml`), so green locally ≈ green on the PR.

### 6. Code review

Run `/code-review` over the changeset and **apply the corrections it surfaces**
before anything is committed or pushed:

```
/code-review --fix
```

- `--fix` applies the findings to the working tree. Review the applied changes,
  then re-run the relevant quality gates from step 5 (at minimum `bun run format`
  and `bun run typecheck`) to confirm the corrections didn't break anything.
- If a finding is a false positive or out of scope for this issue, note why
  instead of applying it — don't expand scope (file a new Linear issue per the
  step 4 rule if it's real but separate work).
- Only proceed to commit/push once the review is clean (no outstanding
  high-confidence findings).

### 7. Commit & push

```bash
git add -A
git commit -m "COD-NN: <concise summary of the change>"
git push -u origin <gitBranchName>
```

(End the commit body with the `Co-Authored-By` trailer per repo/global policy.)

### 8. Open the PR

```bash
gh pr create \
  --base main \
  --title "COD-NN - <Issue Title>" \
  --body "$(cat <<'EOF'
## Summary
- <what changed and why>

## Linear
Closes COD-NN

## Verification
- format / fallow / lint / typecheck pass locally
EOF
)"
```

- **Title format `COD-NN - <Title>` is mandatory** (drives the release→Linear
  automation). Note the `-` separator.
- `Closes COD-NN` in the body uses a Linear magic word so the issue links and
  auto-completes when the PR merges (belt-and-suspenders with the release flow).

### 9. Update Linear

```
Linear MCP: save_issue   id="COD-NN"  state="In Review"
Linear MCP: save_comment issueId="COD-NN"
            body="PR opened: <pr-url>. <one-line summary of the change>."
```

Don't set Done by hand — the release automation moves it to Done when the
release that includes this PR is published.

### 10. Report & clean up

- Give the user the PR URL and a one-line summary.
- After the PR is **merged**, remove the worktree from the main checkout:
    ```bash
    git worktree remove ../family-chat-worktrees/COD-NN
    git branch -d <gitBranchName>   # optional; remote branch is deleted by GitHub on merge
    ```
- If looping through several issues, return to step 1 for the next one.

## Quick reference

| Thing          | Value                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Branch name    | Linear issue `gitBranchName` (e.g. `corglen/cod-23-…`)                                                           |
| Commit message | `COD-NN: <summary>`                                                                                              |
| PR title       | `COD-NN - <Issue Title>` (the `-` matters)                                                                       |
| PR body link   | `Closes COD-NN`                                                                                                  |
| Worktree path  | `../family-chat-worktrees/COD-NN`                                                                                |
| Linear states  | Todo → **In Progress** (start) → **In Review** (PR) → Done (release auto)                                        |
| Local gates    | `bun run format` · `bun run format:check` · `bunx fallow audit --explain` · `bun run lint` · `bun run typecheck` |
| Code review    | `/code-review --fix` before commit/push; re-run gates after applying fixes                                       |
