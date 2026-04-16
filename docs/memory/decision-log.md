# Decision Log

只保留"当前仍生效、后续会反复影响协作或实现"的活跃决策。
更早期、已实现、已替代或过细的历史记录见 [docs/archive/decision-log-history.md](../archive/decision-log-history.md)。

## 2026-04-16 — 开发前先匹配对应 skill，前端全局状态默认 Zustand

### 决策

仓库默认把“先找对应 skill，再开始实现”作为开发前置步骤。
稳定约束为：

- 开始实现前先检查当前任务是否已有对应的 project skill、framework skill 或 best-practice skill
- 默认先按 skill 的工作流、约束和落点建议来写代码，而不是写完后再补对照
- 只有在没有合适 skill，或 skill 与当前仓库边界明确冲突时，才跳过 skill，并需要说明原因
- 前端跨组件、跨页面、跨 feature 共享的客户端状态默认使用 Zustand
- 组件内部的临时交互状态、局部草稿和单组件 UI 状态继续优先使用 React state
- 改动默认按小步稳定切片推进；每完成一段可构建、可验证、职责清晰的改动，就尽快单独 commit，而不是把多段无关变化堆在同一提交里

### 原因

- 当前仓库已经把一部分稳定实践沉淀成 skill，如果开发时不先匹配 skill，很容易重新走回各写各的、风格漂移和重复返工
- 前端当前已经出现 workspace 级共享状态，如果继续把这类状态堆在 page hook 或层层 props 透传里，后续拆分成本和 review 成本都会继续放大
- 当前仓库仍在快速迭代，如果不强制小步稳定 commit，重构和功能修改很容易混在一起，降低 review 质量和回滚能力

### 影响

- 后续实现默认把“这次该用哪个 skill”作为开工前的显式检查项
- 前端新增全局共享状态时，优先建 Zustand store 或 slice，而不是继续扩大单个 page hook 的状态面
- review 时要把“这次有没有先匹配对应 skill”和“共享状态是否放在合适边界”作为显式检查项
- 提交和 review 默认按稳定切片组织，避免一个 commit 同时混入多块不相干重构

## 2026-04-16 — 提 PR 前先更新对应 docs，并先完成一轮自 review

### 决策

仓库默认把“先补 docs、再自 review、再开 PR”作为提 PR 前的固定步骤。
稳定约束为：

- 提 PR 前先检查这次改动是否需要更新 `docs/spec.md`、`docs/status.md`、`docs/plan.md`、`docs/memory/*` 或其他直接相关文档
- 需要更新的文档要在开 PR 前一并补齐，而不是把文档缺口留给 reviewer 兜底
- 提 PR 前默认先完成一轮自 review，确认代码、文档、验证和风险说明已经对齐
- 提 PR 后仍保持“至少一人 review 后再合并”的团队规则

### 原因

- 当前仓库同时依赖 demo、代码和文档来支撑协作；如果 PR 前不先补 docs，reviewer 很容易看到一半才发现叙事、状态或共享约束已经漂移
- 自 review 是把明显问题挡在 PR 之前的最低成本手段，能减少把拼装态、缺说明状态直接抛给 reviewer

### 影响

- 后续开 PR 时，要把“docs 是否已补齐”和“是否已做过自 review”作为显式检查项
- reviewer 默认可以先假设作者已经完成基础自检，把注意力更多放在边界、回归风险和共享影响上

## 2026-04-16 — 单文件禁止持续堆职责，前后端与 agent 入口默认只做编排

### 决策

项目默认不接受把过多逻辑持续堆进单个文件的实现方式。
稳定约束为：

- 这条规则同时适用于前端、后端和 agent 实现
- 页面入口、`App`、screen、route、FastAPI endpoint、LangGraph graph/runtime 入口文件默认只负责状态编排与组装
- 领域逻辑、数据转换、网络交互、持久化访问、graph/node 逻辑、prompt 构造和可复用 UI 细节必须按职责拆出
- 如果某个文件已经开始同时承载多个职责，优先先拆分，再继续加功能

### 原因

- 当前 demo 仍在快速迭代，如果把逻辑长期堆在少数入口文件里，后续前后端协作、review 和局部重构成本会快速放大
- 这个仓库需要支持多人并行和 agent 接力，职责清晰比“暂时都写在一起更快”更重要

### 影响

- 后续前端、后端和 agent 实现都应优先做职责拆分，而不是默认接受超重入口文件
- review 时要把“单文件是否承担过多职责”作为显式检查项，而不只看功能是否跑通

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

- 之前的 thread-centric 叙事更像"带编排能力的 tutor"，还不够像项目型学习系统
- 需要先把"系统围绕项目持续组织学习"讲清楚，再扩展输入模态和学习形式

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

- 展示型 `StudyPlan` 和串行文本调用无法稳定证明"系统真的决定你接下来怎么学"
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

- 产品定位是"受约束的单 pedagogical agent"，LLM 就是那个 agent
- 规则做主路径会让系统退化成另一个静态工具，违背当前产品差异点

### 影响

- `run_agent_v0()` / `build_graph()` / `compile_graph()` 的 `llm` 参数为 required
- 规则辅助函数保留用于测试和局部软降级，但不再作为独立生产路径
- 详细设计继续以 `docs/reference/agent-state-design.md` 和相关实现为准

## 2026-04-14 — LLM 接口切到 OpenAI-compatible，默认智谱

### 决策

后端 `build_llm_client()` 改为接 OpenAI-compatible 接口，默认把通用 key 接到智谱 `glm-5`；同时保留旧的 `OPENAI_API_KEY` 启动方式，避免已有本地环境失效。

### 原因

- 比赛 demo 需要尽快接入真实模型，而智谱 OpenAI-compatible 接口可以最小改动复用现有 SDK
- 直接把 provider 逻辑收敛到 `llm.py`，可以避免前端、runtime、API 层再感知供应商差异
- 保留 `OPENAI_API_KEY` 兼容路径，能减少已有本地环境和测试脚本的迁移成本

### 影响

- 默认环境变量读取顺序为 `XIDEA_LLM_API_KEY -> ZAI_API_KEY -> OPENAI_API_KEY`
- 未显式指定 `XIDEA_LLM_BASE_URL` 时，通用 key 默认接智谱 `https://open.bigmodel.cn/api/paas/v4/`
- 未显式指定模型时，智谱默认 `glm-5`，OpenAI 兼容回退保持 `gpt-4o-mini`
- 智谱默认关闭 `thinking`，并在结构化阶段启用更严格的 JSON 输出约束，避免空正文或 JSON 解析失败
- LLM HTTP client 默认不继承代理环境变量；如需显式走代理或自定义 CA，使用 `XIDEA_LLM_TRUST_ENV` / `XIDEA_LLM_CA_BUNDLE`

## 2026-04-15 — 真实 LLM API 端到端验证完成，新增 force-stream 兼容与调用计时

### 决策

使用 OpenAI-compatible 中转站 (gpt-5.4) 完成真实 API 端到端验证；新增 `XIDEA_LLM_FORCE_STREAM` 环境变量适配要求 `stream=true` 的代理；为所有 LLM 调用添加按步骤标记的计时日志。

### 原因

- 中转站 API 拒绝非 streaming 请求（返回 400 "Stream must be set to true"），需要在 `_chat_completion` 中透明地收集 stream chunks 模拟非流式返回
- 团队需要逐调用的耗时数据来定位性能瓶颈和优化方向
- 真实 API 测试需要与 mock 测试隔离，避免 `.env` 加载污染 mock 环境

### 影响

- `XIDEA_LLM_FORCE_STREAM=true` 时，所有 `_chat_completion` 内部使用 streaming 并收集结果，对调用方透明
- 每次 LLM 调用输出 `[LLM:<caller>]` 标记的 INFO 日志，包含 model、provider、耗时(s)、输出字符数
- 真实 API 测试标记为 `@pytest.mark.real_llm`，无 API key 时自动 skip

## 2026-04-14 — bundled 诊断主路径降到 3 次模型调用

### 决策

将主路径里的 `signal extraction + diagnosis` 合并为一次 bundled LLM 调用，保留原来的拆分调用只作为失败时的回退路径。

### 原因

- 旧主路径一条用户消息通常要串行走 4 次模型请求，首屏等待时间主要耗在多次网络往返和模型排队
- `signals` 与 `diagnosis` 本身共享同一批用户上下文，拆成两次调用的收益低于带来的时延成本
- 保留拆分路径作为 fallback，可以在不牺牲稳定性的前提下先拿到最直接的性能收益

### 影响

- 正常主路径从 4 次模型请求降到 3 次：`bundled diagnosis -> plan -> reply`
- bundled 调用失败时，仍会回退到 `signals -> diagnosis` 的拆分路径，避免一次兼容性问题直接打断整轮 agent
- runtime 的 `diagnose_step()` 先用规则信号做临时状态估算，再用 bundled 结果覆盖回真实 learner state

## 2026-04-14 — stream 路径改为 reply 优先，plan 后置

### 决策

`/runs/v0/stream` 的运行顺序调整为：诊断完成后先开始流式输出 assistant reply，再补发 `plan` 事件；reply 不再硬依赖已生成的 plan。

### 原因

- 当前真实时延里最慢的是 reply 这次长文本生成，用户长时间等不到任何正文，体感明显差于"先看到解释、再看到路径"
- plan 虽然重要，但它更适合承载到右栏和后续编排说明，不必阻塞正文首屏输出
- 先解除 reply 对 plan 的 prompt 依赖，可以在不引入线程并发复杂度的前提下，立刻改善首个可感知内容时间

### 影响

- stream 事件顺序从 `diagnosis -> plan -> text-delta -> state-patch -> done` 调整为 `diagnosis -> text-delta -> plan -> state-patch -> done`
- sync 路径 `compose_response_step()` 也同步调整为先生成 reply、再生成 plan，减少两条运行路径的行为分叉
- reply prompt 现在以 `diagnosis + learner_state + tool_result` 为主，plan 只作为可选上下文，不再是硬前置条件
