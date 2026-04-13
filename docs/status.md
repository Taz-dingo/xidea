# Status

## As Of 2026-04-13

### Done

- 初始化 repo 并接上 remote
- 搭了最小可运行的 web demo，并迁移到 `apps/web`
- 明确三人协作的基础规则
- 建立了 `docs/memory/` 作为长期记忆层
- 新增项目级 skills，用于统一 onboarding、React、TS、前端设计约束
- 将产品表述统一为"AI 学习编排系统"
- 明确科学复习在系统中是记忆调度子能力，而不是产品本体
- 建立 `apps/agent` Python 骨架，承接后续 LangGraph 编排
- 将当前比赛 demo 收敛到最小 agent loop
- 明确 `Review Engine / Agent Memory / Consolidation` 三层边界
- 明确学习上下文按 `project / thread` 组织
- 明确技术方向切到"受约束单 agent + LangChain / LangGraph 最小接入"
- 新增 `branch-workflow` 项目级 skill，把开分支、改分支名和 PR 协作约束变成可触发流程
- 明确 Vercel AI SDK 属于 web 交互层，Python + LangGraph 继续作为核心编排层
- 明确 web 与 agent 第一版采用事件流协议，先收敛 `text-delta / diagnosis / plan / state-patch / done`
- 锁定当前比赛版主案例为"AI 工程师围绕真实项目学习 RAG 系统设计"
- 明确当前比赛叙事只服务于 project-backed learning，而不是泛化 all-in-one 学习平台
- 明确第一版 demo 必须让编排过程可见：至少展示输入上下文、学习状态、动作理由、路径输出和状态回写
- 明确比赛版主案例只是证明路径，不改变长期产品的扩展方向
- 将 web demo 数据统一收敛到 RAG 主案例，不再并列展示跨学科样例
- 将主案例映射成更可信的状态来源、诊断信号和回写预览
- 将编排证据链做成默认可见输出，并把 planner explanation 结构化为主决策与写回预览
- 初版架构讨论已收敛到可开工状态，并明确 SQLite 状态层与启发式 `Review Engine v0`
- 完善 `state.py` 数据模型：双轨 LearnerState + 6 个领域模型 + 2 个枚举
- 定义 agent tool schema：4 个最小必要工具 + mock 实现 + TOOL_REGISTRY
- 定义 agent guardrail schema：5 条行为约束规则 + 统一检查入口
- 搭建 LangGraph 最小编排图：5 个节点 + StateGraph + 规则 mock 实现
- 生成 `docs/agent-state-design.md` 设计文档
- 将 `learn-engine` 分支上的 agent contract 对齐到 `AgentRequest / diagnosis / plan / state-patch / StreamEvent`
- 在 `apps/agent` 补上 v0 runtime、SQLite repository 与 FastAPI `/runs/v0` / `/schemas` / storage endpoints
- LangGraph 编排图已切到 `load_context -> diagnose -> decide_action -> maybe_tool -> compose_response -> writeback`
- `load_context` 已可读取 SQLite 中的 recent messages 与 prior learner state 作为本轮基线
- 为 runtime、graph、API、repository roundtrip 补上 10 个测试，当前全部通过
- 明确当前 v0 默认按学习引擎 / 前端 / 产品叙事三条主线并行推进，并要求每次新开工先完成 workstream routing

### In Progress

- 收敛单 pedagogical agent 的输入输出结构、状态回写、streaming contract 和 API contract
- 保持 web demo 简洁可演示，同时继续对齐后续 agent runtime 接口

### Next

- 把 web demo 接到真实 `/runs/v0` 返回的 `diagnosis / plan / state-patch` 结构
- 继续丰富 `maybe_tool` 的真实上下文来源，而不只返回轻量 stub payload
- 把 `Review Engine v0` 从 patch 级回写推进到独立启发式调度层
- 决定第一版 `Consolidation` 是先做手动触发演示，还是带模拟定时入口的可视化 demo

### Risks

- 如果过早引入复杂 graph 或多 agent，当前 demo 容易被工程结构拖慢
- 如果 demo 展示很多能力但没有主线，差异点会不明显
- 如果主案例虽然锁定，但状态来源和动作理由不够可信，评委仍会把它看成概念样机
