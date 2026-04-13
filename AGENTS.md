# Xidea Project Instructions

## Project Focus

这个仓库服务于 `Xidea / 虾学` 的比赛版 demo。

当前阶段优先级：

1. 先把“AI 学习编排系统”这个核心差异点讲清楚
2. 先让 demo 可讲、可演示、可协作
3. 再逐步接真实 AI、多模态与学习引擎能力

## Working Mode

- 优先做能支撑团队讨论和演示的成果，不追求过早工程化
- 文档与 demo 一起推进，避免只有代码没有叙事
- 新功能优先围绕比赛故事线展开，避免偏题式扩展
- 默认优先简化，而不是扩展

## Project Skills

本项目维护了 7 个项目级 skill：

- `project-onboarding`
- `branch-workflow`
- `docs-governance`
- `frontend-design`
- `pr-description`
- `react-xidea`
- `typescript-xidea`

这些 skills 位于 `.agents/skills/` 下。

### When to Use

- 开始接手项目、隔一段时间重新进入、或 agent 需要快速建立上下文时，用 `project-onboarding`
- 需要拉分支、改分支名、检查分支命名、决定 `type/owner/topic`、或准备符合规范的 PR 时，用 `branch-workflow`
- 需要理解文档结构、判断该读哪几份、决定信息该写到哪里、或清理重复文档时，用 `docs-governance`
- 设计或改版页面时，用 `frontend-design`
- 需要起 PR、填写 PR 描述、整理 `Summary / Screenshots / Risks` 时，用 `pr-description`
- 写 React 页面、组件、状态流转时，用 `react-xidea`
- 设计类型、domain model、planner 逻辑时，用 `typescript-xidea`

如果一个任务同时涉及 UI、React 和类型设计，可以组合使用。

默认建议先运行 `project-onboarding`；涉及开分支、重命名分支或 PR 协作时，再加 `branch-workflow`；需要补 PR 描述时，再加 `pr-description`。

## Repo Conventions

- Web 页面编排层放在 `apps/web/src/app`
- Web 通用组件放在 `apps/web/src/components`
- Web demo 数据放在 `apps/web/src/data`
- Web 纯类型和纯逻辑放在 `apps/web/src/domain`
- Python agent 核心放在 `apps/agent/src/xidea_agent`
- 长期记忆文档放在 `docs/memory`

## Collaboration Rules

- `main` 必须保持可构建、可演示
- 所有工作默认走短分支和 PR
- 一个 PR 只解决一个问题
- 涉及代码改动的任务默认补测试；如果当前阶段不补测试，必须明确说明原因、风险和后续补齐点
- 会影响团队共识的内容，先更新 `docs/memory/decision-log.md`

## Agent Memory Rules

只把“稳定、可复用、对后续任务有价值”的信息写入仓库记忆。

写入位置：

- `docs/memory/project-context.md`: 稳定背景、目标、范围
- `docs/memory/decision-log.md`: 已确认决策和原因
- `docs/memory/open-questions.md`: 还没定的关键问题

不要把临时讨论、一次性调试过程、噪声记录写进长期记忆。

## Product Guardrails

- 不把产品做成另一个静态卡片工具
- 每个页面都要尽量体现“系统会决定你该怎么学”
- 所有新 demo 都要能回答：它在比赛答辩里证明了什么
