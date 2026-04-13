---
name: react-xidea
description: Project-level React skill for Xidea. Use when building or refactoring React pages, components, view state, interaction flows, and demo orchestration in this repo. Especially relevant for planner pages, tutor runtime screens, ingestion flows, and any work inside src/app, src/components, or client-side interaction logic.
---

# React Xidea

Use this skill when writing React in this repository.

## Goal

Build React code that keeps demo flows easy to change, easy to present, and easy for three collaborators to extend in parallel.

Honor the repo's declared frontend stack in the implementation, not just in planning.

## Project Structure

- `src/app`: page-level composition and screen orchestration
- `src/components`: reusable presentational or interaction components
- `src/components/ui`: shadcn-based base primitives owned in-repo
- `src/data`: mock data and scenario fixtures
- `src/domain`: pure business logic, planners, selectors, shared types
- `src/lib`: adapters, transports, client helpers, and shared utilities such as `cn()`

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

### 1.5. Respect the chosen implementation stack

For `apps/web`, default to:

- `shadcn/ui` for reusable primitive components
- Vercel AI SDK for chat or thread-like message flows
- `src/styles.css` CSS variables plus Tailwind utilities for styling

Do not keep building bespoke buttons, cards, badges, chat state containers, or thread plumbing once the repo has committed to these tools.

### 2. State should match the demo story

Local state is fine for demo interactions when:

- the state is page-local
- it does not need persistence
- it primarily drives presentation or demo branching

If multiple screens need shared learning session state, introduce a focused context instead of prop drilling.

For chat or runtime transcript surfaces:

- prefer `useChat`
- keep backend mapping in a transport adapter
- keep message persistence shaped around session or thread concepts

### 3. Keep components easy to swap

Design components so the team can replace a mocked flow with a real one later.

Prefer props shaped like product concepts:

- `learnerState`
- `studyPlan`
- `learningUnit`
- `sessionStep`

Avoid generic prop bags like `data`, `info`, `item`.

Also keep the component boundaries clean:

- `src/components/ui/*` stays primitive
- `src/components/*` holds reusable Xidea product components
- `src/app/*` assembles page-specific layout and orchestration

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
- prefer transport / API adaptation in `src/lib`, not mixed into page JSX
- if a page uses many repeated visual blocks, extract product components before the page becomes a monolith

## Styling Boundaries

- use tokens from `src/styles.css` before adding new hard-coded values
- use Tailwind utilities for local layout and spacing
- use `cn()` when composing reusable component classes
- avoid per-component CSS files unless there is a clear styling need that utilities and tokens cannot express

## Before Shipping

Check:

1. Can another teammate quickly find where the learning logic lives?
2. Is the page easy to modify for a new demo script?
3. Are the prop names product-specific and readable?
4. Did we avoid hard-coding business logic deep inside JSX?
5. If the task involved thread or chat UI, did we actually use AI SDK instead of a hand-rolled substitute?
6. If the task touched shared UI, did we build on shadcn primitives instead of bypassing them?
7. Did we run a real browser verification pass for the changed UI and inspect the console?

## Browser Verification Notes

For page-level React changes, prefer validating behavior in a browser instead of assuming the JSX is correct.

At minimum:

- load the page
- capture a snapshot of the structure
- inspect console output
- click at least one important interaction
- verify the post-click state still matches the intended layout

If the verification tool is Playwright-based and stale sessions are blocking new checks:

- list existing sessions first
- close or kill stale sessions
- rerun the verification with a fresh session

Do not leave browser verification sessions hanging after the check.
