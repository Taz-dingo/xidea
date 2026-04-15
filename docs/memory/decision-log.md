# Decision Log

只保留“当前仍生效、后续会反复影响协作或实现”的活跃决策。
更早期、已实现、已替代或过细的历史记录见 [docs/archive/decision-log-history.md](../archive/decision-log-history.md)。

## 2026-04-14 — 决策日志改为活跃薄层

### 决策

`docs/memory/decision-log.md` 不再作为无限追加的历史流水账，而是只保留当前仍生效的关键决策；旧记录归档到 `docs/archive/decision-log-history.md`。

### 原因

- 当前文件已经堆积过多阶段性实现记录，开始影响扫读效率
- 长期记忆应该帮助后续协作，而不是把所有施工过程永久留在主入口
- 主 log 变短后，更容易和 `spec / status / plan` 分工清楚

### 影响

- 新决策先判断是否仍属于“长期、稳定、可复用”的活跃规则
- 已实现、已替代或纯历史背景的记录，优先移动到 archive
- 后续默认先看主 log，再按需回查 archive

## 2026-04-14 — 文档分层与精简规则

### 决策

`docs/` 继续维持 operating docs、process guides、reference docs、archive 四层结构，并主动合并重复参考文档，不让根目录或 reference 层持续膨胀。

### 原因

- 目录结构只是第一步，如果治理规则不跟上，文档还是会重新长回去
- `backlog`、`demo-showcase-strategy`、`scientific-review-integration` 已经和 `plan`、`competition-defense-kit`、`product-brief` 高度重叠
- 文档数量过多会降低新成员进入速度，也会增加 source of truth 漂移风险

### 影响

- `docs/process/*` 作为流程类当前规则，不再被当作普通 reference
- `docs/plan.md` 同时承接近期计划和较远路线图，不再单独维护 `reference/backlog.md`
- demo 展示策略并入 `docs/reference/competition-defense-kit.md`
- 科学复习相关的产品表述收敛到 `docs/reference/product-brief.md`

## 2026-04-14 — Workspace UI 默认避免显式解释文案，中栏只有用户输入使用卡片

### 决策

比赛版 workspace 默认避免在 UI 里用显式文案重复解释当前状态，尤其是空态、默认态、待生成态；
能通过布局、留白、占位和真实数据出现顺序表达的，不再额外补一句说明。
同时，中栏 thread 里默认只有用户输入保留带边框卡片，agent 输出、诊断、路径、证据链和状态回写统一改为无边框的高信息密度信息流。

### 原因

- 当前界面已经多次因为“解释性文案”显得像说明书，而不是工作台
- 用户已明确要求空态保持安静，不要反复强调“这是空白 session / 这是待生成状态”
- 中栏如果同时把系统输出也做成卡片，会显著降低信息密度，并模糊用户输入与系统输出的层级差异

### 影响

- 后续前端迭代默认不再为 empty / blank / pending 状态补显式说明文案，除非缺少文案会直接导致功能不可理解
- 中栏默认保留“用户输入 = 卡片，系统输出 = 非卡片信息流”这条视觉规则
- 任何新增诊断、路径、证据或 writeback UI，优先通过排版和层级表达，而不是再退回边框卡片和说明句

## 2026-04-14 — 右侧 inspector 采用监控型方向，画像与复习相关模块后续接真实系统

### 决策

比赛版当前的右侧 inspector 后续优先走“监控型”方向：
强调当前 learner state、风险、复习节奏、材料接入状态和系统运行状态，而不是继续做成长段叙事卡片。
同时，当前前端里已经存在的学习画像、复习热力图、材料面板等模块，不以 UI 壳为终点，后续需要逐步接到真实后端状态与真实材料上下文。

### 原因

- 当前三栏 workspace 已经成型，右栏更适合作为高信息密度的监控与状态面板，而不是重复中栏叙事
- 用户已明确希望右栏更专业、高效，优先像系统 inspector 而不是说明书
- 目前学习画像和热力图里仍有前端推断和 demo 表达层逻辑，必须在文档里明确它们后续要接真实系统，避免被误当成最终方案

### 影响

- 右栏后续重构默认按“监控型”拆模块，而不是继续堆平铺直叙长卡片
- 学习画像后续应逐步接入 agent / state 层真实信号，而不是只依赖前端推断
- 复习系统与热力图后续应接 Review Engine 真状态，而不是只做前端可视化推断
- 材料面板后续应接真实 source asset / tool context，而不是长期停留在 fixture

## 2026-04-13 — 产品定位与比赛证明路径

### 决策

Xidea 的稳定产品定位是“按项目组织的 AI 学习编排系统”；当前比赛版只用“AI 工程师围绕真实项目学习 RAG 系统设计”这个主案例来证明该定位。

### 原因

- 团队需要一个稳定的产品定义，避免退化成问答工具或卡片工具
- 比赛阶段又必须极度收敛，否则主线会被多案例、多功能打散

### 影响

- `spec.md`、`status.md`、答辩文档和 demo 表达都默认围绕主案例收敛
- 这种收敛只作用于比赛证明路径，不改变长期产品边界

## 2026-04-13 — 记忆系统边界

### 决策

`Review Engine`、`Agent Memory` 和 `Consolidation` 是三层不同能力；科学复习是记忆调度子能力，不是产品本体。

### 原因

- 不区分这三层，状态模型、动作选择和后续实现边界都会混乱
- 用户“没懂”和“快忘了”需要完全不同的系统动作

### 影响

- 系统必须同时维护理解状态和记忆状态
- 当前判断顺序默认是先决定学习动作，再决定是否进入复习

## 2026-04-13 — Runtime 与前后端边界

### 决策

第一版继续采用“受约束单 pedagogical agent + Python / LangChain / LangGraph”作为编排核心；`apps/web` 是 interaction shell，`apps/agent` 是 orchestration brain。

### 原因

- 当前阶段更重要的是把“系统会决定你该怎么学”讲清楚，而不是提前复杂化多 agent 结构
- web 侧已经明确需要消息流、chat surface 和状态展示，适合作为交互壳而不是主编排层

### 影响

- `apps/web` 负责交互、消息流、证据链展示和状态可视化
- `apps/agent` 负责状态读取、动作判断、工具调用、guardrail 和写回

## 2026-04-13 — 前端交互壳约束

### 决策

当前比赛版 web 前端默认采用 `shadcn/ui + Vercel AI SDK` 的交互壳，并要求关键前端任务补做真实浏览器验证。

### 原因

- 基础组件和消息流已经收敛到这套栈，继续手写 primitive 或本地消息拼接会增加重复成本
- 前端质量风险已经证明不能只靠静态检查

### 影响

- `apps/web` 优先复用现有 UI 组件与 AI SDK transport
- 前端交付默认补做页面结构、关键交互和 console 检查

## 2026-04-13 — 并行协作与分工路由

### 决策

当前默认按学习引擎、前端、产品 / demo 叙事三条主线并行推进；新任务开始前先判断主 owner、所属 workstream 和编辑边界。

### 原因

- 进入并行开发阶段后，如果不先路由，最容易发生 contract、页面结构和叙事同时漂移

### 影响

- 协作文档、onboarding 和 PR 范围整理都要先表达 workstream 与边界
- 跨 owner 任务需要明确主 owner 和配合 owner

## 2026-04-13 — 分支与 PR 工作流

### 决策

分支命名、短分支协作和 PR 描述模板通过项目级 skills 暴露，作为默认协作入口规则。

### 原因

- 这些请求往往直接进入执行，不会先翻协作文档
- 显式 skill 比散落规则更不容易漏掉

### 影响

- 分支相关请求优先触发 `branch-workflow`
- PR 描述相关请求优先触发 `pr-description`

## 2026-04-14 — 学习引擎 LLM-first 架构

### 决策

学习引擎采用 **LLM-first** 架构：LLM 是核心 pedagogical agent，规则仅作为 guardrails 约束 LLM 输出。兼容的 LLM API key 是必须的，未设置时系统拒绝启动。

全链路由 LLM 驱动：信号提取 → 状态估算（规则辅助） → 诊断决策 → guardrail 校验 → 计划生成 → 教学回复。Guardrails 违规时在 LLM 诊断上直接修正，而非 fallback 到规则诊断。

### 原因

- 产品定位是"受约束的单 pedagogical agent"，LLM 就是那个 agent
- 规则做主路径会让系统退化为另一个静态工具，违背 spec 的核心差异点
- 原有"无 key 静默 fallback 到规则"的设计让两套路径都需要维护，且容易让团队误以为规则路径是生产方案

### 影响

- `XIDEA_LLM_API_KEY` / `ZAI_API_KEY` / `OPENAI_API_KEY` 三者之一是启动必须的环境变量
- `run_agent_v0()` / `build_graph()` / `compile_graph()` 的 `llm` 参数为 required
- 规则辅助函数保留代码用于测试和局部软降级，但不再作为独立运行路径
- 详细设计见 `docs/reference/agent-state-design.md`，进度见 `docs/memory/learn-engine-todo.md`

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

- 当前真实时延里最慢的是 reply 这次长文本生成，用户长时间等不到任何正文，体感明显差于“先看到解释、再看到路径”
- plan 虽然重要，但它更适合承载到右栏和后续编排说明，不必阻塞正文首屏输出
- 先解除 reply 对 plan 的 prompt 依赖，可以在不引入线程并发复杂度的前提下，立刻改善首个可感知内容时间

### 影响

- stream 事件顺序从 `diagnosis -> plan -> text-delta -> state-patch -> done` 调整为 `diagnosis -> text-delta -> plan -> state-patch -> done`
- sync 路径 `compose_response_step()` 也同步调整为先生成 reply、再生成 plan，减少两条运行路径的行为分叉
- reply prompt 现在以 `diagnosis + learner_state + tool_result` 为主，plan 只作为可选上下文，不再是硬前置条件
