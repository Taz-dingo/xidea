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
