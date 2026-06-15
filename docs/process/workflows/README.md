# Engineering Workflows

Use the smallest workflow that fits the task.

## Choose A Workflow

| Situation | Workflow |
| --- | --- |
| New repository, new product, MVP, greenfield rebuild | [Project Initialization](project-initialization.md) |
| New feature, existing feature enhancement, significant behavior change, major UX change | [Feature Development](feature-development.md) |
| Boundary changes, dependency restructuring, large refactor | [Architecture Refactor](architecture-refactor.md) |
| Bug fix, small UI tweak, validation update, small API change | [Daily Workflow](daily-workflow.md) |

## Escalation Rules

- Start with Daily Workflow when the task is small and localized.
- Escalate to Feature Development when behavior, acceptance criteria, or user workflow changes materially.
- Escalate to Architecture Refactor when module boundaries, dependencies, or ownership change.
- Use Project Initialization only for new project foundations.

## Conditional Steps

- Brainstorming is used before generating requirements and before committing to a design direction.
- Research is only needed when current knowledge is insufficient or choices are expensive to reverse.
- ADRs are only needed for major decisions that are expensive to change later.
- Security review is required when work touches authentication, authorization, user input, secrets, payments, sensitive data, dependencies, or deployment.
- Diagrams are only needed when they reduce ambiguity about architecture, data flow, integrations, or migration direction.
- Git worktrees are recommended for large features, refactors, parallel work, or long-running work.
- Finishing a development branch is required before merge or PR.

## Document Locations

- Workflow docs live in `docs/process/workflows/`.
- Specs live in `docs/specs/<name>/`.
- ADRs live in `docs/decisions/`.
