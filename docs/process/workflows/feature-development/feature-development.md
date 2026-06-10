# Feature Development Workflow

See: feature-development.mmd

## Goal

Build a new feature using Specification-Driven Development (SDD).

---

## Step 1 — Feature Request

Provide a high-level feature request.

The request can be rough and incomplete.

---

## Step 2 — Generate Requirements

Create:

docs/specs/<feature-name>/requirements.md

Document:

- user stories
- acceptance criteria
- edge cases
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

## Step 4 — Generate Design

Create:

docs/specs/<feature-name>/design.md

Document:

- architecture
- data flow
- API design
- components
- technical decisions
- risks
- tradeoffs

---

## Step 5 — Design Review

Use grill-with-docs if installed.

Otherwise:

- verify consistency with requirements
- identify missing components
- identify implementation risks
- verify technical decisions

---

## Step 6 — Generate Feature Diagrams

Create diagrams when the feature involves:

- multiple services
- integrations
- complex workflows
- significant data flow

Examples:

- sequence.mmd
- architecture.mmd
- integration-flow.mmd
- dataflow.mmd

Store diagrams beside the spec:

docs/specs/<feature-name>/

---

## Step 7 — Research

Research only when needed.

Use deep-research if installed.

Otherwise:

- review official documentation
- compare alternatives
- validate best practices

---

## Step 8 — Architecture Decisions

Create ADRs only for major technical decisions.

Create:

docs/decisions/

Document:

- context
- decision
- alternatives considered
- consequences

---

## Step 9 — Generate Tasks

Create:

docs/specs/<feature-name>/tasks.md

Document:

- implementation tasks
- dependencies
- execution order
- validation checklist

---

## Step 10 — TDD Implementation

Use tdd if installed.

Otherwise:

- one behavior at a time
- test public behavior only
- Red → Green → Refactor
- vertical slices

---

## Step 11 — Verification

Use verification-loop if installed.

Otherwise:

- run tests
- run lint
- run typecheck
- run build
- verify acceptance criteria
- verify edge cases

---

## Step 12 — Security Review

Use security-review if installed and the feature touches security-sensitive behavior.

Security-sensitive behavior includes:

- authentication
- authorization
- user input validation
- secret handling
- payment or financial data
- personally identifiable information
- API endpoints or external integrations
- dependency risks

For features outside these areas, do a quick security check and document why a full review is unnecessary.

---

## Done
