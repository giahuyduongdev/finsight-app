# AGENTS

## 1. Think Before Coding

Before making changes:

- Understand the problem completely.
- Identify the root cause.
- Consider alternatives.
- Choose the simplest correct solution.

Avoid coding before reasoning.

---

## 2. Simplicity First

Prefer:

- straightforward solutions
- fewer abstractions
- existing project patterns
- maintainable code

Avoid:

- unnecessary indirection
- speculative architecture
- over-engineering

---

## 3. Surgical Changes

Make the smallest change necessary.

Do not:

- refactor unrelated code
- rename files unnecessarily
- introduce new patterns without justification

---

## 4. Goal-Driven Execution

Stay focused on the requested outcome.

When implementing:

- solve the actual problem
- verify assumptions
- avoid scope creep

---

## 5. Encoding — NON-NEGOTIABLE

**Do not touch file encoding. Ever.**

- NEVER use PowerShell for file operations or packaging
- NEVER use `Set-Content` / `Out-File` without `-Encoding UTF8`
- NEVER change, convert, or force-replace file encoding
- Always backup files containing Vietnamese content before modifying
- If a file looks garbled (mojibake): create a copy, read the copy fresh

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions come before implementation rather than after mistakes, and no encoding corruption in files with Vietnamese content.

## 6. Engineering Workflow

### 6.1 Workflow Selection

Choose the smallest workflow that fits the task.

### 6.2 Workflow Execution

Follow project workflows:

- docs/process/workflows/project-initialization.md
- docs/process/workflows/feature-development.md
- docs/process/workflows/architecture-refactor.md
- docs/process/workflows/daily-workflow.md

### 6.3 Preferred Skills

- brainstorming
- deep-research
- grill-with-docs
- zoom-out
- improve-codebase-architecture
- using-git-worktrees
- tdd
- verification-loop
- security-review
- finishing-a-development-branch

### 6.4 Brainstorming Rules

Clarify requirements before generating specs.
Explore multiple solutions before design.

### 6.5 Research Rules

Use research only when knowledge is missing or decisions are expensive to reverse.

### 6.6 Diagram Rules

Project Initialization:

- architecture.mmd

Feature Development:

- sequence.mmd
- architecture.mmd (optional)
- dataflow.mmd (optional)

Architecture Refactor:

- current-architecture.mmd
- target-architecture.mmd

### 6.7 ADR Rules

Create ADRs for major technical decisions.

### 6.8 Git Workflow

Create a branch before implementation unless the selected workflow explicitly allows skipping it for trivial work.

Prefer Git worktrees for:

- large features
- architecture refactors
- parallel development
- long-running work

### 6.9 Branch Completion

Before merge or PR:

- tests pass
- lint passes
- typecheck passes
- build passes
- verification completed
- security review completed when relevant
- ADRs updated when relevant
- diagrams updated when relevant

Use finishing-a-development-branch when available.
