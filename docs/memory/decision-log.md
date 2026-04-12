# Decision Log

## 2026-04-13

### 决策

LangGraph 第一版采用 6 节点最小主链路：`load_context -> diagnose -> decide_action -> maybe_tool -> compose_response -> writeback`。

### 原因

- 当前阶段更重要的是把“系统如何先判断、再编排、再回写”讲清楚，而不是堆复杂 graph
- 这条链路正好覆盖读取上下文、做诊断、决定动作、必要时补工具、输出结果和状态回写
- 把 `diagnose` 与 `decide_action` 拆开，有助于在答辩和协作中清楚表达“判断”和“编排”的区别

### 影响

- `apps/agent` 后续优先围绕这 6 个节点定义最小 `GraphState`
- 第一版工具调用保持在 `maybe_tool` 节点内，不提前扩成复杂 tool routing
- 后续 schema、API contract 和前端展示都围绕这条主链路收敛

## 2026-04-13

### 决策

`apps/web` 与 `apps/agent` 的第一版返回协议采用事件流，统一发送 `text-delta / diagnosis / plan / state-patch / done` 五类事件。

### 原因

- Xidea 需要展示的不只是聊天文本，还包括系统判断、学习路径和状态变化
- 纯文本流不利于承载结构化编排结果，一次性 JSON 又不利于 demo 的流式体验
- 事件流能让 Vercel AI SDK 前端层与 Python LangGraph 后端层自然衔接

### 影响

- `apps/web` 后续按事件类型分别渲染聊天内容、诊断卡片、学习路径和状态变化
- `apps/agent` 需要把 LangGraph 输出包装成统一事件，而不是只返回最终文本
- 第一版先收敛事件种类，不提前设计复杂通用协议

## 2026-04-13

### 决策

前端交互层接入 Vercel AI SDK，但核心学习编排仍保持在 Python + LangChain + LangGraph。

### 原因

- 项目已经明确把受约束单 pedagogical agent 作为核心差异点，核心决策不适合在当前阶段迁到 TS
- Vercel AI SDK 很适合承接 chat state、流式输出、消息协议和工具结果展示，能增强 demo 的可讲性
- 把两者分层使用，可以同时保留 Python agent 生态优势和前端 AI 交互体验优势

### 影响

- `apps/web` 统一承担 interaction shell，优先负责消息流、对话体验和结果展示
- `apps/agent` 继续承担 orchestration brain，负责 state、action、tool、guardrail 和 LangGraph runtime
- 后续如果接入 AI Gateway，也作为独立网关层处理 provider 路由与观测，不替代主编排层

## 2026-04-13

### 决策

项目的分支命名与 PR 协作规范通过独立的 `branch-workflow` skill 暴露，而不是只散落在协作文档里。

### 原因

- “拉个分支”“这个分支名对吗”“准备提 PR” 这类请求经常直接进入执行，不会先人工翻协作文档
- 现有规则已经存在，但没有被 skill 显式接管时，agent 容易漏掉 `type/owner/topic` 这类项目约束
- 把分支协作独立成 skill，可以保持 `project-onboarding` 聚焦在上下文建立，不把它扩成大杂烩

### 影响

- 后续遇到分支创建、分支改名、分支命名检查、PR 范围整理时，优先触发 `branch-workflow`
- agent 在处理这类请求时，默认检查 `type/owner/topic`、短分支规则，以及是否需要同步更新 `decision-log`、`status`、`plan`
- 项目级 skills 列表从 5 个扩展为 6 个，并把分支协作作为显式入口能力

## 2026-04-10

### 决策

当前比赛 demo 的编排核心采用受约束的单 pedagogical agent，并在第一版就接入 LangChain / LangGraph 的最小 runtime。

### 原因

- 当前阶段更重要的是把“系统会决定你该怎么学”讲清楚
- 产品愿景更接近“agent 在约束下做教学决策”，而不是固定 workflow
- LangChain / LangGraph 生态值得尽早接入，便于团队边做边学习
- 复杂 graph、tool routing 和多节点 runtime 会提前引入工程噪声
- 团队现在更需要可讲、可演示、可协作的最小闭环

### 影响

- 当前主链路先收敛为“读取状态/上下文 -> agent 决策 -> 必要时调用工具 -> 生成学习动作 -> 回写”
- 第一版就定义清楚 agent 的 `state / action / tool / guardrail`，而不是把主逻辑写成固定 workflow
- LangGraph 先承载一个最小 graph，不急着堆叠多 agent 和复杂节点图
- 只有在多输入链路、多工具调用、中断恢复等需求明确后，再升级到更完整 graph

## 2026-04-10

### 决策

科学复习系统、agent memory 和定时整理系统是三层能力，不能混成同一层。

### 原因

- 科学复习服务学习者，本质是学习域模型与调度逻辑
- agent memory 服务系统本身，用于保存项目上下文、用户偏好和历史决策
- 定时整理系统负责压缩、强化和清理记忆，不直接替代前两者

### 影响

- 后续统一用 `Review Engine / Agent Memory / Consolidation` 三层来描述记忆相关能力
- 复习调度围绕 `learning item` 和掌握状态展开，而不是退化成固定卡片 UI
- agent 可以读取复习结果，但不把复习系统本身建模为 agent memory

## 2026-04-08

### 决策

当前阶段前端降级为最小表达，不追求复杂视觉和大范围功能展示。

### 原因

- 三人协作阶段，复杂 UI 会增加噪声
- 比赛当前更需要稳定表达核心差异点

### 影响

- 页面只保留阶段目标、输入样例、学习状态、路径输出、协作方式
- 后续新增页面前，先确认是否服务于比赛 story

## 2026-04-08

### 决策

统一把 Xidea 定义为 AI 学习编排系统，而不是某一种输入方式或某一种训练方式的产品。

### 原因

- 用户既可能通过材料导入进入系统，也可能通过普通问答进入系统
- 训练形式本身也是可切换的，不能把产品收窄成单一 mode
- 真正的核心差异点是系统在输入、诊断、训练之间做编排

### 影响

- 后续讨论产品时，统一从“输入形式 / 诊断方式 / 训练形式 / 编排逻辑 / 记忆回写”5 层来描述
- demo 可以展示多个能力，但都应服务于同一个编排主线

## 2026-04-08

### 决策

科学复习在 Xidea 中被定义为记忆调度层的子能力，而不是产品本体。

### 原因

- Anki 强在决定复习时机，但不负责决定当前最适合的学习动作
- Xidea 的差异点在于系统先判断用户是没懂、易混淆、需要练习，还是适合复习

### 影响

- 后续状态建模要同时包含理解状态和记忆状态
- 后续 demo 表达要避免把产品退化成“更强的卡片工具”

## 2026-04-08

### 决策

前端采用 TypeScript / React / Tailwind 的 UI 栈，核心编排采用 Python / LangChain / LangGraph 方向。

### 原因

- 前端需要高频快速迭代和更顺手的 UI 表达
- 编排核心优先选择更成熟的 Python agent 生态
- 两层边界清晰，便于后续通过 API contract 连接

### 影响

- repo 目录切换为 `apps/web` 和 `apps/agent`
- 后续需要补前后端 contract 和 graph node 设计
