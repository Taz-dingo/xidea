# Decision Log

只保留"当前仍生效、后续会反复影响协作或实现"的活跃决策。
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
