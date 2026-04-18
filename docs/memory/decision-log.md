# Decision Log

只保留"当前仍生效、后续会反复影响协作或实现"的活跃决策。
更早期、已实现、已替代或过细的历史记录见 [docs/archive/decision-log-history.md](../archive/decision-log-history.md)。

## 2026-04-18 — `project materials` 已升成 backend 持久化对象；前端只消费真实上传结果，不再把材料上传继续做成 demo seed 选择

### 决策

- `project materials` 第一版正式收成 backend 持久化对象：agent repository 现在维护独立 `project_materials`，并提供 `list / upload` API
- 前端当前允许在两个正式入口上传材料：`Edit Project Meta` 的材料池，以及 `project session` 里的材料 tray；上传成功后会立即回流到当前 project materials，并在 project session 下可直接附着到本轮上下文
- agent 消费材料时，`source_asset_ids`、`/assets/summary` 和 runtime `retrieve_source_assets()` 都必须优先读取项目真实上传材料；只有找不到对应 project material 时，才回退到 demo catalog
- `project session` 默认不再偷偷附加 demo 默认材料；只有项目池里的材料，或用户这轮显式挂进去的材料，才会进入 agent 上下文

### 原因

- 之前所谓“上传材料”本质只是前端在 demo `sourceAssets` 里做选择，既没有真实持久化，也不会在刷新后保留，更不会进入 agent 的真实材料读取链
- 这会直接破坏比赛版要证明的那条链路：用户补材料 -> 系统基于材料讨论主题 / 提知识点更新建议 -> 后续 session 真正消费这批材料

### 影响

- 后续凡是涉及 project materials 的 UI，不得再直接从全局 demo `sourceAssets` 发明“上传结果”；必须消费 backend 返回的 `SourceAsset`
- 当前第一版真实上传范围只覆盖已有 project 的材料池和 `project session` 附着；如果后续要支持“创建 Project 时直接上传本地文件”，需要单独补创建流程 contract，而不是继续在 UI 里偷偷混用 demo 资产

## 2026-04-18 — 学习卡的正确性与分层提示由 backend activity contract 显式提供，前端只负责即时反馈与整组回看

### 决策

- `study / review session` 的 choice activity 现在由 backend 显式下发 `is_correct / feedback_layers / analysis`，前端不再自己猜哪一项是对的，也不自己拼错误分析
- 单张卡在前端本地执行“选了就判、错了继续、对了再进下一张”的即时交互；整组卡仍然要在本地全部完成后，作为一次统一 `activity_result` 回传给 agent
- 已完成 card deck 要保留在右侧 inspector，可回看每张卡的尝试轨迹、最终作答，以及错误选择暴露出的分析

### 原因

- 这类 pedagogical judgment 属于 learning engine 语义，长期不能继续放在前端 heuristic 里，否则不同入口和 mock/fallback 很容易再次漂移
- 用户要的是强反馈学习体验，而不是“做完再等 agent 才知道对不对”；但与此同时，agent loop 仍应保持“一组卡完成后再统一进入下一轮”

### 影响

- 后续新增或调整 activity 时，默认一起维护 choice feedback contract，而不是只给 label / detail
- 前端后续如果继续打磨互动反馈，只能消费这份 contract 做表现层增强，不能反向发明新的 correctness / hint 语义

## 2026-04-18 — `study / review session` 遇到 capability / meta 提问时先说明 session 能力，不直接出卡

### 决策

- 当用户在 `study / review session` 里问的是 “你可以做什么 / 你能怎么帮我 / 你是谁” 这类 capability / meta 问题时，agent 先返回 session 说明，不直接进入学习卡或复习卡
- 这类 turn 的主目标是把当前 session 的职责边界讲清楚，并把下一条消息收成具体的学习切入点，而不是把 meta 提问误当成知识点作答
- 当前 UI 也不再把“最新 assistant 文本提问”和“pending activity 卡组”同时摊在中栏；有待完成卡组时，assistant 区只保留一条简短引导

### 原因

- 当前实现会把 `hi，你可以做什么` 这类消息直接丢进 study/review 编排链，导致 assistant 一边发卡一边继续提问，体验上像两套交互同时抢主导权
- 一部分 fallback activity 文案也过于 demo 内部化，容易让题干看起来像在问系统自己，而不是围绕用户当前主题学习

### 影响

- 后续 review 要显式检查：meta / capability turn 是否被错误编排成正式学习动作
- study / review 的 activity 文案默认继续朝“围绕当前知识点和用户主题”收敛，避免出现“为什么系统这样安排你”这类自指题干

## 2026-04-18 — `project session` 的默认语义收敛为“学习方向 / 材料 / 主题讨论 / 知识点更新”

### 决策

- `project session` 的默认目标不再表述为泛化的 “project chat / project orchestration”，而是明确收敛为四类推进动作：对齐学习方向、围绕学习主题讨论、补充相关材料、提出 knowledge point 更新建议
- `project session` 的 prompt、template fallback、low-info 澄清文案和 session guidance 摘要都要使用同一套语义，不允许 prompt 说一套、runtime fallback 又退回“继续 project 讨论 / 设计判断”
- 如果用户在 `project session` 里问的是系统 / 操作层面的 meta 问题，可以简短回答，但回答后仍要自然拉回当前学习主题、材料或知识点推进

### 原因

- 当前实现虽然已经阻断了 `project session` 发题，但 reply / fallback 文案仍然偏“泛 project 对话”，导致实际回复经常不贴用户的学习意图，也不符合 spec 对 `project session` 的定义
- 用户从 UI 视角看到的结果是：文本没有跑偏到 study/review，但仍然像在做空泛的 project 管理对话，缺少“你现在要学什么 / 缺什么材料 / 哪个知识点该更新”的明确推进感

### 影响

- 后续 review 不只要检查 `project session` 会不会发题，还要检查回复是否真正落到这四类推进目标之一
- 后续如果继续优化 `project session` 的 LLM 质量，few-shot 和 fallback reply 也要围绕这四类目标组织，不能再回到抽象的 “继续 project 讨论”

## 2026-04-18 — `project session` 必须先按 project chat 推进，低信息输入不触发学习编排

### 决策

- `project session` 新增 deterministic low-info guard：像 `hi / hello / 在吗 / 继续` 这类低信息输入，不再走 LLM 学习诊断和学习动作链路
- 这类输入会直接返回 project-chat 澄清回复，只提示用户明确这轮是要继续讨论设计问题、补材料、沉淀知识点，还是切到 `study / review session`
- `project session` 的 LLM prompt 必须显式看到 `session_type`，并遵守“只能 project chat，不得把回复写成回忆 / 练习 / 作答 / 情境模拟”这条约束
- `project session` 的空 fallback 计划和空 state patch 也要遵守这条边界：不再把 project chat 写回成 learner state / review patch

### 原因

- 之前即使前端已经不再渲染题卡，backend prompt 仍把所有 session 都当成 pedagogical turn，导致 `project session` 文本语义继续漂成“来做个快速回顾”
- 对低信息输入缺少专门 guard，会让 `hi` 这类消息也被硬套进 diagnosis / reply 模板，既慢又明显不符合 spec
- 回复生成链路里还存在把整个 `Message` 对象而不是纯 `content` 传进 LLM prompt 的问题，会进一步降低 reply 对用户输入的贴合度

### 影响

- 后续 review 要同时检查两层：`project session` 不仅不能发题卡，reply / plan 语义本身也不能漂回学习 session 口吻
- `project session` 默认不再写 learner/review state patch；这类 session 的主产物应回到 project chat、本轮解释和 knowledge point suggestion
- 后续 prompt 设计默认按“共享 base prompt + session-specific prompt”分层，不再继续把 `project / study / review` 的行为差异堆进一份超长共享 prompt
- 后续若继续优化响应速度，`project session` 的 greeting / continue 类 turn 已经有了稳定的无 LLM 快路径

## 2026-04-18 — `project / study / review` 的边界按 session 类型硬收口，学习动作改成整组 `activities[]`

### 决策

当前 session 语义固定为：

- `project session` 只负责 project 对话、材料挂载、topic / rules 调整和 knowledge point suggestion / archive suggestion，不直接下发学习题卡
- `study session` 和 `review session` 才允许下发学习动作；这两类 session 不再支持挂 project materials，也不再把右栏渲染成 project 级材料 / 知识点治理面板
- learning activity contract 正式收成一组 `activities[]`，而不是单张 `activity`
- 前端必须先在本地完成整组 card，再把整组结果作为一次统一输入回传给 agent，进入下一轮 agent loop
- 第一版 study / review activity 统一收成 choice-based 卡片，不再混用文本作答卡

### 原因

- 之前虽然 request 已显式带 `session_type`，但 UI、inspector 和 activity loop 仍保留了大量跨 session 泄漏：project session 会提前看到学习卡，study / review 也还能挂材料
- 单张 `activity` + 一卡一轮回复会把学习动作打散成很多碎 agent turn，既不符合 spec，也会让 session 节奏变成“做一题就等一次长回复”
- 如果不把这些边界收死，后面前端很容易再次靠 fallback / heuristic 把 session 语义补乱

### 影响

- 后续 backend / frontend 联调默认按 `activities[]` 检查 contract，不再以单张 `activity` 为主路径
- `project session` 的 inspector、材料入口和 backend preload 默认继续按 project orchestration 语义收敛；study / review 则默认围绕当前 knowledge point 和回忆 / 学习编排展开
- 后续若要支持更开放的学习形式，需要先在 spec 里显式放开 choice-only 约束，而不是在前端直接混入文本题
- 后续 review 要显式检查：是否又出现 project session 发题、study / review 挂材料、或 activity 完一张就立刻进新一轮 agent 的回归

## 2026-04-18 — `AgentRequest` 显式携带 `session_type`，`project session` 不再默认伪装成 unit session

### 决策

当前 web -> agent contract 固定为：

- `AgentRequest` 显式携带 `session_type = project | study | review`
- `project session` 默认不再为了复用旧链路而塞一个 fallback `target_unit_id`
- `project session` 不直接下发学习 / 复习 `activity`；这一类 session 只负责围绕 project topic 推进对话、补材料、输出知识点 suggestion 等 project-level 编排结果
- knowledge point create / archive suggestion 只在 `project session` 下产出
- `review session` 默认优先保持“回忆校准 / 短反馈”语义；除非混淆非常明显，否则不回退成普通 teach / apply 问答
- `/runs/v0/stream` 在第一条 diagnosis 前先发 typed `status` 事件，前端据此渲染等待态和阶段提示

### 原因

- 之前前端会把 `project session` 连同一个默认 unit 一起发给 agent，导致 project chat 被误判成“围绕固定知识点的 session”
- 这会直接压缩 project 级 suggestion、session 差异化 prompt 和 lifecycle judgment 的空间，让 `project / study / review` 只剩 UI 标签区别
- 流式链路虽然会很快打开 SSE 连接，但在 diagnosis 前长期没有 typed event，前端只能靠本地 running state 硬撑等待区，无法表达真实阶段

### 影响

- 前端后续创建 request 时，必须显式传 `session_type`，并仅在有真实知识点焦点时传 `target_unit_id`
- 前端后续消费 `project session` 结果时，不得继续沿用 fallback / mock `activity` 把 project chat 渲染成“待做题”状态
- 学习引擎后续关于 session 差异、activity 节奏和 suggestion 边界的讨论，都以这条 contract 为前提，不再默认从 thread id 或 fallback unit 猜 session 语义
- 流式 UI 后续要优先消费 `status -> diagnosis -> text-delta -> ...` 这一顺序，而不是假设首个 typed event 一定是 diagnosis

## 2026-04-18 — 确定性 tool context 默认前置到主决策前，后置 tool loop 只保留给少数动态缺口

### 决策

学习引擎的稳定运行形态继续朝“单次主决策调用”收敛。
当前约束为：

- `material-import` 默认在主决策前预取 `asset-summary`
- `coach-followup` 默认在主决策前预取 `thread-memory`
- review 倾向明确时，默认在主决策前预取 `review-context`
- 带 `target_unit_id` 的常规问答，默认在主决策前预取 `unit-detail`
- 只有当 LLM 在已有这些证据后仍明确返回 `needs_tool=true`，或后续确实出现新的动态缺口时，才继续走后置 `tool / session loop`
- 后置 tool 分支若命中已前置的同类上下文，必须优先复用，不允许重复拉取同一份 evidence

### 原因

- 当前 tool loop 里相当一部分上下文其实是确定性可预判的，不需要先做一轮 diagnosis 才知道该读什么
- 如果这类上下文继续留在 diagnosis 之后，主链路时延会稳定多出一轮 LLM 调用，且 prompt 口径会继续在“主决策前证据包”和“tool 后补上下文”之间漂移
- 先把确定性 evidence 前置，才能把剩余的 `needs_tool=true` 收敛成少数真正动态的例外，而不是把整个 tool loop 当默认路径

### 影响

- runtime 后续默认按“预取 evidence -> main decision -> 少量动态 tool fallback -> writeback”继续收敛
- prompt、测试和文档要统一假设：`needs_tool=true` 不是入口模式的机械映射，而是 LLM 在已有主要证据后仍认为信息不足的显式判断
- 前后端联调时，不能再把 `material-import`、`coach-followup` 或 review 请求天然视为必须经过独立 tool round

## 2026-04-17 — 学习 agent 的智能目标对齐 coding agents 的 runtime 方法论，而不是开放域自治

### 决策

Xidea 的学习 agent 在智能目标上，默认对齐 `Codex / Claude Code` 这类 coding agent 的 runtime 方法论和领域内判断质量，但不对齐它们的开放域执行形态。
稳定约束为：

- 对齐显式状态、上下文预取、tool arbitration、结构化事件、状态回写和 guardrail correction 这些 runtime 能力
- 对齐“基于证据决定下一步动作”的判断质量，而不是只生成表面自然语言回复
- 不追求 coding agent 式的开放环境探索、长链任务分解、多步自主执行和通用任务代理能力
- 学习引擎仍然是垂直领域 agent：目标是“在学习编排领域达到接近成熟 coding agents 的 runtime 完整性”，而不是把产品做成另一个通用 agent 壳

### 原因

- Xidea 需要的是高质量学习编排判断，而不是开放域自动化
- 直接追 coding agent 的执行形态会把系统拖向过重的自治、权限和环境控制问题，偏离当前产品核心
- 但如果不借鉴这类 agent 的 runtime discipline，系统又会退化成“有 prompt 的规则引擎”或“会聊天的 tutor”

### 影响

- 后续学习引擎设计优先补齐 project context、tool 边界、结构化 event contract、suggestion contract 和 writeback，而不是优先增加更多花哨学习形式
- 前后端对 runtime 的评估标准要更多看“判断质量和状态一致性”，而不是看 agent 是否显得足够自主
- 设计讨论中如果出现“要不要做得像 Codex / Claude Code”，默认回答是：对齐 runtime 方法论，不对齐开放域自治

## 2026-04-17 — 前端不得补 learning-engine judgment 或脑补 backend contract

### 决策

`apps/web` 默认不再补 learning-engine 语义缺口。
稳定约束为：

- 前端不本地生成 pedagogical judgment、knowledge point create/archive suggestion、off-topic 判定、project learning profile 判断
- 前端不把 `diagnosis / plan / state-patch` 二次推导成正式的 activity contract、knowledge point suggestion 或其他 backend object
- 如果后端暂时缺结构化事件，前端允许显式降级展示，但不允许用 heuristic 默默补齐业务语义
- 所有这类临时降级都必须写进 `docs/status.md` 和 `docs/plan.md`，并带着明确的 backend follow-up

### 原因

- 一旦前端开始补 learning-engine judgment，系统很快会退化成“双轨真相”：agent 负责回复，前端负责真正决定业务语义
- 这会直接破坏 project context、guardrail、去重、writeback 和 typed event contract 的一致性
- 当前比赛版需要证明的是“系统在决定怎么学”，而不是“UI 在帮 agent 猜他本来应该说什么”

### 影响

- 当前前端已移除 project chat 本地知识点 suggestion heuristic
- 当前前端已移除根据 `diagnosis / plan` 合成 activity card 的过渡逻辑；后续 activity 以 backend 结构化事件为准
- 当前前端已移除根据 runtime 二次生成 project learning profile 摘要的逻辑；画像判断继续由 backend / agent 负责
- 后续 review 要把“是否在前端偷偷补 learning-engine judgment”作为显式检查项

## 2026-04-17 — `knowledge-point-suggestion` 作为独立 stream event，并配显式 confirm / dismiss API

### 决策

知识点建议的正式 contract 固定为：

- stream 使用独立 `knowledge-point-suggestion` 事件
- suggestion resolution 使用显式 confirm / dismiss API
- 不把 suggestion 塞进 `tool-result`、`state-patch` 或自由文本里

### 原因

- suggestion 本身是用户可操作的独立业务对象，不是普通调试性 payload
- 单独事件能让前端直接插卡、确认、忽略，不需要从别的事件里再猜
- confirm / dismiss 走显式 API 才能保证幂等、审计和后端持久化一致

### 影响

- `shared-boundary-freeze` 已冻结这条 contract
- `open-questions` 中关于 suggestion event 形状的未决项可以关闭
- 后续学习引擎实现默认按独立事件 + resolution API 推进

## 2026-04-17 — 知识点新增 / archive 建议必须由 agent judgment 输出，前端只负责渲染与确认

### 决策

`project chat` 中的知识点新增建议，以及后续同类 archive 建议，默认都由 agent 基于 project context 做判断并输出结构化结果。
稳定约束为：

- 前端不再作为这类建议的最终判断方
- 前端可以在 demo 过渡期保留本地 mock / heuristic，但不能把它当成长期 source of truth
- agent 需要在判断前读取 project memory、special rules、已有 knowledge points、selected materials 和 recent project session context
- 建议结果应通过结构化事件或同等级 typed payload 输出，而不是只混在自由文本里
- 用户确认新增 / 忽略 / 接受 archive 建议后，应通过显式 API contract 写回后端持久化对象

### 原因

- 只有 agent 才能稳定拿到 project 级上下文，前端本地规则无法可靠处理去重、主题相关性和 guardrail
- 如果建议逻辑留在前端，会形成“agent 负责回复、前端负责真正判断”的双轨系统，后续 contract 会持续漂移
- 这条能力本身就是“系统决定你现在应该沉淀什么知识点”的核心证明点，不应由 UI 层替代

### 影响

- 学习引擎后续要补 `KnowledgePointSuggestion` 或同等级 schema，并进入流式事件 contract
- repository 后续要补 project knowledge point pool、project memory / rules 等持久化对象，至少满足去重和确认写回
- 前端后续要把当前本地 heuristic 迁移为消费 agent suggestion 事件
- off-topic guardrail、知识点去重和 archive 建议规则要统一收敛到 agent / backend 边界

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
