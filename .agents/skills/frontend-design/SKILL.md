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

## Visual Direction For This Repo

- Warm, intelligent, optimistic
- Avoid cold enterprise dashboard aesthetics
- Avoid generic AI gradients with purple bias
- Prefer editorial layout mixed with product UI
- Use a clear hierarchy between narrative copy and system state

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
