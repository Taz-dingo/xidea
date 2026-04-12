# Decision Log

## 2026-04-13

### 决策

第一版采用“真实持久化状态 + 轻量数据库”的策略，优先把 `projects / threads / thread_messages / learner_unit_state / review_state` 跑成真实读写闭环。

### 原因

- 当前比赛版需要证明系统真的会读取状态、做判断、回写状态，而不只是消费静态 mock
- 数据状态是编排闭环的一部分，但第一版也不值得为此提前建完整数据平台
- 先把状态做真、把内容半真半假，可以在真实流程和实现成本之间取得更合适的平衡

### 影响

- 第一版推荐用 `SQLite` 加轻量 repository 层承接持久化
- `source_assets` 和 `learning_units` 仍可先使用 seed / fixture
- 后续后端实现优先围绕状态真源，而不是围绕内容 CMS 设计

## 2026-04-13

### 决策

第一版 `Review Engine` 采用轻量启发式规则，不实现完整 spaced repetition 算法，但必须作为独立能力层存在。

### 原因

- 科学复习系统在 Xidea 中是重要子能力，但不是当前比赛版的全部
- 当前阶段需要的是“能解释为什么现在该复习、为什么现在不该复习”的真实逻辑，而不是复杂算法表演
- 轻量启发式规则已经足够支撑 diagnosis、plan、review-context 和 state-patch

### 影响

- 第一版 review 主要围绕 `memoryStrength / lastReviewedAt / nextReviewAt / reviewCount / lapseCount`
- `understandingLevel` 和 `confusion` 会参与判断是否应该进入 review
- 完整 Anki / FSRS 级算法留到后续，不作为第一版前提

## 2026-04-13

### 决策

“比赛版主案例收敛”只作用于当前证明路径，不改变 Xidea 长期作为 AI 学习编排系统的产品边界。

### 原因

- 团队需要在比赛版上极度收敛，但又不能误伤长期愿景
- 如果不显式说明，后续协作中很容易把“当前只讲一个场景”误读成“产品以后只做这个场景”
- 把证明路径和长期边界拆开，有助于同时保持答辩锋利度和产品扩展性

### 影响

- 当前文档和 demo 默认围绕 RAG 主案例展开，但长期叙事仍保留多输入、多训练、多项目任务的扩展空间
- 新增比赛版相关收敛时，要明确标注它属于当前证明路径还是长期产品边界

## 2026-04-13

### 决策

当前比赛版 demo 锁定一个主案例：
AI 工程师围绕正在推进的项目学习 RAG 系统设计，用它来承载第一版“AI 学习编排系统”的叙事。

### 原因

- 现阶段最大的风险不是功能不够，而是主线过散
- RAG 系统设计既有真实项目上下文，也天然存在“没懂 / 混淆 / 需要应用”的多种学习状态
- 当前 web demo、学习主题和默认样例已经与这一主案例最接近，收敛成本最低

### 影响

- 比赛展示、文档和默认 demo 都优先围绕这一主案例组织
- 其他学科和输入形式保留为扩展方向，不再作为第一版主叙事的证明对象
- 后续如果增加第二案例，也只能作为辅助证明，不与主案例并列抢主线

## 2026-04-13

### 决策

Xidea 当前比赛版聚焦 `project-backed learning`，不把自己讲成面向所有场景的广义 AI tutor。

### 原因

- `project / thread` 是当前产品定义里最有辨识度的部分，必须被放到叙事中心
- 如果把产品讲成泛化学习助手，评委会自然拿它与 ChatGPT、Khanmigo 等即时 tutor 直接比较
- 真实项目学习更能体现持续上下文、状态回写和动作切换的必要性

### 影响

- 对外讲述时，默认强调“围绕真实项目持续学习”的任务，而不是泛化 all-in-one 学习平台
- 当前 demo 的价值判断标准变成：是否能说明为什么这个任务需要 orchestration，而不是一次性回答
- 没有项目目标、没有持续上下文的陪聊式学习，不作为第一版核心目标

## 2026-04-13

### 决策

第一版 demo 必须把编排过程做成可见证据链，至少展示：输入上下文、学习状态、动作理由、路径输出和状态回写。

### 原因

- “编排”天然抽象，只靠口头讲述不够有说服力
- 如果评委只能看到答案或训练结果，就会把产品误解成普通 AI tutor 或练习工具
- 可见证据链能把系统判断从概念层变成可检视的产品体验

### 影响

- web 侧后续优先把 diagnosis、plan 和 state-patch 渲染成默认可见内容
- agent 侧 explanation 要尽量结构化，不能只返回笼统结论
- 每次新增 demo surface 时，都要先检查这条证据链是否完整

## 2026-04-13

### 决策

第一版 `maybe_tool` 只允许 `asset-summary / unit-detail / thread-memory / review-context` 四类上下文补充型工具。

### 原因

- 当前阶段工具的作用是帮助 agent 补足上下文，而不是替代诊断和编排
- 如果过早引入开放式搜索、复杂 routing 或写操作工具，系统很容易偏离“受约束单 agent”的主线
- 这四类工具已经足够覆盖材料、学习单元、thread 连续性和 review 调度四个核心上下文来源

### 影响

- `maybe_tool` 第一版保持读取型、轻量型、结构化型
- 第一版不做真实多模态解析、开放式搜索、通用知识库检索和复杂工具链路
- 后续如果要增加新工具，必须先证明它服务于学习编排主线，而不是扩展能力表演

## 2026-04-13

### 决策

第一版 `state-patch` 收敛为 `learnerStatePatch / lastAction / reviewPatch` 三部分，只表达本轮增量变化。

### 原因

- 这套结构已经足够支撑“状态更新 + 动作记录 + review 调度变化”的最小闭环
- 全量状态回写会让第一版过早进入复杂同步问题
- 与当前 `LearnerState` 和 `Review Engine` 的边界相比，这种 patch 形式更清晰

### 影响

- `writeback` 节点后续优先围绕这三部分产出结果
- 前端展示和后端回写都以“本轮变化”而不是“全量状态”来理解返回值
- 第一版不在 `state-patch` 中承接复杂长期记忆对象

## 2026-04-13

### 决策

第一版 `plan` 采用轻量结构，包含 `headline / summary / selectedMode / expectedOutcome / steps`，并把步骤数限制在 `1` 到 `3` 步。

### 原因

- 比赛版 demo 需要让“系统如何安排学习路径”一眼可讲清楚
- 太轻的 plan 只会退化成一句推荐，太重的 plan 又会提前变成复杂 workflow 系统
- 当前 web demo 已经有 `StudyPlan / StudyPlanStep` 的基础表达，沿着这条线扩展最自然

### 影响

- `plan` 事件后续围绕这套字段收敛
- `selectedMode` 作为轮级主策略保留，`step.mode` 继续表达步骤级执行方式
- 第一版不引入 `priority`、`estimatedTime` 等复杂调度字段

## 2026-04-13

### 决策

第一版 `diagnosis` 采用增强版结构，包含 `recommendedAction / reason / confidence / focusUnitId / primaryIssue / needsTool`。

### 原因

- Xidea 需要展示的不只是“推荐做什么”，还要展示“当前到底卡在哪里”
- 只有 `recommendedAction` 会让诊断层过薄，难以体现系统的教学判断能力
- `primaryIssue`、`confidence` 和 `needsTool` 能更自然地衔接后续 `plan`、`maybe_tool` 和前端 explanation

### 影响

- `diagnosis` 事件和 `GraphState.diagnosis` 后续统一围绕这套字段收敛
- `reason` 保持短解释，避免和最终 assistant message 重复
- `primaryIssue` 第一版收敛为固定枚举，而不是开放文本

## 2026-04-13

### 决策

第一版 `GraphState` 保留最近少量消息历史、使用固定 `toolIntent` 枚举，并只允许 patch 形式的 `writeback`。

### 原因

- 最近少量消息历史能支持真实多轮对话，但不会把 thread 全量状态塞进 graph
- 固定 `toolIntent` 更适合比赛版 demo 的边界控制和联调
- patch-only `writeback` 能让状态变化更清晰，避免第一版过早演化成复杂记忆同步系统

### 影响

- `context.recentMessages` 默认只带最近 `3` 到 `8` 条消息
- `toolIntent` 第一版收敛为 `asset-summary / unit-detail / thread-memory / review-context`
- `writeback` 第一版只围绕 `learnerStatePatch / lastAction / reviewPatch` 设计

## 2026-04-13

### 决策

LangGraph 第一版采用 6 节点最小主链路：`load_context -> diagnose -> decide_action -> maybe_tool -> compose_response -> writeback`。

### 原因

- 当前阶段更重要的是把“系统如何先判断、再编排、再回写”讲清楚，而不是堆复杂 graph
- 这条链路正好覆盖读取上下文、做诊断、决定动作、必要时补工具、输出结果和状态回写
- 把 `diagnose` 与 `decide_action` 拆开，有助于在答辩和协作中清楚表达“判断”和“编排”的区别

### 影响

- `apps/agent` 后续优先围绕这 6 个节点定义最小 `GraphState`
- 第一版工具调用保持在 `maybe_tool` 节点内，不提前扩成复杂 tool routing
- 后续 schema、API contract 和前端展示都围绕这条主链路收敛

## 2026-04-13

### 决策

`apps/web` 与 `apps/agent` 的第一版返回协议采用事件流，统一发送 `text-delta / diagnosis / plan / state-patch / done` 五类事件。

### 原因

- Xidea 需要展示的不只是聊天文本，还包括系统判断、学习路径和状态变化
- 纯文本流不利于承载结构化编排结果，一次性 JSON 又不利于 demo 的流式体验
- 事件流能让 Vercel AI SDK 前端层与 Python LangGraph 后端层自然衔接

### 影响

- `apps/web` 后续按事件类型分别渲染聊天内容、诊断卡片、学习路径和状态变化
- `apps/agent` 需要把 LangGraph 输出包装成统一事件，而不是只返回最终文本
- 第一版先收敛事件种类，不提前设计复杂通用协议

## 2026-04-13

### 决策

前端交互层接入 Vercel AI SDK，但核心学习编排仍保持在 Python + LangChain + LangGraph。

### 原因

- 项目已经明确把受约束单 pedagogical agent 作为核心差异点，核心决策不适合在当前阶段迁到 TS
- Vercel AI SDK 很适合承接 chat state、流式输出、消息协议和工具结果展示，能增强 demo 的可讲性
- 把两者分层使用，可以同时保留 Python agent 生态优势和前端 AI 交互体验优势

### 影响

- `apps/web` 统一承担 interaction shell，优先负责消息流、对话体验和结果展示
- `apps/agent` 继续承担 orchestration brain，负责 state、action、tool、guardrail 和 LangGraph runtime
- 后续如果接入 AI Gateway，也作为独立网关层处理 provider 路由与观测，不替代主编排层

## 2026-04-13

### 决策

项目的分支命名与 PR 协作规范通过独立的 `branch-workflow` skill 暴露，而不是只散落在协作文档里。

### 原因

- “拉个分支”“这个分支名对吗”“准备提 PR” 这类请求经常直接进入执行，不会先人工翻协作文档
- 现有规则已经存在，但没有被 skill 显式接管时，agent 容易漏掉 `type/owner/topic` 这类项目约束
- 把分支协作独立成 skill，可以保持 `project-onboarding` 聚焦在上下文建立，不把它扩成大杂烩

### 影响

- 后续遇到分支创建、分支改名、分支命名检查、PR 范围整理时，优先触发 `branch-workflow`
- agent 在处理这类请求时，默认检查 `type/owner/topic`、短分支规则，以及是否需要同步更新 `decision-log`、`status`、`plan`
- 项目级 skills 列表从 5 个扩展为 6 个，并把分支协作作为显式入口能力

## 2026-04-10

### 决策

当前比赛 demo 的编排核心采用受约束的单 pedagogical agent，并在第一版就接入 LangChain / LangGraph 的最小 runtime。

### 原因

- 当前阶段更重要的是把“系统会决定你该怎么学”讲清楚
- 产品愿景更接近“agent 在约束下做教学决策”，而不是固定 workflow
- LangChain / LangGraph 生态值得尽早接入，便于团队边做边学习
- 复杂 graph、tool routing 和多节点 runtime 会提前引入工程噪声
- 团队现在更需要可讲、可演示、可协作的最小闭环

### 影响

- 当前主链路先收敛为“读取状态/上下文 -> agent 决策 -> 必要时调用工具 -> 生成学习动作 -> 回写”
- 第一版就定义清楚 agent 的 `state / action / tool / guardrail`，而不是把主逻辑写成固定 workflow
- LangGraph 先承载一个最小 graph，不急着堆叠多 agent 和复杂节点图
- 只有在多输入链路、多工具调用、中断恢复等需求明确后，再升级到更完整 graph

## 2026-04-10

### 决策

科学复习系统、agent memory 和定时整理系统是三层能力，不能混成同一层。

### 原因

- 科学复习服务学习者，本质是学习域模型与调度逻辑
- agent memory 服务系统本身，用于保存项目上下文、用户偏好和历史决策
- 定时整理系统负责压缩、强化和清理记忆，不直接替代前两者

### 影响

- 后续统一用 `Review Engine / Agent Memory / Consolidation` 三层来描述记忆相关能力
- 复习调度围绕 `learning item` 和掌握状态展开，而不是退化成固定卡片 UI
- agent 可以读取复习结果，但不把复习系统本身建模为 agent memory

## 2026-04-08

### 决策

当前阶段前端降级为最小表达，不追求复杂视觉和大范围功能展示。

### 原因

- 三人协作阶段，复杂 UI 会增加噪声
- 比赛当前更需要稳定表达核心差异点

### 影响

- 页面只保留阶段目标、输入样例、学习状态、路径输出、协作方式
- 后续新增页面前，先确认是否服务于比赛 story

## 2026-04-08

### 决策

统一把 Xidea 定义为 AI 学习编排系统，而不是某一种输入方式或某一种训练方式的产品。

### 原因

- 用户既可能通过材料导入进入系统，也可能通过普通问答进入系统
- 训练形式本身也是可切换的，不能把产品收窄成单一 mode
- 真正的核心差异点是系统在输入、诊断、训练之间做编排

### 影响

- 后续讨论产品时，统一从“输入形式 / 诊断方式 / 训练形式 / 编排逻辑 / 记忆回写”5 层来描述
- demo 可以展示多个能力，但都应服务于同一个编排主线

## 2026-04-08

### 决策

科学复习在 Xidea 中被定义为记忆调度层的子能力，而不是产品本体。

### 原因

- Anki 强在决定复习时机，但不负责决定当前最适合的学习动作
- Xidea 的差异点在于系统先判断用户是没懂、易混淆、需要练习，还是适合复习

### 影响

- 后续状态建模要同时包含理解状态和记忆状态
- 后续 demo 表达要避免把产品退化成“更强的卡片工具”

## 2026-04-08

### 决策

前端采用 TypeScript / React / Tailwind 的 UI 栈，核心编排采用 Python / LangChain / LangGraph 方向。

### 原因

- 前端需要高频快速迭代和更顺手的 UI 表达
- 编排核心优先选择更成熟的 Python agent 生态
- 两层边界清晰，便于后续通过 API contract 连接

### 影响

- repo 目录切换为 `apps/web` 和 `apps/agent`
- 后续需要补前后端 contract 和 graph node 设计
