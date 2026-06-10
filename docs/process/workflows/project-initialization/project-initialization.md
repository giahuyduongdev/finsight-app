# Project Initialization Workflow

See: project-initialization.mmd

## Goal

Establish a new project foundation using Specification-Driven Development (SDD).

---

## When To Use

- New repository
- New product
- MVP development
- Greenfield project
- Platform rebuild

---

## Step 1 — Project Idea

Provide a high-level project idea.

Examples:

- project vision
- target users
- core features
- technical preferences
- constraints

The idea can be rough and incomplete.

---

## Step 2 — Generate Foundation Requirements

Create:

docs/specs/project-foundation/requirements.md

Document:

- project vision
- target users
- business goals
- core features
- constraints
- success criteria

---

## Step 3 — Requirements Review

Use grill-with-docs if installed.

Otherwise:

- challenge assumptions
- identify missing requirements
- identify scope risks
- identify conflicting goals

---

## Step 4 — Generate Foundation Design

Create:

docs/specs/project-foundation/design.md

Document:

- architecture
- tech stack
- system boundaries
- deployment strategy
- folder structure
- integration points

---

## Step 5 — Design Review

Use grill-with-docs if installed.

Otherwise:

- verify architecture choices
- verify scalability assumptions
- identify technical risks
- identify missing components

---

## Step 6 — Generate Foundation Diagrams

Create diagrams when they improve understanding.

Examples:

- architecture.mmd
- dataflow.mmd
- deployment.mmd

Store diagrams beside the spec:

docs/specs/project-foundation/

---

## Step 7 — Architecture Decisions

Create Architecture Decision Records (ADR) for long-term technical decisions.

Create:

docs/decisions/

Document:

- context
- decision
- alternatives considered
- consequences

ADR is recommended for decisions that are expensive to change later.

---

## Step 8 — Research

Research only when needed.

Use deep-research if installed.

Otherwise:

- review official documentation
- compare alternatives
- validate best practices

---

## Step 9 — Generate Foundation Tasks

Create:

docs/specs/project-foundation/tasks.md

Document:

- repository setup tasks
- infrastructure tasks
- CI/CD tasks
- testing setup tasks
- implementation order
- dependencies
- validation checklist

---

## Step 10 — Repository Setup

Establish project foundations.

Keep setup minimal.

Avoid unnecessary infrastructure.

---

## Step 11 — First Vertical Slice

Implement the smallest end-to-end slice.

Use tdd if installed.

Otherwise:

- one behavior at a time
- test public behavior only
- Red → Green → Refactor
- vertical slices

---

## Step 12 — Verification

Use verification-loop if installed.

Otherwise:

- run tests
- run lint
- run typecheck
- run build
- verify acceptance criteria
- verify edge cases

---

## Step 13 — Security Review

Use security-review if installed.

Otherwise review the baseline security model:

- authentication
- authorization
- user input validation
- secret handling
- payment or financial data
- personally identifiable information
- API endpoints or external integrations
- dependency risks

---

## Ready

Project is now ready for:

- Feature Development Workflow
- Architecture Refactor Workflow
