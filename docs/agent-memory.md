# Agent Memory Management

## Principle

agent 的长期记忆不放在聊天记录里，而放在仓库里的可审阅文档里。

只有满足下面条件的信息，才应该进入长期记忆：

- 多次任务都会用到
- 下次打开仓库还有效
- 会影响方案、实现或分工

## Memory Layout

- `docs/memory/project-context.md`
  记录稳定背景、当前目标、明确不做什么
- `docs/memory/decision-log.md`
  记录已经确认的决策、日期、原因、影响范围
- `docs/memory/open-questions.md`
  记录仍未定的关键问题和 owner

## Update Rules

### 应该更新记忆的情况

- 比赛方向变了
- demo 范围变了
- 协作方式变了
- 有新的强约束或明确不做项
- 一个关键技术或产品决策被确认

### 不应该写入长期记忆的内容

- 一次性调试细节
- 零散 brainstorm
- 已经过时的讨论原文
- 个人临时 TODO

## Writing Style

- 每条记录尽量短
- 写结论，不堆聊天原文
- 写清楚日期、owner、影响
- 如果后续可能推翻，写进 `open-questions`，不要伪装成已定事实

## Review Rule

每次合并影响全局理解的 PR 前，检查是否需要同步更新 `docs/memory/`。

