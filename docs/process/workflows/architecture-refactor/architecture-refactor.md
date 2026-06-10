# Architecture Refactor Workflow

See: architecture-refactor.mmd

## Goal

Improve architecture of an existing codebase.

---

## Step 1 — Zoom Out

Use zoom-out if installed.

Otherwise:

- inspect the entire codebase
- identify coupling
- identify duplication
- identify architectural smells
- identify poor boundaries

---

## Step 2 — Architecture Analysis

Use improve-codebase-architecture if installed.

Otherwise:

- propose architecture improvements
- create migration strategy
- define refactor phases

---

## Step 3 — Research

Research only when needed.

Use deep-research if installed.

Otherwise:

- review official documentation
- compare alternatives
- validate best practices

---

## Step 4 — Generate Refactor Requirements

Create:

docs/specs/<refactor-name>/requirements.md

Document:

- problems
- goals
- success criteria
- constraints

---

## Step 5 — Requirements Review

Use grill-with-docs if installed.

Otherwise:

- challenge assumptions
- identify missing requirements
- identify scope risks
- identify conflicting goals

---

## Step 6 — Generate Refactor Design

Create:

docs/specs/<refactor-name>/design.md

Document:

- target architecture
- migration strategy
- boundaries
- risks
- tradeoffs

---

## Step 7 — Design Review

Use grill-with-docs if installed.

Otherwise:

- verify architecture choices
- verify migration strategy
- identify technical risks
- identify missing components

---

## Step 8 — Generate Architecture Diagrams

Create diagrams for the current and target architecture.

Create:

docs/specs/<refactor-name>/current-architecture.mmd
docs/specs/<refactor-name>/target-architecture.mmd

Document:

- current system boundaries
- target system boundaries
- dependencies
- migration direction

---

## Step 9 — Architecture Decisions

Create ADRs for major architectural decisions.

Create:

docs/decisions/

Document:

- context
- decision
- alternatives considered
- consequences

---

## Step 10 — Generate Refactor Tasks

Create:

docs/specs/<refactor-name>/tasks.md

Document:

- implementation phases
- dependencies
- validation checklist

---

## Step 11 — TDD Refactor

Use tdd if installed.

Otherwise:

- preserve existing behavior
- refactor incrementally
- test public behavior only
- Red → Green → Refactor

---

## Step 12 — Verification

Use verification-loop if installed.

Otherwise:

- run tests
- run lint
- run typecheck
- run build
- verify existing behavior is preserved

---

## Step 13 — Security Review

Use security-review if installed and the refactor touches security-sensitive behavior or trust boundaries.

Security-sensitive behavior includes:

- authentication
- authorization
- user input validation
- secret handling
- payment or financial data
- personally identifiable information
- API endpoints or external integrations
- dependency risks

For structural refactors outside these areas, do a quick security check and verify existing protections were preserved.

---

## Done
