# Status

## As Of 2026-04-10

### Done

- 初始化 repo 并接上 remote
- 搭了最小可运行的 web demo，并迁移到 `apps/web`
- 明确三人协作的基础规则
- 建立了 `docs/memory/` 作为长期记忆层
- 新增项目级 skills，用于统一 onboarding、React、TS、前端设计约束
- 将产品表述统一为“AI 学习编排系统”
- 明确科学复习在系统中是记忆调度子能力，而不是产品本体
- 建立 `apps/agent` Python 骨架，承接后续 LangGraph 编排
- 将当前比赛 demo 收敛到最小 agent loop
- 明确 `Review Engine / Agent Memory / Consolidation` 三层边界
- 明确学习上下文按 `project / thread` 组织
- 明确技术方向切到“受约束单 agent + LangChain / LangGraph 最小接入”

### In Progress

- 收敛单 pedagogical agent 的输入输出结构、状态回写和 API contract
- 锁定比赛主案例与最小 demo surface

### Next

- 写清 agent 层的 state / action / tool / guardrail 结构
- 写清 LangGraph 最小 graph 的节点与边
- 定义 web 与 agent 之间的最小 API contract
- 决定第一版是否只保留问答与做题两种输出
- 决定“定时整理记忆”第一版是讲法还是可视化 demo

### Risks

- 如果主案例迟迟不定，demo 很容易横向发散
- 如果过早引入复杂 graph 或多 agent，当前 demo 容易被工程结构拖慢
- 如果 `Review Engine` 与 `Agent Memory` 边界不清，后续模型和数据结构会混乱
- 如果 agent 的 action space 和 guardrails 不清，行为会不稳定且难以评估
- 如果 demo 展示很多能力但没有主线，差异点会不明显
