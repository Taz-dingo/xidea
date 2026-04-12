# 系统骨架

## 核心模块

### 1. Content Ingestion

输入各种学习材料：

- 文本
- 图片
- 音频
- 视频
- 网页
- PDF
- 笔记

输出统一的 `SourceAsset`。

### 2. Knowledge Distillation

从原始材料中提炼出：

- 概念
- 技能
- 事实
- 易混点
- 前置依赖
- 推荐训练方式

输出 `LearningUnit` 和 `KnowledgeGraphSlice`。

### 3. Learner Diagnosis

根据用户历史表现判断：

- 是否真正理解
- 是否只是短时记住
- 哪些概念容易混淆
- 哪种训练方式更有效

输出 `LearnerState`。

### 4. Session Planner

根据 `LearningUnit + LearnerState` 规划本轮学习路径：

- 先讲解
- 先提问
- 先看图识别
- 先听音回答
- 先做对比
- 先做情境模拟

输出 `StudyPlan`。

### 5. Tutor Runtime

执行每一步学习动作：

- 苏格拉底式追问
- 1v1 教师问答
- 语音对练
- 看图识别
- 听音回答
- 视频理解
- 情境模拟

### 6. Memory Loop

把结果写回长期状态：

- 记忆稳定度
- 理解深度
- 常见错误类型
- 最有效训练方式

## 当前分层

### `apps/web`

负责：

- 页面
- 交互
- 对话输入与消息状态
- 流式输出展示
- 工具调用结果展示
- 学习状态可视化
- planner 输出展示

技术角色：

- 这是 interaction shell
- 优先使用 TypeScript / React / Vercel AI SDK 承接 chat UI 和 streaming 体验
- 不在这一层承接教学编排主逻辑

### `apps/agent`

负责：

- 输入理解
- 用户画像更新
- 路径编排
- 训练动作选择
- 记忆回写

技术角色：

- 这是 orchestration brain
- 优先使用 Python / LangChain / LangGraph 承接受约束单 pedagogical agent
- Tutor runtime 的核心决策、状态迁移和 guardrail 执行都在这一层

## 当前推荐运行形态

1. 用户在 `apps/web` 发起问题、材料导入或训练请求
2. `apps/web` 用 Vercel AI SDK 管理会话状态、消息协议和流式渲染
3. 请求通过 API contract 发到 `apps/agent`
4. `apps/agent` 读取 `project / thread / learner state`，通过 LangGraph 做路径判断
5. agent 返回学习动作、解释信息和必要的增量消息
6. `apps/web` 把这些结果渲染成聊天内容、学习面板和 planner explanation

## 当前边界原则

- Vercel AI SDK 属于 web 交互层，不替代 LangGraph
- LangGraph 属于核心编排层，不直接负责前端消息展示
- 如果后续接入 AI Gateway，它是独立网关层，不改变 web / agent 的主边界
- 第一版先把 web 与 agent 的 streaming contract 讲清楚，再决定是否扩展更多节点和 provider

## Web-Agent Contract v0

第一版采用事件流，而不是一次性 JSON 返回。

目标：

- 保留前端流式体验
- 同时传递结构化诊断、学习路径和状态更新
- 让比赛 demo 展示“系统正在判断和编排”，而不只是聊天输出

### Request

`apps/web` 发给 `apps/agent` 的最小请求建议包含：

- `projectId`: 当前项目上下文
- `threadId`: 当前会话上下文
- `userId`: 可选，后续接真实用户时使用
- `entryMode`: `chat | ingest`
- `userMessage`: 当前轮用户输入
- `sourceAssetIds`: 可选，本轮相关材料
- `targetUnitId`: 可选，本轮聚焦的学习单元
- `learnerState`: 可选，当前前端已知的学习者状态快照
- `contextSnapshot`: 可选，当前前端已知的材料、主题和最近消息
- `responseMode`: 第一版默认 `stream`

### Stream Events

第一版先收敛为 5 类事件：

1. `text-delta`
   - 增量文本片段
   - 用于在前端逐步显示 assistant 输出
2. `diagnosis`
   - 当前轮的判断结果
   - 包含 `recommendedAction` 和简要原因
3. `plan`
   - 当前轮生成的学习路径
   - 对应 `StudyPlan`
4. `state-patch`
   - 对学习者状态的增量更新
   - 只传本轮变化，不要求整份状态重发
5. `done`
   - 流结束信号
   - 表示本轮结构化结果已经完整送达

### Event Shape

可以统一成如下结构：

```json
{ "type": "text-delta", "text": "我先帮你把这个概念边界拉清楚。" }
{ "type": "diagnosis", "data": { "recommendedAction": "clarify", "reason": "当前混淆风险高" } }
{ "type": "plan", "data": { "headline": "先辨析再迁移", "summary": "先澄清，再追问，再迁移", "steps": [] } }
{ "type": "state-patch", "data": { "confusion": 72, "recommendedAction": "clarify" } }
{ "type": "done" }
```

### Why This Shape

- 比纯文本流更适合 Xidea，因为系统不仅要“回答”，还要“判断和编排”
- 比一次性 JSON 更适合前端 demo，因为用户能看到系统逐步生成内容
- 前端可以把 `text-delta` 渲染成聊天内容，把 `diagnosis / plan / state-patch` 渲染成学习面板

### First-Version Constraint

- 第一版不追求通用事件系统
- 不急着支持复杂 tool-call protocol
- 只要先让 web 稳定接收这 5 类事件并完成展示即可
- 如果后续 LangGraph 节点变复杂，再扩展事件种类

## LangGraph Minimal Graph v0

第一版 graph 先收敛为一条最小可讲、可演示、可扩展的主链路：

```text
load_context
  -> diagnose
  -> decide_action
  -> maybe_tool
  -> compose_response
  -> writeback
```

这条链路的目标不是做复杂多 agent，而是把“系统先判断，再决定怎么学，再解释并回写”的主逻辑讲清楚。

### Node 1: `load_context`

职责：

- 读取本轮请求里的 `project / thread / learner / unit / assets / recent messages`
- 把 web 传入的快照整理成统一 state
- 做必要的默认值填充和格式归一化

不负责：

- 不做教学判断
- 不生成学习路径
- 不更新长期状态

输入：

- `AgentRequest`

输出：

- `GraphState.context`
- `GraphState.request`

### Node 2: `diagnose`

职责：

- 判断当前轮最主要的学习问题是什么
- 识别当前更适合 `teach / clarify / practice / review / apply` 中哪一类动作
- 产出结构化诊断，而不是长篇回答

建议输出字段：

- `recommendedAction`
- `reason`
- `confidence`
- `focusUnitId`
- `needsTool`

不负责：

- 不直接生成最终回复文案
- 不直接写回状态

### Node 3: `decide_action`

职责：

- 基于诊断结果决定当前轮学习动作
- 生成一个轻量 `StudyPlan` 草稿
- 明确当前轮优先做澄清、追问、练习、复习还是迁移

建议输出字段：

- `studyPlan`
- `selectedMode`
- `toolIntent`

不负责：

- 不直接读外部工具
- 不负责包装成前端事件

### Node 4: `maybe_tool`

职责：

- 只有在 `needsTool` 或 `toolIntent` 明确时才执行
- 补充当前轮缺失但必要的上下文
- 第一版可以只做轻量 lookup，而不是复杂 tool orchestration

第一版可接受的工具职责：

- 读取 source asset 摘要
- 读取 learning unit 详情
- 读取 thread memory 或最近学习记录
- 读取 review 相关调度信息

不负责：

- 不重新决定整体教学策略
- 不承担复杂工具路由系统

### Node 5: `compose_response`

职责：

- 把前面节点的结构化结果整理成前端消费的事件流
- 生成当前轮 assistant explanation
- 输出 `text-delta / diagnosis / plan / state-patch / done`

不负责：

- 不重新做诊断
- 不重新规划路径

### Node 6: `writeback`

职责：

- 把本轮结果回写到 learner state、thread state 和必要的记忆字段
- 产出 `state-patch`
- 为下一轮保留最小连续性

第一版建议只回写：

- `LearnerState` 的增量变化
- 当前轮 `recommendedAction`
- 最近一次 plan / step 结果
- 必要的 review 调度变化

不负责：

- 不做复杂 consolidation
- 不把所有长期记忆系统都塞进第一版

## First-Version Graph Principles

- 保持单 agent 主链路，不扩成多 agent graph
- 节点按职责拆分，不按“看起来完整”拆分
- `diagnose` 和 `decide_action` 分开，确保“判断”和“编排”可以单独讲清楚
- `maybe_tool` 保持可选和轻量，不把工具系统做成第一版前提
- `compose_response` 与 `writeback` 分开，避免展示逻辑和状态更新逻辑缠在一起

## GraphState v0

第一版 `GraphState` 只承载本轮真正必要的信息，不提前扩成完整长期记忆容器。

建议结构：

```ts
type GraphState = {
  request: {
    projectId: string;
    threadId: string;
    userId?: string;
    entryMode: "chat" | "ingest";
    userMessage: string;
    sourceAssetIds: string[];
    targetUnitId?: string;
    responseMode: "stream";
  };

  context: {
    sourceAssets: SourceAsset[];
    currentUnit: LearningUnit | null;
    learnerState: LearnerState | null;
    recentMessages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }>;
  };

  diagnosis?: {
    recommendedAction: "teach" | "clarify" | "practice" | "review" | "apply";
    reason: string;
    confidence: number;
    focusUnitId?: string;
    needsTool: boolean;
  };

  action?: {
    selectedMode?: LearningMode;
    studyPlan?: StudyPlan;
    toolIntent?:
      | "asset-summary"
      | "unit-detail"
      | "thread-memory"
      | "review-context"
      | null;
  };

  toolResult?: {
    kind: string;
    payload: unknown;
  };

  response?: {
    assistantMessage: string;
    events: Array<unknown>;
  };

  writeback?: {
    learnerStatePatch?: Partial<LearnerState>;
    lastAction?: string;
    reviewPatch?: Record<string, unknown>;
  };
};
```

### Why This Shape

- `request` 保留原始输入，方便追踪和调试
- `context` 只放本轮需要消费的上下文快照
- `diagnosis` 与 `action` 分开，避免把“判断”和“编排”混成一个 blob
- `toolResult` 保持轻量，只承接 `maybe_tool` 的结果
- `response` 和 `writeback` 分开，避免展示逻辑和状态更新逻辑缠在一起

### Decision 1: Keep `recentMessages`

第一版保留 `recentMessages`，但只保留最近一小段消息历史。

建议：

- 默认只带最近 `3` 到 `8` 条消息
- 用于帮助 agent 理解当前轮是否在延续上一轮
- 不把整条 thread 全量塞进 `GraphState`

### Decision 2: Fixed `toolIntent`

第一版 `toolIntent` 采用固定枚举，不使用自由文本。

当前允许值：

- `asset-summary`
- `unit-detail`
- `thread-memory`
- `review-context`

这样做的原因：

- 更容易约束第一版工具边界
- 更容易联调和测试
- 避免过早变成开放式 tool routing

### Decision 3: Patch-Only `writeback`

第一版 `writeback` 只允许小范围 patch，不做整块全量状态重写。

建议只回写：

- `learnerStatePatch`
- `lastAction`
- `reviewPatch`

这样做的原因：

- 更安全
- 更容易判断本轮到底改了什么
- 能保持最小闭环，而不提前做成复杂记忆系统

### GraphState Guardrails

- 不在 `GraphState` 里保存完整长期记忆对象
- 不把 UI 展示状态直接混进 agent state
- 不让 `toolResult` 反向重写 `diagnosis`
- 不让 `writeback` 在第一版承接复杂 consolidation 逻辑

## Diagnosis Schema v0

第一版 `diagnosis` 采用增强版结构，不只返回推荐动作，还要明确问题类型、置信度和是否需要补工具信息。

建议结构：

```ts
type Diagnosis = {
  recommendedAction: "teach" | "clarify" | "practice" | "review" | "apply";
  reason: string;
  confidence: number;
  focusUnitId?: string;
  primaryIssue:
    | "insufficient-understanding"
    | "concept-confusion"
    | "weak-recall"
    | "poor-transfer"
    | "missing-context";
  needsTool: boolean;
};
```

### Field Meanings

- `recommendedAction`
  - 当前轮最适合优先执行的学习动作
  - 必须与 `teach / clarify / practice / review / apply` 保持一致
- `reason`
  - 对当前判断的简短解释
  - 第一版建议控制在 `1` 到 `2` 句以内
- `confidence`
  - 当前判断的把握度
  - 第一版可先使用 `0` 到 `1` 的启发式数值
- `focusUnitId`
  - 当前轮主要聚焦的学习单元
  - 如果是开放式聊天且没有明确 unit，可以为空
- `primaryIssue`
  - 当前最主要的问题类型
  - 用来区分“没理解”“概念混淆”“记忆不稳”“不会迁移”“上下文不足”
- `needsTool`
  - 当前信息是否不足，需要进入 `maybe_tool` 补充上下文

### Why This Shape

- 只返回 `recommendedAction` 不足以体现 Xidea 的诊断能力
- `primaryIssue` 能把理解问题、记忆问题和迁移问题拆开，贴合产品核心价值
- `confidence` 和 `needsTool` 配合后，可以帮助决定是否需要进一步查上下文
- `focusUnitId` 能让后续 `plan` 更稳定地围绕具体学习单元展开

### Diagnosis Guardrails

- `reason` 只解释判断，不承担完整 assistant reply
- `diagnosis` 只表达当前轮判断，不直接写回状态
- `needsTool` 为真时，优先进入 `maybe_tool`，而不是在 `diagnose` 内硬补信息
- `primaryIssue` 采用固定枚举，不使用自由文本

## Plan Schema v0

第一版 `plan` 保持增强但克制，既能体现“系统在编排”，又不提前扩成复杂课程执行系统。

建议结构：

```ts
type StudyPlan = {
  headline: string;
  summary: string;
  selectedMode: LearningMode;
  expectedOutcome: string;
  steps: Array<{
    id: string;
    title: string;
    mode: LearningMode;
    reason: string;
    outcome: string;
  }>;
};
```

### Field Meanings

- `headline`
  - 当前轮学习安排的标题
  - 用于前端最显眼的 plan 标题区
- `summary`
  - 对当前轮整体安排的简短解释
  - 用来回答“为什么这轮要这样排”
- `selectedMode`
  - 当前轮的主训练模式
  - 用于表达这一轮的主策略，而不是替代 step 级别的 mode
- `expectedOutcome`
  - 当前轮完成后希望达到的整体学习结果
  - 用来表达本轮不是只完成步骤，而是有明确教学目标
- `steps`
  - 当前轮的结构化步骤列表
  - 每一步都要能回答“为什么这样安排”和“希望带来什么结果”

### Plan Constraints

- 第一步版默认只允许 `1` 到 `3` 步
- 每一步都必须带 `reason`
- 每一步都必须带 `outcome`
- `selectedMode` 是轮级主策略，`step.mode` 是步骤级执行形式

### Why This Shape

- 比只有文本 explanation 更适合展示“系统在编排”
- 比复杂 workflow schema 更适合比赛版 demo
- `headline + summary + expectedOutcome` 能让计划不仅是步骤列表，而是可讲的教学安排
- 结构上与当前 web demo 的 `StudyPlan / StudyPlanStep` 已有模型接近，迁移成本低

### Plan Guardrails

- 第一版不增加 `priority`、`estimatedTime`、`dependsOn` 等复杂执行字段
- `plan` 负责表达教学安排，不替代最终 assistant reply
- `plan.summary` 解释安排逻辑，`diagnosis.reason` 解释判断逻辑，两者不要混写

## State-Patch Schema v0

第一版 `state-patch` 只表达本轮的增量变化，不重发整份状态，也不承接复杂长期记忆同步。

建议结构：

```ts
type StatePatch = {
  learnerStatePatch?: Partial<{
    mastery: number;
    understandingLevel: number;
    memoryStrength: number;
    confusion: number;
    recommendedAction: "teach" | "clarify" | "practice" | "review" | "apply";
    weakSignals: string[];
    lastReviewedAt: string | null;
    nextReviewAt: string | null;
  }>;

  lastAction?: {
    action: "teach" | "clarify" | "practice" | "review" | "apply";
    mode?: LearningMode;
    unitId?: string;
  };

  reviewPatch?: {
    dueUnitIds?: string[];
    scheduledAt?: string | null;
    reviewReason?: string;
  };
};
```

### Field Meanings

- `learnerStatePatch`
  - 当前轮对 `LearnerState` 的增量更新
  - 只传本轮真正变化的字段
- `lastAction`
  - 当前轮最终实际执行的学习动作
  - 用来区分诊断建议和最终执行结果
- `reviewPatch`
  - 当前轮对 review 调度层产生的最小影响
  - 第一版只保留轻量接口位置，不扩成完整复习引擎数据结构

### Why This Shape

- 比整份状态回写更适合最小闭环，也更容易调试
- `learnerStatePatch + lastAction + reviewPatch` 已经足够表达“学到了什么、做了什么、后续是否要复习”
- 这套结构和当前 `LearnerState` 以及 `Review Engine` 的概念边界能够自然衔接

### State-Patch Guardrails

- 只回写增量变化，不重发整份 `LearnerState`
- 如果本轮没有变化，对应字段可以省略
- 第一版不回写完整 thread memory、完整 learner profile 或 consolidation 结果
- `lastAction` 表达执行结果，不替代 `diagnosis`

## Maybe-Tool Boundary v0

第一版 `maybe_tool` 只承担“补上下文”的职责，不承担重新决策、复杂工具路由或开放式能力扩张。

### Allowed Tool Intents

第一版只允许以下 4 类固定工具意图：

- `asset-summary`
- `unit-detail`
- `thread-memory`
- `review-context`

### Tool 1: `asset-summary`

职责：

- 读取某个 `SourceAsset` 的摘要、主题和关键点
- 在材料导入场景下为当前轮补充最小内容上下文

边界：

- 第一版只读取已有摘要或结构化提炼结果
- 不在这一层跑完整 PDF / 网页 / 多模态解析流程
- 不让工具本身直接生成学习计划

### Tool 2: `unit-detail`

职责：

- 读取某个 `LearningUnit` 的完整详情
- 帮助 `plan` 和 `focusUnitId` 更稳定地围绕具体学习单元展开

边界：

- 只做读取，不负责诊断和编排
- 不在这里更新 learner state

### Tool 3: `thread-memory`

职责：

- 读取当前 thread 最近几轮的关键记录或摘要
- 帮助 agent 理解当前轮是不是对上一轮的延续

边界：

- 第一版只读取最近摘要或最近关键记录
- 不读取整条 thread 的全量长期历史
- 不做复杂召回、排序或通用知识库搜索

### Tool 4: `review-context`

职责：

- 读取当前与 review 调度相关的轻量上下文
- 帮助判断当前是否适合进入 review 或安排后续复习

边界：

- 只读 review 相关轻量信息
- 不运行完整 spaced repetition engine
- 不生成复杂复习排程系统

### Explicitly Out Of Scope

第一版明确不做：

- 真实多模态解析工具
- 开放式搜索或浏览器搜索
- 通用知识库检索系统
- 任意写操作型工具
- 多工具串联的复杂 routing 系统

### Tool Guardrails

- 工具只补上下文，不替代 `diagnose` 和 `decide_action`
- 工具默认不是主链路，只有 `needsTool` 或 `toolIntent` 明确时才运行
- 第一版优先做读取型、轻量型、结构化型工具
- 如果某个能力会让系统滑向“开放式 agent”，第一版先不做

## MVP 建议边界

比赛版先做：

- 文本 / PDF / 网页输入
- 学习者状态建模
- 2 到 3 种训练模式切换
- 一条能解释“为什么这样安排”的动态学习路径 demo

先不做：

- 复杂视频理解
- 真实实时语音链路
- 完整 spaced repetition 引擎
- 多人协作学习社区

## Web 目录建议

- `apps/web/src/app`: 页面和编排层
- `apps/web/src/components`: 复用组件
- `apps/web/src/data`: demo 数据
- `apps/web/src/domain`: 类型与纯函数

## Agent 目录建议

- `apps/agent/src/xidea_agent/state.py`: 核心状态模型
- `apps/agent/src/xidea_agent/graph.py`: 编排节点和图定义
- `apps/agent/src/xidea_agent/api.py`: 对外服务接口
- `apps/agent/src/xidea_agent/runtime.py`: LangGraph runtime 与流式输出适配
