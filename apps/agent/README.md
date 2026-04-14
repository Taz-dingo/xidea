# Xidea Agent

Xidea 的 Python 编排核心 — 基于 LLM-first 架构的学习引擎。

## 架构

LLM 是核心 pedagogical agent，规则仅作为 guardrails：

```
用户消息 → LLM 信号提取 → 状态估算 → LLM 诊断 → Guardrails → LLM 规划 → LLM 回复 → 写回
```

- **LangGraph**：编排 `load_context → diagnose → decide_action → maybe_tool → compose_response → writeback` 节点链
- **FastAPI**：提供 `/runs/v0`、`/runs/v0/stream`（SSE）、schema 查询等 API
- **SQLite**：可选持久化，存储会话消息、学习者状态和复习调度

## 环境变量

| 变量 | 必须 | 默认值 | 说明 |
|------|------|--------|------|
| `XIDEA_LLM_API_KEY` | 条件必填 | 无 | 通用 LLM key，默认按智谱 OpenAI-compatible 入口使用 |
| `ZAI_API_KEY` | 条件必填 | 无 | 智谱官方环境变量名 |
| `OPENAI_API_KEY` | 条件必填 | 无 | OpenAI 兼容回退 |
| `XIDEA_LLM_BASE_URL` | 否 | 智谱 `https://open.bigmodel.cn/api/paas/v4/` 或 OpenAI 默认 | 自定义 OpenAI-compatible base URL |
| `XIDEA_LLM_MODEL` | 否 | `glm-5` 或 `gpt-4o-mini` | LLM 模型 |
| `XIDEA_LLM_TRUST_ENV` | 否 | `false` | 是否继承代理环境变量 |
| `XIDEA_LLM_CA_BUNDLE` | 否 | 无 | 自定义 CA 证书文件路径 |
| `XIDEA_LLM_ZHIPU_THINKING` | 否 | `disabled` | 智谱是否开启 thinking |
| `XIDEA_AGENT_DB_PATH` | 否 | 无 | SQLite 数据库路径 |
| `XIDEA_AGENT_ALLOW_ORIGINS` | 否 | `localhost:5173` | CORS 允许域名 |

## 本地运行

### 启动 API

```bash
export XIDEA_LLM_API_KEY="你的key"
export XIDEA_AGENT_DB_PATH="$PWD/output/xidea-agent.db"

uv run python -m xidea_agent
```

### 运行测试

```bash
uv run pytest tests/ -v
```

测试使用 mock LLM，不需要真实 API key。

## 核心模块

| 模块 | 职责 |
|------|------|
| `llm.py` | LLM 调用封装：信号提取、诊断、计划生成、回复生成 |
| `runtime.py` | 编排步骤实现 + 规则辅助函数 |
| `graph.py` | LangGraph 图构建 |
| `api.py` | FastAPI 端点 |
| `guardrails.py` | 5 条行为约束规则（G1-G5） |
| `review_engine.py` | 复习调度启发式引擎 |
| `repository.py` | SQLite 持久化 |
| `state.py` | Pydantic 数据模型 |
| `tools.py` | 4 类工具意图 + 上下文补充 |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/schemas` | GET | 查看数据模型 schema |
| `/graph` | GET | 查看编排图结构 |
| `/runs/v0` | POST | 执行一次完整 agent 循环 |
| `/runs/v0/stream` | POST | SSE 流式输出 |
| `/storage/status` | GET | 持久化状态 |
| `/threads/{id}/recent-messages` | GET | 会话历史 |
| `/threads/{id}/units/{uid}` | GET | 学习者状态 |
