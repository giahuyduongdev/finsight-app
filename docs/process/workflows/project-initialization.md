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

## Step 1 - Project Idea

Provide a high-level project idea.

Examples:

- project vision
- target users
- core features
- technical preferences
- constraints

The idea can be rough and incomplete.

---

## Step 2 - Clarify Project Idea

Use brainstorming if installed.

Otherwise:

- ask clarifying questions
- identify missing constraints
- identify target users
- identify core user workflows
- identify success criteria
- identify scope risks

Do not generate foundation requirements until the project idea is clear enough.

---

## Step 3 - Generate Foundation Requirements

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

## Step 4 - Requirements Review

Use grill-with-docs if installed.

Otherwise:

- challenge assumptions
- identify missing requirements
- identify scope risks
- identify conflicting goals

---

## Step 5 - Explore Foundation Solutions

Use brainstorming if installed.

Otherwise:

- propose multiple viable technical approaches
- compare tradeoffs
- identify risks
- prefer the simplest viable solution

Do not finalize design until the main approach is selected.

---

## Step 6 - Generate Foundation Design

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

## Step 7 - Design Review

Use grill-with-docs if installed.

Otherwise:

- verify architecture choices
- verify scalability assumptions
- identify technical risks
- identify missing components

---

## Step 8 - Generate Foundation Diagrams

Create diagrams when they improve understanding.

Recommended:

- architecture.mmd

Optional:

- dataflow.mmd
- deployment.mmd

Store diagrams beside the spec:

docs/specs/project-foundation/

---

## Step 9 - Research If Needed

Research before recording long-term decisions when the tradeoff is unclear or expensive to reverse.

Use deep-research if installed.

Otherwise:

- review official documentation
- compare alternatives
- validate best practices

---

## Step 10 - Architecture Decisions

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

## Step 11 - Generate Foundation Tasks

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

## Step 12 - Create Branch Or Worktree

Create a branch before implementation.

Use using-git-worktrees if installed and the setup is large or long-running.

Otherwise:

- create a normal Git branch
- use a clear branch name

Recommended branch name:

foundation/project-setup

---

## Step 13 - Repository Setup

Establish project foundations.

Keep setup minimal.

Avoid unnecessary infrastructure.

---

## Step 14 - First Vertical Slice

Implement the smallest end-to-end slice.

Use tdd if installed and the behavior is testable.

Otherwise:

- one behavior at a time
- test public behavior only
- Red -> Green -> Refactor
- vertical slices

For setup-only work such as tooling, formatting, or documentation, use the smallest meaningful verification instead of forcing a full TDD loop.

---

## Step 15 - Verification

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

## Step 16 - Security Review

Run this step because project foundations commonly include dependencies, environment configuration, deployment, authentication, authorization, or secret handling.

Use security-review if installed.

Otherwise review:

- authentication
- authorization
- validation
- secret handling
- dependency risks

---

## Step 17 - Finish Development Branch

Use finishing-a-development-branch if installed.

Otherwise:

- confirm verification passes
- confirm security review is complete
- confirm specs are updated
- confirm ADRs are updated
- confirm diagrams are updated
- choose merge, PR, keep branch, or discard

---

## Ready

Project is now ready for:

- Feature Development Workflow
- Architecture Refactor Workflow
