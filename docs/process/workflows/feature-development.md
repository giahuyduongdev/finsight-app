# Feature Development Workflow

See: feature-development.mmd

## Goal

Build a new feature or improve an existing feature using Specification-Driven Development (SDD).

---

## When To Use

- New feature
- Existing feature enhancement
- Feature expansion
- Major UX improvement
- Significant behavior changes
- Existing workflow improvements
- Performance improvements that change behavior

Examples:

- Add MFA to login
- Add filters to search
- Improve dashboard UX
- Add export functionality
- Extend notification system
- Improve checkout experience

---

## Step 1 - Feature / Enhancement Request

Provide a high-level feature or enhancement request.

The request can be rough and incomplete.

---

## Step 2 - Clarify Request

Use brainstorming if installed.

Otherwise:

- ask clarifying questions
- identify missing constraints
- identify affected users
- identify expected behavior
- identify edge cases
- identify success criteria

Do not generate requirements until the request is clear enough.

---

## Step 3 - Generate Requirements

Create:

docs/specs/<feature-name>/requirements.md

Document:

- user stories
- acceptance criteria
- edge cases
- constraints
- success criteria

---

## Step 4 - Requirements Review

Use grill-with-docs if installed.

Otherwise:

- challenge assumptions
- identify missing requirements
- identify scope risks
- identify conflicting goals

---

## Step 5 - Explore Solutions

Use brainstorming if installed.

Otherwise:

- propose multiple viable approaches
- compare tradeoffs
- identify implementation risks
- prefer the simplest viable solution

Do not finalize design until the main approach is selected.

---

## Step 6 - Generate Design

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

## Step 7 - Design Review

Use grill-with-docs if installed.

Otherwise:

- verify consistency with requirements
- identify missing components
- identify implementation risks
- verify technical decisions

---

## Step 8 - Generate Feature Diagrams

Create diagrams when the feature involves:

- multiple services
- integrations
- complex workflows
- significant data flow

Recommended:

- sequence.mmd

Optional:

- architecture.mmd
- integration-flow.mmd
- dataflow.mmd

Store diagrams beside the spec:

docs/specs/<feature-name>/

---

## Step 9 - Research If Needed

Research only when needed.

Use deep-research if installed.

Otherwise:

- review official documentation
- compare alternatives
- validate best practices

---

## Step 10 - Architecture Decisions If Needed

Create ADRs only for major technical decisions.

Create:

docs/decisions/

Document:

- context
- decision
- alternatives considered
- consequences

---

## Step 11 - Generate Tasks

Create:

docs/specs/<feature-name>/tasks.md

Document:

- implementation tasks
- dependencies
- execution order
- validation checklist

---

## Step 12 - Create Branch Or Worktree

Create a branch before implementation.

Use using-git-worktrees if installed and the work is large, long-running, or parallel.

Otherwise:

- create a normal Git branch
- use a clear branch name

Recommended branch names:

- feature/<name>
- enhancement/<name>

---

## Step 13 - TDD Implementation

Use tdd if installed and the behavior is testable.

Otherwise:

- one behavior at a time
- test public behavior only
- Red -> Green -> Refactor
- vertical slices

For non-behavioral changes such as copy, styling, docs, or configuration, use the smallest meaningful verification instead of forcing a full TDD loop.

---

## Step 14 - Verification

Use verification-loop if installed.

Otherwise:

- run tests
- run lint
- run typecheck
- run build
- verify acceptance criteria
- verify edge cases
- verify documentation is still accurate

---

## Step 15 - Security Review If Relevant

Run this step when the feature touches authentication, authorization, user input, secrets, payments, sensitive data, dependencies, or deployment.

Use security-review if installed.

Otherwise review:

- authentication
- authorization
- validation
- secret handling
- dependency risks

---

## Step 16 - Finish Development Branch

Use finishing-a-development-branch if installed.

Otherwise:

- confirm verification passes
- confirm security review is complete when relevant
- confirm specs are updated
- confirm ADRs are updated when relevant
- confirm diagrams are updated when relevant
- choose merge, PR, keep branch, or discard

---

## Done
