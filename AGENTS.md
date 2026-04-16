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
- 开始实现前先检查当前任务是否已有对应的 project skill、framework skill 或 best-practice skill；默认先按 skill 的工作流和约束来写代码
- 只有在没有合适 skill，或 skill 与当前仓库边界明确冲突时，才跳过 skill；跳过时需要在说明里讲清楚原因

## Project Skills

本项目当前默认使用 10 个技能入口，其中通用工程 skill 优先采用 vendored 外部 skill，项目内只维护 Xidea 特有的协作与文档 skill：

- `project-onboarding`
- `branch-workflow`
- `docs-governance`
- `clean-code-guardrails`
- `vercel-react-best-practices`
- `pr-description`
- `python-pro`
- `ai-agent-basics`
- `langgraph-docs`
- `langchain-architecture`

这些 skills 位于 `.agents/skills/` 下。

### When to Use

- 开始接手项目、隔一段时间重新进入、或 agent 需要快速建立上下文时，用 `project-onboarding`
- 需要拉分支、改分支名、检查分支命名、决定 `type/owner/topic`、或准备符合规范的 PR 时，用 `branch-workflow`
- 需要理解文档结构、判断该读哪几份、决定信息该写到哪里、或清理重复文档时，用 `docs-governance`
- 遇到 `App`、page、endpoint、graph/runtime 入口开始变重，或需要边开发边拆分职责时，用 `clean-code-guardrails`
- 做前端页面、React 组件、交互性能和实现细节时，用 `vercel-react-best-practices`
- 需要起 PR、填写 PR 描述、整理 `Summary / Screenshots / Risks` 时，用 `pr-description`
- 写 Python 后端、类型标注、测试、异步逻辑时，用 `python-pro`
- 设计 agent loop、ReAct / Plan-and-Execute、tool / memory 模式时，用 `ai-agent-basics`
- 改 LangGraph 节点、状态流和框架用法时，用 `langgraph-docs`
- 改 LangChain 集成、agent / memory / tool 结构时，用 `langchain-architecture`

如果一个任务同时涉及 UI、React 和类型设计，可以组合使用。
如果一个任务同时涉及前端交互与后端 agent contract，优先组合 `vercel-react-best-practices`、`ai-agent-basics`、`langgraph-docs`。

默认建议先运行 `project-onboarding`；遇到超重入口文件或职责漂移时，再加 `clean-code-guardrails`；涉及开分支、重命名分支或 PR 协作时，再加 `branch-workflow`；需要补 PR 描述时，再加 `pr-description`。

### Implementation Default

- 开发前先匹配这次任务最相关的 skill，再决定代码落点和实现方式
- 默认认为 skill 是当前任务的第一参考约束，而不是“写完以后再对照检查”
- 前端任务优先匹配 `vercel-react-best-practices`；入口文件变重时同时使用 `clean-code-guardrails`
- 后端、agent 或框架任务同理优先找对应 skill，再继续实现

## Repo Conventions

- Web 页面编排层放在 `apps/web/src/app`
- Web 通用组件放在 `apps/web/src/components`
- Web demo 数据放在 `apps/web/src/data`
- Web 纯类型和纯逻辑放在 `apps/web/src/domain`
- Python agent 核心放在 `apps/agent/src/xidea_agent`
- 长期记忆文档放在 `docs/memory`
- 不允许把过多职责和逻辑持续堆进单个文件；这条约束同时适用于前端、后端和 agent 实现
- 页面编排、领域逻辑、数据转换、网络交互、持久化访问、graph/node 逻辑和展示组件都必须按职责拆分
- `App`、page / screen / route、FastAPI endpoint、LangGraph graph/runtime 入口文件默认只负责编排与组装，不承担大段 domain helper、adapter、repository、prompt 构造或可独立复用的实现细节
- 同一 feature 或组件的相关文件优先收在同一目录内；不要把同一块 UI 的 page、hook、types、section 长期散落在多个顶层文件
- 命名优先短而具体；在 feature folder 内避免重复 `project-workspace-` 这类冗长前缀。`apps/web/src/app` 和 `apps/web/src/components` 下单文件默认不超过 500 行，除非确实无法继续拆分
- 前端跨组件、跨页面、跨 feature 共享的客户端状态默认使用 `zustand`；组件内部的临时交互状态、表单草稿和局部 UI 开合仍优先使用 React state
- 不要把需要跨组件复用的前端全局状态继续堆在 page hook、controller hook 或逐层透传的 props 包里

## Collaboration Rules

- `main` 必须保持可构建、可演示
- 所有工作默认走短分支和 PR
- 一个 PR 只解决一个问题
- 改动默认按“小步、稳定、可验证”的切片推进；每完成一段可构建、可 review、职责清晰的改动，就应尽快单独 commit，不要把许多无关编辑堆成一个大提交
- 每次新开工先判断当前任务属于哪个分工，再继续实现
- 可以提出额外产品能力建议，但未经用户明确确认，不要主动实现新的产品功能
- 涉及代码改动的任务默认补测试；如果当前阶段不补测试，必须明确说明原因、风险和后续补齐点
- 会影响团队共识的内容，先更新 `docs/memory/decision-log.md`
- 如果某个文件开始同时承载多个职责，先拆分再继续堆功能；不要把“先做完再重构”当成前端、后端或 agent 的默认路径

## Current Workstream Split

当前 v0 默认按三条主线并行推进：

- 学习引擎 owner：负责 `apps/agent/src/xidea_agent`、agent contract、LangGraph runtime、repository、API 和后端测试
- 前端 owner：负责 `apps/web` 的页面、交互、证据链展示和对 `/runs/v0` 的接入
- 产品 / demo 叙事 owner：负责比赛故事线、讲述顺序、范围取舍、文案和答辩材料

开工前先回答这 3 个问题：

1. 当前任务主要属于学习引擎、前端，还是产品 / demo 叙事分工
2. 这次改动的主目录和主 owner 是什么
3. 如果需要跨两个以上分工，边界和原因是什么

如果这 3 个问题还回答不清楚，先补文档或在 PR 里说明，再继续编码。

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
