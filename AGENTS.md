# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 0. Project Context

- Monorepo: `backend/` và `client/` — do NOT cross-import between folders
- Repo: `giahuyduongdev/finsight-app`, base branch: `develop`
- Before touching backend code: read `skills/backend.md`
- Before touching frontend code: read `skills/frontend.md`
- Before fixing CodeRabbit comments: read `skills/coderabbit.md`

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan before starting:

```
type: feature | fix | refactor | chore
branch: <type>/<short-description>
steps:
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  3. [Step] → verify: [check]
```

Branch name must be decided in the plan and used consistently throughout. Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Git & PR Workflow

**Always follow this after completing any task.**

### Branch naming
Decided during planning (Section 4), not after. Format:
- `feature/<short-description>` — new functionality
- `fix/<short-description>` — bug fix
- `refactor/<short-description>` — code improvement
- `chore/<short-description>` — tooling, deps, config

### Before committing — verify task is complete

> [!NOTE]
> - **macOS / Linux (zsh/bash):** The `&&` operator works natively.
> - **Windows PowerShell:** **PowerShell 5.1 (default) does NOT support `&&`.** In that case, use `;` (sequential even if fails) or run them as separate sequential commands. Alternatively, use `cmd /c "command1 && command2"` or upgrade to **PowerShell 7+** which supports `&&`.

```bash
# Backend
(cd backend && npm run type-check && npm run lint)

# Frontend
(cd client && npm run build && npm run lint)
```

If any errors → fix them first. Do not commit broken code.

Then stop and notify user:

```text
✅ Task complete. Ready to commit.
Summary of changes:
- <what was done>

Proceed with commit? (y/n)
```

Wait for user to confirm. If the reply indicates approval → proceed. If it indicates changes are needed → fix and re-verify.

### Required git steps (in order)

```bash
# 1. Create and switch to branch (always — never commit directly to develop)
git checkout -b <branch-name>

# 2. Stage and commit
git add .
git commit -m "<type>(<scope>): <description>

- <what changed>
- <why or impact>
- <3rd line only if genuinely needed>"

# Body rules: 2-3 lines max. Each line = 1 specific thing. No vague lines like "minor fixes".

# 3. Push
git push origin <branch-name>
```

### Create PR via GitHub MCP
Use GitHub MCP to create a PR:
- repo: `giahuyduongdev/finsight-app`
- base branch: `develop`
- title: same as commit message
- body: summary of changes made

### After PR is created — monitor via GitHub MCP

**CI check (timeout: 10 minutes):**
- Use GitHub MCP to get check runs status for the PR
- All checks pass → proceed to CodeRabbit check
- Any check fails → read the error, apply a minimal fix (only lines needed — see Section 3), commit, push, re-check
- Still failing after 10 minutes → stop and notify user: "⚠️ CI still failing after 10 minutes: <PR link>. Manual intervention needed."

**CodeRabbit check:**
- Use GitHub MCP to get PR check runs status
- If CodeRabbit status is `in_progress` → wait 60 seconds and re-check (max 10 minutes)
- Still in progress after 10 minutes → stop and notify user: "⚠️ CodeRabbit review not complete after 10 minutes: <PR link>. Manual intervention needed."
- Only after CodeRabbit review status is `completed`: use GitHub MCP to get PR review comments
- Read `skills/coderabbit.md` to know which comments to act on
- 🔴 Critical → fix immediately
- 🟠 Major → fix before notifying user
- 🟡 Minor → fix only if it's a 1-line change, otherwise skip
- ⚪ Info → ignore
- After fixing: commit, push, re-check CI and CodeRabbit
- No Critical/Major comments remaining → proceed

**When everything is green**, notify user and stop:

```text
✅ PR ready for your review: <PR link>
- CI: all checks passed
- CodeRabbit: no critical or major comments
```

Do NOT merge — user reviews the PR manually before merging.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.