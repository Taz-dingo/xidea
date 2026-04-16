# Decision Log

只保留“当前仍生效、后续会反复影响协作或实现”的活跃决策。
更早期、已实现、已替代或过细的历史记录见 [docs/archive/decision-log-history.md](../archive/decision-log-history.md)。

## 2026-04-16 — 并行开发前冻结共享边界

### 决策

并行开发阶段默认以 [docs/process/shared-boundary-freeze.md](../process/shared-boundary-freeze.md) 作为共享边界 source of truth。
这版冻结覆盖：

- `Project / Session / KnowledgePoint / ProjectLearningProfile` 四个主对象
- `KnowledgePointState / ProjectMaterial / SessionAttachment / ProjectMemory` 四个关键配套对象
- `text-delta / activity / tool-result / state-patch / done` 的目标事件流
- activity 提交 contract、`run_id` 运行态概念和 `App Home -> Project Workspace -> Knowledge Point Detail` 页面结构

### 原因

- 当前 MVP 已经进入并行开发阶段，真正容易返工的不是方向本身，而是对象、payload、storage 和页面边界继续漂移
- 共享边界如果只存在于聊天或局部实现中，前后端和产品叙事会再次分叉

### 影响

- 后续 schema、repository、API contract 和前端类型统一向冻结文档里的命名和边界收敛
- 如果后续要改共享边界，优先更新冻结文档和决策日志，而不是只在实现里悄悄变化

## 2026-04-16 — MVP 收敛为 project-centric learning workspace

### 决策

当前 MVP 不再以单条 `thread` 为主对象，而是收敛为以 `Project` 为中心的学习工作区。
第一版稳定的产品心智为：

- `Project` 组织主题、材料、知识点、session 和 project 级学习画像
- `KnowledgePoint` 是项目内最小学习单元
- session 显式分为 `project / study / review`
- `Project Workspace` 默认先展示 knowledge point list，session 按需展开
- 第一版学习与复习先只做选择题，学习画像只做 project 级轻聚合

### 原因

- 之前的 thread-centric 叙事更像“带编排能力的 tutor”，还不够像项目型学习系统
- 需要先把“系统围绕项目持续组织学习”讲清楚，再扩展输入模态和学习形式

### 影响

- `spec / status / plan` 默认围绕 project-centric MVP 表达当前范围
- 后续页面和 schema 设计优先围绕 `Project / KnowledgePoint / Session / ProjectLearningProfile` 收敛

## 2026-04-15 — 学习引擎对齐单 agent + tool/activity loop

### 决策

比赛版下一轮学习引擎对齐成熟单 agent + tools 方案：

- 一次用户 run 以单个主决策回合为中心
- 同一 run 内允许多次 tool 或 activity 循环
- 不再把 `diagnosis -> reply -> plan` 作为长期稳定主路径
- `StudyPlan` 只保留为可选解释层或 activity 摘要，不再要求独立 LLM 调用生成展示型路径
- 学习材料默认作为结构化上下文进入 project 级材料池和 session 级附件关系，而不是单段扁平文本

### 原因

- 展示型 `StudyPlan` 和串行文本调用无法稳定证明“系统真的决定你接下来怎么学”
- 材料、memory、review context 如果不在主决策前进入同一证据包，判断质量和前后端 contract 都会持续漂移

### 影响

- runtime 优先收敛为 `load_context / prepare_evidence -> agent_turn -> tool_or_activity -> agent_turn(loop) -> writeback`
- 对话内 learning activity 应以结构化事件进入消息流，由前端按事件插入一张或多张 card
- `exercise-result / review-result` 成为后续状态回写输入

## 2026-04-14 — 学习引擎采用 LLM-first 架构

### 决策

学习引擎采用 **LLM-first** 架构：

- LLM 是核心 pedagogical agent
- 规则仅作为 guardrails 约束 LLM 输出
- 兼容的 LLM API key 是启动必须项
- Guardrails 违规时在 LLM 诊断上直接修正，而非回退到规则主路径

### 原因

- 产品定位是“受约束的单 pedagogical agent”，LLM 就是那个 agent
- 规则做主路径会让系统退化成另一个静态工具，违背当前产品差异点

### 影响

- `run_agent_v0()` / `build_graph()` / `compile_graph()` 的 `llm` 参数为 required
- 规则辅助函数保留用于测试和局部软降级，但不再作为独立生产路径
- 详细设计继续以 `docs/reference/agent-state-design.md` 和相关实现为准
