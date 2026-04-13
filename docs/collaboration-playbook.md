# Collaboration Playbook

## Goal

三个人协作时，优先保证：

1. `main` 始终可演示
2. 每个人都能并行推进
3. 重要背景和决策不会只留在聊天里

## Roles

### 产品 owner

- 负责比赛 story
- 控范围和优先级
- 维护 `docs/product-brief.md`

### 学习引擎 owner

- 负责学习状态、planner、规则
- 维护 `src/domain/` 和相关文档

### 前端 owner

- 负责页面、交互、演示稳定性
- 维护 `src/app/` 和 `src/components/`

## Branching

采用轻量 trunk-based 协作：

- 长期分支只有 `main`
- 所有人从 `main` 拉短分支
- 分支存活时间尽量不超过 1 到 2 天

命名：

- `feat/<owner>/<topic>`
- `docs/<owner>/<topic>`
- `fix/<owner>/<topic>`
- `refactor/<owner>/<topic>`

## Pull Request Rule

每个 PR 需要回答 3 件事：

1. 改了什么
2. 为什么现在做
3. 有没有影响其他 owner

如果 PR 包含代码改动：

- 默认需要附带测试或验证用例
- 如果当前阶段没有补测试，必须明确写出原因、风险和后续补齐计划

如果影响共享认知，PR 里必须附带对 `docs/memory/` 的更新。

## Daily Cadence

### 每天开始

- 同步 `main`
- 看一眼 `docs/memory/open-questions.md`
- 看一眼 backlog

### 每天结束

- 能合并的 PR 尽量当天合并
- 新决策写入 `decision-log`
- 没解决的问题写入 `open-questions`

## Conflict Handling

如果两个人要改同一块：

- 先明确谁是 owner
- 非 owner 尽量通过 PR 建议，不直接大改
- 必要时先拆成两个 PR，先合基础，再合上层
