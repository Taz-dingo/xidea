# Xidea / 虾学

Xidea 是一个面向内部比赛的 **AI 学习编排系统** demo 仓库。目标不是做另一个静态卡片工具，而是让系统接住多样输入，理解用户状态，并决定接下来该怎么学。

## 当前范围

- 只做比赛当前阶段必要的 demo 和协作文档
- 核心只验证一件事：**系统会根据学习状态安排下一步学习动作**
- 输入形式和训练形式都可以多样，但核心判断逻辑是一套
- LLM 是核心 pedagogical agent，规则仅作为 guardrails 约束

## 快速开始

### 前置要求

- Node.js 22 + `pnpm`
- Python 3.11+
- `uv`（Python 包管理）
- OpenAI API Key

### 1. 启动 Agent 后端

```bash
# 设置必须的环境变量
export OPENAI_API_KEY="sk-你的key"
export XIDEA_AGENT_DB_PATH="$PWD/output/xidea-agent.db"

# 可选：指定模型（默认 gpt-4o-mini）
export XIDEA_LLM_MODEL="gpt-4o-mini"

# 启动 agent
cd apps/agent
uv run python -m xidea_agent
```

启动后可访问：
- 健康检查：`http://127.0.0.1:8000/health`
- Schema 查看：`http://127.0.0.1:8000/schemas`

> **注意**：`OPENAI_API_KEY` 是必须的。LLM 是系统的核心决策者，没有 key 系统会拒绝启动。

### 2. 启动 Web 前端

在另一个终端：

```bash
pnpm install
pnpm dev:web
```

访问 `http://127.0.0.1:5173`。本地开发时 Vite 会自动代理 `/agent-api/*` 到 `http://127.0.0.1:8000`。

### 3. 验证后端

```bash
curl http://127.0.0.1:8000/health
# 期望返回 {"status":"ok"}
```

发送一个测试请求：

```bash
curl -X POST http://127.0.0.1:8000/runs/v0 \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id": "rag-demo",
    "thread_id": "thread-local-1",
    "entry_mode": "chat-question",
    "topic": "RAG retrieval design",
    "target_unit_id": "unit-rag-retrieval",
    "messages": [
      { "role": "user", "content": "我分不清 retrieval 和 reranking 的职责" }
    ]
  }'
```

## 环境变量

| 变量 | 必须 | 默认值 | 说明 |
|------|------|--------|------|
| `OPENAI_API_KEY` | **是** | 无 | OpenAI API key，LLM 是核心决策者 |
| `XIDEA_LLM_MODEL` | 否 | `gpt-4o-mini` | 使用的 LLM 模型 |
| `XIDEA_AGENT_DB_PATH` | 否 | 无（不持久化） | SQLite 数据库路径，用于持久化会话和学习状态 |
| `XIDEA_AGENT_ALLOW_ORIGINS` | 否 | `localhost:5173` | CORS 允许的前端域名（逗号分隔） |

## 运行测试

```bash
cd apps/agent
uv run pytest tests/ -v
```

当前 95 个测试全部通过（使用 mock LLM，不需要真实 API key）。

## 仓库结构

```
apps/web/          React + Tailwind + shadcn/ui 前端
apps/agent/        Python + LangGraph 编排核心（LLM-first 架构）
docs/              按 operating docs / process / reference / archive 分层
.agents/skills/    项目级 skills
```

## 技术架构

- **前端**：TypeScript / React / Tailwind CSS / shadcn/ui / Vercel AI SDK
- **编排核心**：Python / LangGraph / FastAPI
- **LLM**：OpenAI API（gpt-4o-mini 默认）
- **持久化**：SQLite（可选）

### LLM-first 设计

学习引擎采用 LLM-first 架构：

```
用户消息 → LLM 信号提取 → 状态估算（规则辅助）→ LLM 诊断决策
    → Guardrails 校验 → LLM 路径规划 → LLM 教学回复 → 写回状态
```

- LLM 负责所有核心决策（信号提取、诊断、规划、回复）
- 规则仅用于 guardrails 约束（如"不懂不复习"、"高混淆先澄清"）
- Guardrail 违规时修正 LLM 决策，不回退到规则

## 团队分工

- **成员 A**：产品与学习设计 — 学习闭环、用户旅程、评估指标
- **成员 B**：AI 编排与内容引擎 — 诊断、学习路径规划、agent workflow
- **成员 C**：前端体验与 demo — 交互原型、状态流转、展示层

## 文档入口

- `docs/spec.md`：当前阶段要做什么
- `docs/plan.md`：接下来做什么
- `docs/status.md`：已经做到哪里
- `docs/memory/`：长期记忆与决策
- `docs/README.md`：文档总入口和分层说明

## 协作

- 分支和 PR 规则见 [CONTRIBUTING.md](CONTRIBUTING.md)
- 协作流程见 [docs/process/collaboration-playbook.md](docs/process/collaboration-playbook.md)
- 文档入口见 [docs/README.md](docs/README.md)

## 常见问题

### `uv` 下载 Python 报证书错误

在命令中加 `--native-tls`：

```bash
uv --native-tls run --directory apps/agent python -m xidea_agent
```

### 启动时报 `OPENAI_API_KEY is required`

确保已设置环境变量：

```bash
export OPENAI_API_KEY="sk-你的key"
```

### Shell 找不到 `pnpm` 或 `node`

临时添加 nvm 路径：

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
```
