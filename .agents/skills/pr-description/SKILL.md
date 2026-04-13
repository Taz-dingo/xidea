---
name: pr-description
description: Project-level PR description skill for Xidea. Use when the user asks to prepare, fill, draft, or polish a pull request description, especially for requests like "提个 PR", "填一下 PR desc", "帮我写 PR 描述", or "准备合并". Produces the repo's default PR sections: Summary, Screenshots / Demo, and Risks / Open Questions.
---

# PR Description

Use this skill when preparing PR text in this repository.

## Goal

Turn the current branch state into a short, merge-ready PR description that follows the team's default structure.

## Default Output

Unless the user asks for a different format, return:

```md
## Summary

- ...

## Screenshots / Demo

- ...

## Risks / Open Questions

- ...
```

Do not omit a section. If a section is light, keep it brief rather than deleting it.

## Read Order

Read only what you need, in this order:

1. `AGENTS.md`
2. `CONTRIBUTING.md`
3. `docs/status.md` if the branch completes or changes current work status
4. `git log --oneline main..HEAD`
5. `git diff --stat main...HEAD`
6. specific changed files only when the summary is still unclear

## What To Include

### Summary

- what changed in product terms
- what changed in implementation terms when important
- keep to 3 to 5 bullets

### Screenshots / Demo

- mention the main UI flow or behavior that can be shown
- include validation steps when they are more useful than static screenshots
- if there are no screenshots, say what was verified instead of leaving vague filler

### Risks / Open Questions

- missing tests or validation gaps
- known follow-up work
- integration assumptions or backend dependencies
- keep this honest and short

## Writing Rules

- optimize for reviewer speed, not completeness
- prefer outcome language over file-by-file changelogs
- mention user-visible behavior before internal refactors
- if code changed without tests, explicitly say what was verified manually
- if the branch includes docs updates, mention them in `Summary` only when they materially affect review

## Repo-Specific Guidance

- for frontend PRs, mention browser verification and the key viewport or interaction that was checked
- for agent / API PRs, mention endpoint or contract changes
- when the user says "提 PR", assume they want the PR description drafted in chat unless they explicitly ask to open the PR too
- if the branch is dirty or not pushed yet, say that briefly before drafting the final description

## Anti-Patterns

- do not paste raw commit history as the PR summary
- do not fill sections with placeholders like "N/A" unless truly unavoidable
- do not hide known risks just because the branch is ready to merge
