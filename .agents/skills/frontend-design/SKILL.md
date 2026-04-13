---
name: frontend-design
description: Project-level frontend design skill for Xidea. Use when designing or revising pages, flows, layouts, motion, visual systems, or interaction patterns for the AI learning product demo. Especially relevant for landing pages, planner flows, tutor interfaces, study session screens, and any UI work that needs to express dynamic learning paths instead of generic dashboard patterns.
---

# Frontend Design

Use this skill for visual and interaction decisions in Xidea.

## Goal

Design interfaces that make Xidea feel like an AI learning system with judgment, not a card tool with a nicer skin.

Every major UI should make at least one of these truths obvious:

- the system understands learner state
- the system changes teaching strategy
- the system can turn raw materials into active learning

## Default Stack Contract

When the repo or user has already chosen a frontend stack, treat it as a default implementation contract, not a loose suggestion.

For the current Xidea web app, default to:

- `shadcn/ui` for base UI primitives and workspace scaffolding
- Vercel AI SDK for chat or thread-like message surfaces
- Tailwind utility classes for local composition
- centralized CSS variables in `src/styles.css` for project tokens

Do not silently replace these with hand-rolled alternatives unless:

- the requested feature cannot be expressed cleanly with the chosen stack
- the user explicitly asks to avoid the stack
- there is a concrete technical blocker and you explain it

If a user says “use shadcn” or “use Vercel AI SDK”, make sure the final diff contains real usage:

- `src/components/ui/*` components are imported and used
- `useChat`, transport adapters, or other AI SDK primitives are actually wired into the experience

Installing a dependency without integrating it does not count as adoption.

## Design Principles

### 1. Show orchestration, not just content

Avoid pages that only display content blocks, cards, or chat bubbles.

Prefer UI that reveals:

- current learner state
- diagnosed weakness
- why the next step was chosen
- what learning mode is being used now
- how the next step may change

### 2. Keep the product feeling active

The interface should imply the system is planning, adapting, and teaching.

Good patterns:

- path views
- step transitions
- mode switches
- diagnostic summaries
- visible reasoning bands like “because you are confusing A and B”

Weak patterns:

- static card grids
- plain CRUD dashboards
- anonymous chat-only screens
- generic admin layout shells

### 3. Prefer strong storytelling surfaces

For competition demos, use sections that help explain the product quickly:

- input material
- learner diagnosis
- study plan
- active training mode
- memory update / outcome

Do not force all screens into the same layout if the story is clearer with contrast.

### 4. Make multimodality legible

When a page claims multimodal learning, show it explicitly.

Use visual cues for:

- text
- image
- audio
- video
- formula / diagram
- scenario simulation

Even with mock data, the UI should imply the system can switch media and teaching mode.

### 5. Practice restraint

Do not show a block just because the information exists.

Prefer:

- one clear working surface over stacked explanatory sections
- compact inspector panels over repeated storytelling copy
- hiding secondary detail unless it changes the current decision

Avoid:

- giant hero headlines that only explain the product to itself
- repeating the same idea in header, section intro, and card body
- expanding source material, rationale, and metadata by default

For workspace-like product UI, prefer a Codex-style information layout:

- left sidebar owns project and session navigation
- center panel owns only the current thread and current action
- right sidebar owns inspector information such as learner profile, review state, and project-specific metadata
- sidebar titles and list rows should stay single-line by default; truncate rather than growing vertically
- use mostly neutral surfaces and reserve accent color for a few important actions or signals

### 6. Prefer product workspace patterns over decorative surfaces

When the page is a working product surface, default to:

- navigational hierarchy on the left
- current task or thread in the center
- contextual inspector on the right

Avoid turning operational views into:

- landing pages with oversized headlines
- long self-explanatory storytelling sections
- stacked cards that all compete for primary attention

## Visual Direction For This Repo

- Warm, intelligent, optimistic
- Avoid cold enterprise dashboard aesthetics
- Avoid generic AI gradients with purple bias
- Prefer editorial layout mixed with product UI
- Use a clear hierarchy between narrative copy and system state
- Keep color count low; most surfaces should stay in the neutral family
- Selected states should feel light and precise, not heavy or black-boxed

## Component System Guidance

Treat the component system as three layers:

### 1. Base primitives

Use `src/components/ui/*` for shadcn-sourced primitives such as:

- `Button`
- `Card`
- `Badge`
- `Textarea`
- `ScrollArea`
- `Separator`

These files are source-owned copies of shadcn components.
Keep them close to upstream patterns and avoid stuffing product logic into them.

### 2. Product components

Use `src/components/*` for Xidea-specific UI compositions such as:

- thread rows
- learner-state inspectors
- study plan panels
- session navigation items

These components may compose several shadcn primitives together.

### 3. App composition

Use `src/app/*` for page-level orchestration, layout wiring, and demo flow assembly.

Do not let page files become a dumping ground for reusable mini-components once patterns repeat.

## CSS Strategy

Use a layered styling approach:

### 1. Tokens in one place

Put project tokens in `src/styles.css` under `:root`, including:

- color tokens
- typography tokens
- semantic surface tokens
- focus / selection tokens

Before adding a new hard-coded color, ask whether it should become a named token.

### 2. Utilities for local layout

Use Tailwind utility classes for:

- spacing
- layout
- sizing
- local visual composition

Prefer utilities in component markup over creating new ad-hoc CSS selectors for one-off layout work.

### 3. Shared semantic classes only when repeated

Use shared classes like `.xidea-kicker` or `.xidea-shell` only when:

- the pattern is reused
- the class expresses product language
- the equivalent utility bundle would become noisy

Avoid introducing many bespoke CSS classes for isolated one-off surfaces.

### 4. Merge classes consistently

Use `cn()` from `src/lib/utils.ts` for class composition in reusable components.

### 5. Avoid style fragmentation

Do not create per-component CSS files by default.
Prefer keeping the project on:

- global tokens in `src/styles.css`
- utility-first component styling in TSX
- shadcn primitive ownership in `src/components/ui`

## AI-Native Surface Guidance

For any thread, chat, or runtime transcript surface:

- default to Vercel AI SDK primitives instead of manual message plumbing
- use `useChat` with a transport adapter when the backend is not yet AI SDK-native
- keep transport mapping in `src/lib`, not inside page JSX

Do not hand-roll a local chat architecture if AI SDK can express the same flow cleanly.

## UI Verification Workflow

For any meaningful UI change, do not stop at static code review or build success.
Run a browser verification pass.

Minimum verification loop:

1. run `build` to catch type or bundling regressions
2. start the local web app
3. open the page in a real browser
4. capture a snapshot of the accessibility tree or DOM structure
5. inspect the browser console
6. click at least one or two key interactions
7. confirm the page still matches the intended layout after interaction

For Xidea workspace surfaces, verify at least:

- left sidebar shows `project -> sessions`
- center panel shows the current thread / current action
- right panel shows inspector information only
- selected session changes the center panel as expected
- `新建 session` and project expand / collapse behave correctly
- no React runtime errors appear in console

When using Playwright in this repo:

- prefer a real browser check over reasoning from JSX alone
- if MCP browser access is unavailable or stale, use the Playwright CLI workflow
- before opening a new browser, check for stale sessions with `playwright-cli list`
- if old sessions are stuck, clear them with `playwright-cli close-all` or `playwright-cli kill-all`
- if the browser cache directory is still occupied, clean the stale processes before retrying
- close the verification browser session when finished so it does not block later checks

Treat console verification as part of UI correctness.
A page with the right layout but a live React runtime error is not considered verified.

## Implementation Guardrails

Before closing a frontend task, verify:

1. Did we follow the declared stack instead of drifting into custom primitives?
2. Did we preserve the codex-style workspace restraint when building product surfaces?
3. Are repeated UI patterns extracted at the correct layer?
4. Are new colors, states, and typography choices aligned with existing tokens?
5. If AI interaction is present, did we use AI SDK rather than stitching chat state manually?
6. Did we validate the page in a real browser, not just via `build`?

## Interaction Guidance

- Actions should sound pedagogical: `开始诊断`, `进入对比训练`, `切到情境模拟`
- Labels should expose reasoning where possible
- If a mode changes, show why it changed
- Transitions should reinforce learning flow, not just decorate

## Page Checklist

Before shipping a UI change, check:

1. Can a reviewer tell what makes Xidea different in under 10 seconds?
2. Does the screen show learner-state awareness or just content display?
3. Is the next learning action explicit?
4. Does the layout feel intentional rather than template-driven?
5. On mobile, is the story still understandable in a single scroll?

## Implementation Notes

- Keep design tokens centralized in CSS variables when the design system grows
- Reuse visual primitives only after the product language is stable
- Prefer a small number of memorable patterns over many mediocre ones
