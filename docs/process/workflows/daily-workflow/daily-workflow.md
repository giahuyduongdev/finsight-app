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

---

## Step 1 — Task Request

Provide a small task request.

The request can be rough and incomplete.

---

## Step 2 — Generate Lightweight Requirements

Document briefly:

- goal
- expected behavior
- edge cases
- success criteria

Do not create full specs unless the task grows in scope.

---

## Step 3 — Generate Lightweight Tasks

Document briefly:

- implementation checklist
- files likely affected
- validation checklist

---

## Step 4 — TDD Implementation

Use tdd if installed.

Otherwise:

- one behavior at a time
- test public behavior only
- Red → Green → Refactor
- keep changes surgical

---

## Step 5 — Verification

Use verification-loop if installed.

Otherwise:

- run tests
- run lint
- run typecheck
- run build
- verify expected behavior

---

## Step 6 — Security Review

Use security-review if installed and the task touches security-sensitive behavior.

Security-sensitive behavior includes:

- authentication
- authorization
- user input validation
- secret handling
- payment or financial data
- personally identifiable information
- API endpoints or external integrations
- dependency risks

For low-risk UI tweaks, copy changes, or internal-only cleanup, do a quick security check instead of a full review.

---

## Done
