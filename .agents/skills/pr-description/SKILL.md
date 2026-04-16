---
name: pr-description
description: Project-level PR description skill for Xidea. Use when the user asks to prepare, fill, draft, polish, or update a pull request description, especially for requests like "提个 PR", "填一下 PR desc", "帮我写 PR 描述", "PR 写详细一点", or "准备合并". Produces a detailed Chinese PR description using the repo's default sections: 摘要、演示 / 验证、风险 / 待确认项.
---

# PR Description

Use this skill when preparing PR text in this repository.

## Goal

Turn the current branch state into a detailed, merge-ready PR description that follows the team's default structure and is fast for reviewers to scan.

## Default Output

Unless the user asks for a different format or language, return the PR description in Chinese.
Default to complete Chinese section titles and Chinese bullet content rather than mixed Chinese/English phrasing.

Use this default shape:

```md
## 摘要

- ...
- ...
- ...

## 演示 / 验证

- ...
- ...

## 风险 / 待确认项

- ...
- ...
```

Do not omit a section. If a section is light, keep it brief rather than deleting it.
Do not collapse the description into one or two vague bullets just because the change is small.

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

- explain why this PR exists now when that context matters for review
- describe what changed in product terms first
- describe implementation or contract changes when they affect how reviewers should read the diff
- mention docs, schema, or collaboration updates when they materially change shared understanding
- default to 4 to 8 bullets, not 1 to 2 bullets
- each bullet should carry concrete review value rather than acting as a file-by-file changelog

### Screenshots / Demo

- mention the main UI flow, endpoint, contract, or behavior that can be shown
- include validation steps when they are more useful than static screenshots
- if there are no screenshots, clearly say what was verified instead of leaving vague filler
- when useful, mention environment assumptions such as local agent, sample data, or required flags
- if tests were not run, say what manual verification replaced them

### Risks / Open Questions

- missing tests or validation gaps
- known follow-up work
- integration assumptions or backend dependencies
- rollout or merge risks when relevant
- keep this honest, concrete, and reviewer-oriented rather than defensive

## Writing Rules

- optimize for reviewer speed, not completeness
- default to Chinese phrasing for both section titles and bullet content
- prefer complete Chinese explanation over terse shorthand
- prefer outcome language over file-by-file changelogs
- mention user-visible behavior before internal refactors
- if code changed without tests, explicitly say what was verified manually
- if the branch includes docs updates, mention them in `Summary` only when they materially affect review
- if the user asks for "写详细一点" or gives no style preference, bias toward fuller reviewer context rather than a compressed summary
- when the diff is cross-owner or changes shared boundaries, explicitly call out the boundary or contract that changed

## Repo-Specific Guidance

- for frontend PRs, mention browser verification and the key viewport or interaction that was checked
- for agent / API PRs, mention endpoint or contract changes
- for docs-only PRs, explain what shared understanding or workflow rule was updated, not just "updated docs"
- when the user says "提 PR", assume they want the PR description drafted in chat unless they explicitly ask to open the PR too
- if the branch is dirty or not pushed yet, say that briefly before drafting the final description

## Reviewer Checklist

Before returning the PR description, check:

1. Does `摘要` explain both the purpose and the main change surface?
2. Does `演示 / 验证` say exactly what was validated, not just "已验证"?
3. Does `风险 / 待确认项` honestly call out missing tests, dependencies, or follow-up work?
4. If the change is docs-only, did the description explain the collaboration or source-of-truth impact?
5. Is the final text fully Chinese unless the user explicitly asked otherwise?

## Anti-Patterns

- do not paste raw commit history as the PR summary
- do not fill sections with placeholders like "N/A" unless truly unavoidable
- do not hide known risks just because the branch is ready to merge
- do not write PR descriptions that are so short they fail to explain scope, verification, and risk
