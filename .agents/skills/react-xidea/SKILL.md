---
name: react-xidea
description: Project-level React skill for Xidea. Use when building or refactoring React pages, components, view state, interaction flows, and demo orchestration in this repo. Especially relevant for planner pages, tutor runtime screens, ingestion flows, and any work inside src/app, src/components, or client-side interaction logic.
---

# React Xidea

Use this skill when writing React in this repository.

## Goal

Build React code that keeps demo flows easy to change, easy to present, and easy for three collaborators to extend in parallel.

## Project Structure

- `src/app`: page-level composition and screen orchestration
- `src/components`: reusable presentational or interaction components
- `src/data`: mock data and scenario fixtures
- `src/domain`: pure business logic, planners, selectors, shared types

Keep domain decisions out of presentational components when possible.

## Preferred Patterns

### 1. Thin app layer, pure domain layer

Pages and components should assemble UI.
Decision logic should live in `src/domain`.

Good:

- UI calls `buildStudyPlan(...)`
- UI renders returned steps

Avoid:

- branching learning strategy directly in JSX
- mixing planner rules into click handlers

### 2. State should match the demo story

Local state is fine for demo interactions when:

- the state is page-local
- it does not need persistence
- it primarily drives presentation or demo branching

If multiple screens need shared learning session state, introduce a focused context instead of prop drilling.

### 3. Keep components easy to swap

Design components so the team can replace a mocked flow with a real one later.

Prefer props shaped like product concepts:

- `learnerState`
- `studyPlan`
- `learningUnit`
- `sessionStep`

Avoid generic prop bags like `data`, `info`, `item`.

### 4. Follow modern React without over-optimizing

- use `startTransition` for non-urgent UI updates
- use `useDeferredValue` when filtering or rendering expensive lists
- derive view state during render when possible
- do not add `useMemo` or `useCallback` unless they help clarity or avoid real churn

### 5. Make states explicit

For any substantial view, think through:

- empty state
- loading state
- error state
- demo / mocked success state

Even if only the mocked state is implemented now, do not paint the code into a corner.

## Naming Guidance

- Component names should be domain-specific
- `StudyPlanPanel` is better than `InfoCardList`
- `LearnerStateBand` is better than `StatsRow`

## File Boundaries

- one major component per file
- extract subcomponents when the file stops reading top-to-bottom
- keep shared primitives in `src/components` only after a second use case appears

## Before Shipping

Check:

1. Can another teammate quickly find where the learning logic lives?
2. Is the page easy to modify for a new demo script?
3. Are the prop names product-specific and readable?
4. Did we avoid hard-coding business logic deep inside JSX?

