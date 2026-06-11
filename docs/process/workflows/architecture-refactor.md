# Architecture Refactor Workflow

See: architecture-refactor.mmd

## Goal

Improve architecture of an existing codebase.

---

## When To Use

- Boundary changes
- Dependency restructuring
- Large refactor
- Ownership changes between modules
- Migration from one architecture pattern to another
- Refactors that need staged rollout or compatibility planning

Use Daily Workflow for small local refactors that preserve boundaries.

---

## Step 1 - Refactor Request

Provide a high-level architecture refactor request.

The request can be rough and incomplete.

---

## Step 2 - Zoom Out

Use zoom-out if installed.

Otherwise:

- inspect the entire codebase
- identify coupling
- identify duplication
- identify architectural smells
- identify poor boundaries

---

## Step 3 - Architecture Analysis

Use improve-codebase-architecture if installed.

Otherwise:

- propose architecture improvements
- create migration strategy
- define refactor phases

---

## Step 4 - Clarify Refactor Goals

Use brainstorming if installed.

Otherwise:

- clarify refactor goals
- identify non-goals
- identify constraints
- identify migration risks
- identify success criteria

---

## Step 5 - Explore Refactor Strategies

Use brainstorming if installed.

Otherwise:

- propose multiple refactor strategies
- compare tradeoffs
- identify migration risks
- prefer incremental migration over rewrite

---

## Step 6 - Research If Needed

Research only when needed.

Use deep-research if installed.

Otherwise:

- review official documentation
- compare alternatives
- validate best practices

---

## Step 7 - Generate Refactor Requirements

Create:

docs/process/specs/<refactor-name>/requirements.md

Document:

- problems
- goals
- success criteria
- constraints

---

## Step 8 - Requirements Review

Use grill-with-docs if installed.

Otherwise:

- challenge assumptions
- identify missing requirements
- identify scope risks
- identify conflicting goals

---

## Step 9 - Generate Refactor Design

Create:

docs/process/specs/<refactor-name>/design.md

Document:

- target architecture
- migration strategy
- boundaries
- risks
- tradeoffs

---

## Step 10 - Design Review

Use grill-with-docs if installed.

Otherwise:

- verify architecture choices
- verify migration strategy
- identify technical risks
- identify missing components

---

## Step 11 - Generate Architecture Diagrams

Create diagrams for the current and target architecture.

Required:

docs/process/specs/<refactor-name>/current-architecture.mmd
docs/process/specs/<refactor-name>/target-architecture.mmd

Document:

- current system boundaries
- target system boundaries
- dependencies
- migration direction

---

## Step 12 - Architecture Decisions If Needed

Create ADRs for major architectural decisions.

Create:

docs/process/decisions/

Document:

- context
- decision
- alternatives considered
- consequences

---

## Step 13 - Generate Refactor Tasks

Create:

docs/process/specs/<refactor-name>/tasks.md

Document:

- implementation phases
- dependencies
- validation checklist

---

## Step 14 - Create Branch Or Worktree

Create a branch before implementation.

Use using-git-worktrees if installed.

Otherwise:

- create a normal Git branch
- use a clear branch name

Recommended branch name:

refactor/<name>

Git worktrees are strongly recommended for architecture refactors.

---

## Step 15 - TDD Refactor

Use tdd if installed and the behavior is testable.

Otherwise:

- preserve existing behavior
- refactor incrementally
- test public behavior only
- Red -> Green -> Refactor

For mechanical moves, documentation, or configuration-only refactors, use the smallest meaningful verification instead of forcing a full TDD loop.

---

## Step 16 - Verification

Use verification-loop if installed.

Otherwise:

- run tests
- run lint
- run typecheck
- run build
- verify existing behavior is preserved
- verify documentation is still accurate

---

## Step 17 - Security Review If Relevant

Run this step when the refactor touches authentication, authorization, user input, secrets, payments, sensitive data, dependencies, or deployment.

Use security-review if installed.

Otherwise review:

- authentication
- authorization
- validation
- secret handling
- dependency risks

---

## Step 18 - Finish Development Branch

Use finishing-a-development-branch if installed.

Otherwise:

- confirm verification passes
- confirm security review is complete when relevant
- confirm specs are updated
- confirm ADRs are updated when relevant
- confirm current and target architecture diagrams are updated
- choose merge, PR, keep branch, or discard

---

## Done
