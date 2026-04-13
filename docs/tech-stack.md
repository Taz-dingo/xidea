# Tech Stack

## Decision

项目采用双栈分层：

- `apps/web`
  - TypeScript
  - React
  - Vercel AI SDK
  - Tailwind CSS
  - shadcn-friendly structure
- `apps/agent`
  - Python
  - LangChain
  - LangGraph
  - FastAPI

可选配套层：

- AI Gateway
  - 用于统一模型路由、观测和 provider 管理
  - 不是第一版前提

## Why

### Web

- 适合快速做 demo 和交互表达
- 适合让 AI 快速生成和修改页面
- React + Tailwind + shadcn 的组合适合比赛期高频迭代
- Vercel AI SDK 适合承接 chat state、流式输出、消息协议和工具结果展示
- 能让 web 层更自然地消费 agent 返回的增量消息，而不用把编排核心迁到 TS

### Agent

- LangChain / LangGraph 的 Python 生态更成熟
- 适合承接多入口、多状态、多路径的编排逻辑
- 后续扩展模型调用、记忆回写、工具调用都更自然
- 更适合作为受约束单 pedagogical agent 的真正决策层

### AI Gateway

- 如果后续需要多 provider 路由、统一鉴权、可观测性和成本管理，可以作为独立网关层接入
- 不改变 `apps/web` 和 `apps/agent` 的职责边界

## Boundary

### `apps/web`

负责：

- 页面
- 交互
- 对话状态管理
- 流式消息渲染
- tool call / tool result 呈现
- 学习状态可视化
- planner 输出展示

使用原则：

- `apps/web` 可以用 Vercel AI SDK 管理 chat UI、message stream 和前端交互协议
- `apps/web` 不承接核心学习编排决策，不把 Tutor runtime 主逻辑迁到 TS

### `apps/agent`

负责：

- 输入理解
- 用户画像更新
- 路径编排
- 训练动作选择
- 记忆回写
- 对外提供 web 可消费的 API / streaming contract

使用原则：

- `apps/agent` 是 LangGraph 所在层，也是系统的 orchestration brain
- state、action、tool、guardrail 的定义和执行都优先落在这一层

## Preferred Runtime Shape

- `apps/web` 负责用户输入、消息展示和 agent 输出解释
- `apps/agent` 负责读取上下文、做教学决策、必要时调工具并生成学习动作
- 两层通过显式 API contract 连接
- 如果接入 Vercel AI SDK，也把它视为 web interaction shell，而不是 agent orchestration core

## Not Decided Yet

- 前后端 API contract 的最终结构
- 是否需要单独数据库
- 真实模型接入方式是否统一经过 AI Gateway
- LangGraph 节点粒度
