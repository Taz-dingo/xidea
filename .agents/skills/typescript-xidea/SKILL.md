---
name: typescript-xidea
description: Project-level TypeScript skill for Xidea. Use when defining domain models, planner logic, content ingestion schemas, learner state models, utility functions, and typed interfaces for this repo. Especially relevant for files in src/domain, src/data, and any new typed API or orchestration layer.
---

# TypeScript Xidea

Use this skill for TypeScript design in this repository.

## Goal

Keep the product model explicit enough that Xidea's core ideas stay visible in code:

- learner state
- learning unit
- study plan
- mode switching
- memory update

If the types are vague, the product quickly collapses into generic app code.

## Type Design Rules

### 1. Model product concepts directly

Prefer explicit domain types:

- `LearnerState`
- `LearningUnit`
- `StudyPlanStep`
- `SourceAsset`

Avoid weak abstractions like:

- `DataItem`
- `Payload`
- `GenericNode`

unless there is a real cross-domain reason.

### 2. Default to readonly

- use `readonly` object fields
- use `ReadonlyArray<T>` for inputs and stored collections
- prefer immutable returns from pure functions

### 3. Keep unions meaningful

Use string literal unions for product modes and states.

Examples:

- learning mode
- asset kind
- session step status
- diagnosis outcome

If a union grows and behavior differs per member, consider discriminated unions.

### 4. Separate pure logic from fixtures

- `src/domain`: pure types, planners, selectors, evaluators
- `src/data`: mocked examples and demo fixtures

Do not hide business logic inside fixture files.

### 5. Make planner outputs explainable

Planner functions should return enough structured data for the UI to explain:

- what was chosen
- why it was chosen
- what it tries to improve

This matters because the product promise is adaptation, not just output generation.

## Function Guidance

- exported functions should have explicit return types
- prefer pure functions for planning and transformation
- avoid `any`
- use `unknown` plus narrowing when input shape is uncertain

## Schema Evolution Guidance

When adding a new product capability, ask:

1. Is this a new field on an existing concept?
2. Is this a new concept that deserves its own type?
3. Will the UI need to explain this concept later?

If the UI needs to explain it, it likely deserves a first-class type.

## Review Checklist

Before shipping TypeScript changes, check:

1. Do the type names reflect the product language?
2. Are there any vague escape hatches like `Record<string, unknown>` that should be stronger?
3. Is the logic pure where it can be?
4. Could another teammate infer the product model from the types alone?

