# Tech Stack

## Decision

项目采用双栈分层：

- `apps/web`
  - TypeScript
  - React
  - Tailwind CSS
  - shadcn-friendly structure
- `apps/agent`
  - Python
  - LangChain
  - LangGraph
  - FastAPI

## Why

### Web

- 适合快速做 demo 和交互表达
- 适合让 AI 快速生成和修改页面
- React + Tailwind + shadcn 的组合适合比赛期高频迭代

### Agent

- LangChain / LangGraph 的 Python 生态更成熟
- 适合承接多入口、多状态、多路径的编排逻辑
- 后续扩展模型调用、记忆回写、工具调用都更自然

## Boundary

### `apps/web`

负责：

- 页面
- 交互
- 学习状态可视化
- planner 输出展示

### `apps/agent`

负责：

- 输入理解
- 用户画像更新
- 路径编排
- 训练动作选择
- 记忆回写

## Not Decided Yet

- 前后端 API contract 的最终结构
- 是否需要单独数据库
- 真实模型接入方式
- LangGraph 节点粒度
