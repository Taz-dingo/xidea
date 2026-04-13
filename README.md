# Xidea

Xidea 是一个面向内部比赛的 AI 学习编排系统 demo 仓库。目标不是做另一个静态卡片工具，而是让系统接住多样输入，理解用户状态，并决定接下来该怎么学。

## Current Scope

- 只做比赛当前阶段必要的 demo 和协作文档
- 当前核心只验证一件事: 系统会根据学习状态安排下一步学习动作
- 输入形式和训练形式都可以多样，但核心判断逻辑是一套
- 所有复杂能力先用 mock 数据和规则表达，不急着接真实多模态链路

## Quick Start

```bash
pnpm install
pnpm dev:web
```

## Local Development

### Prerequisites

- Node.js 22 with `pnpm`
- `uv`
- Python 3.11

If your shell does not load `node` or `pnpm` by default, you can temporarily add the local nvm path:

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
```

If your shell does not load `uv` by default, use:

```bash
$HOME/.local/bin/uv --version
```

### Run the Agent

In one terminal:

```bash
cd "/Users/chenguang/Dingo Projetcts/xidea"

export XIDEA_AGENT_DB_PATH="$PWD/output/xidea-agent.db"

$HOME/.local/bin/uv --native-tls run \
  --directory apps/agent \
  --python 3.11 \
  python -m xidea_agent
```

After startup, the agent API should be available at:

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/schemas`

### Run the Web App

In another terminal:

```bash
cd "/Users/chenguang/Dingo Projetcts/xidea"

export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"

pnpm install
pnpm dev:web
```

Then open:

- `http://127.0.0.1:5173`

In local development, Vite proxies `/agent-api/*` to `http://127.0.0.1:8000`, so the web app will call the local agent by default.

### Verify the Backend

You can verify the agent separately with:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

You can also send one real demo request:

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

### Notes

- If `uv` fails to download Python with a certificate error, keep `--native-tls` in the command.
- If you prefer not to rely on local shell config, the absolute-path commands above are the most stable way to run this repo on this machine.

## Team Split

- 成员 A: 产品与学习设计
  负责学习闭环、练习形态、用户旅程、评估指标
- 成员 B: AI 编排与内容引擎
  负责诊断、学习路径规划、多模态单元生成、提示词与 agent workflow
- 成员 C: 前端体验与 demo
  负责交互原型、状态流转、展示层、可演示故事线

## Repo Structure

- `apps/web`: React + Tailwind + shadcn/ui-oriented frontend
- `apps/agent`: Python + LangChain + LangGraph orchestration core
- `docs/`: 产品、架构、协作、记忆文档
- `.agents/skills/`: 项目级 skills

## Operating Docs

- `docs/spec.md`: 当前阶段要做什么
- `docs/plan.md`: 当前阶段接下来做什么
- `docs/status.md`: 当前已经做到哪里
- `docs/memory/`: 长期记忆与决策

默认从项目级 skill `project-onboarding` 开始进入仓库上下文。

## Tech Direction

- 前端 UI 和样式: TypeScript / React / Tailwind CSS / shadcn-friendly structure
- 核心编排和 agent: Python / LangChain / LangGraph
- 当前仓库优先把前后端边界、状态模型和编排骨架搭稳

## Collaboration

- 分支和 PR 规则见 [CONTRIBUTING.md](/Users/chenguang/Dingo%20Projetcts/xidea/CONTRIBUTING.md)
- 三人协作方式见 [docs/collaboration-playbook.md](/Users/chenguang/Dingo%20Projetcts/xidea/docs/collaboration-playbook.md)
- agent 长期记忆管理见 [docs/agent-memory.md](/Users/chenguang/Dingo%20Projetcts/xidea/docs/agent-memory.md)
