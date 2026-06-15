# Daily Workflow

See: daily-workflow.mmd

## Goal

Handle small daily tasks without full SDD overhead.

---

## When To Use

- Bug fix
- Small API change
- UI tweak
- Validation update
- Small refactor
- Small CRUD task
- Small improvement

---

## Step 1 - Task Request

Provide a small task request.

The request can be rough and incomplete.

---

## Step 2 - Clarify Task If Needed

Use brainstorming if installed when the task is ambiguous.

Otherwise:

- clarify expected behavior
- identify edge cases
- identify success criteria

Skip this step when the task is already clear.

---

## Step 3 - Generate Lightweight Requirements

Document briefly in the working response:

- goal
- expected behavior
- edge cases
- success criteria

Do not create docs/specs files unless the task grows in scope.

---

## Step 4 - Generate Lightweight Tasks

Document briefly in the working response:

- implementation checklist
- files likely affected
- validation checklist

---

## Step 5 - Create Branch

Create a normal Git branch before implementation work.

Branch creation may be skipped for trivial documentation, comment, formatting, or read-only investigation tasks.

Recommended branch names:

- fix/<name>
- enhancement/<name>
- chore/<name>

Git worktrees are usually not needed for daily tasks.

---

## Step 6 - TDD Implementation

Use tdd if installed and the behavior is testable.

Otherwise:

- one behavior at a time
- test public behavior only
- Red -> Green -> Refactor
- keep changes surgical

For non-behavioral changes such as copy, styling, docs, or configuration, use the smallest meaningful verification instead of forcing a full TDD loop.

---

## Step 7 - Verification

Use verification-loop if installed.

Otherwise:

- run tests
- run lint
- run typecheck
- run build
- verify expected behavior

---

## Step 8 - Security Review If Relevant

Run this step when the task touches authentication, authorization, user input, secrets, payments, sensitive data, dependencies, or deployment.

Use security-review if installed.

Otherwise review:

- authentication
- authorization
- validation
- secret handling
- dependency risks

---

## Step 9 - Finish Development Branch

Use finishing-a-development-branch if installed.

Otherwise:

- confirm verification passes
- confirm security review is complete when relevant
- confirm documentation is updated when relevant
- choose merge, PR, keep branch, or discard

---

## Done
