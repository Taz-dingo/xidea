# Decision Log

只保留“当前仍生效、后续会反复影响协作或实现”的活跃决策。
更早期、已实现、已替代或过细的历史记录见 [docs/archive/decision-log-history.md](../archive/decision-log-history.md)。

## 2026-04-15 — 用户侧不直接暴露中间编排证据，学习动作优先保持轻交互

### 决策

比赛版用户侧默认不在中间学习线程里展示内部编排证据、诊断信号或 writeback 预览。
用户主要看到的是当前对话、学习动作卡和动作完成后的下一轮反馈。
学习卡默认优先保持轻交互：选择题只展示题干和选项，不把 objective / support / evidence 这类内部字段直接暴露给用户。
右侧 inspector 继续保留，作为状态与监控视角，不和中间学习动作卡混在一起。

### 原因

- 用户侧体验的核心是“系统决定你接下来怎么学”，不是“系统把内部推理过程完整摊给你看”
- 中间学习线程如果同时塞进编排证据和解释字段，会削弱“先做动作、再给反馈”的学习节奏
- 右侧 inspector 和中间学习动作承担的角色不同，不需要一起删掉
- 当前阶段更需要让一轮学习动作顺滑闭环：出题、作答、收到下一轮判断，而不是增加信息密度

### 影响

- 前端默认收掉中间学习线程里的编排证据区
- 右侧 inspector 保留，用于状态和监控信息承载
- dev-only fixture 或其他内部调试入口可以保留，但不作为学习卡 contract
- activity card 的默认内容收敛到题干、选项或输入框、提交 / 跳过动作
- 用户完成 activity 后，再通过 agent 下一轮回复给出简短诊断或后续动作，而不是在卡内同时展示大量内部解释
- 后续 tutor prompt 和 event schema 需要配合这条体验约束，避免再次把内部字段直接推到用户面

## 2026-04-15 — 闪卡不是产品目标本身，目标是多模态输入、多类型学习和 SRS 复习系统

### 决策

`flashcards`、quiz、recall card、guided QA 这些都只是 Xidea 可选的学习形式，不是产品本体，也不是每一轮都必须出现。
Xidea 的长期目标仍然是三件事同时成立：

- 支持多模态输入，把材料、问题和项目上下文统一接到同一学习线程
- 支持多类型学习动作，由 agent 判断当前更适合哪一种训练形式
- 具备类似 Anki 的科学复习系统，用独立的 SRS / Review Engine 决定何时回顾、回顾什么

比赛版当前只是先用轻量文本材料和少量学习动作，把这三件事的基本关系讲清楚。

### 原因

- 如果把闪卡或 card deck 写成目标本身，产品会被误解成另一种练习卡工具
- Xidea 的核心差异一直是“系统决定你该怎么学”，不是“固定给你一种学习形式”
- 科学复习系统是长期能力层，不能因为当前 demo 先做轻量交互，就被降格成可有可无的附属功能

### 影响

- 文档里涉及 `flashcards`、card deck、quiz 的描述，默认都应写成“候选学习形式”或“可触发动作”，而不是产品目标
- spec 需要同时表达长期目标与当前比赛版范围：长期要走向多模态输入、多类型学习、SRS；当前比赛版仍只做最小可讲清的子集
- 后续前端和 agent 的实现，不应预设每轮都有卡片；是否出现哪种学习形式，取决于 agent 判断
- `Review Engine` / `SRS` 在产品叙事里保持一等能力层，不与单轮 tutor 交互混为一体

## 2026-04-15 — 学习模式优先借鉴 GPT / Claude / Gemini 的轻交互能力

### 决策

后续学习模式优先借鉴成熟产品里已经验证过的轻交互能力，而不是继续堆展示型解释。
当前优先记录并后续实现的 feature 包括：

- 基于当前材料或上下文直接生成 quiz / flashcards / study guide
- 一轮只推进一个学习动作，先做题或回忆，再给短反馈
- `hint / skip / more questions` 这类轻控制，而不是一次摊开完整讲解
- 作答后给简短诊断或 performance feedback，再决定下一轮动作
- 基于上传材料、线程上下文和最近表现自适应地调整题目难度与追问方式

### 原因

- `ChatGPT Study Mode` 已验证“互动提问 + 检查理解 + 分步推进”比直接长解释更适合学习场景
- `Claude` 在教育场景里的定位更偏 guided discovery / thinking partner，适合借鉴其“先追问、少代答”的节奏
- `Gemini` 已经把 quiz、flashcards、study guide、hint、performance analysis 这些学习件产品化，适合作为比赛版 demo 的直接参考

### 影响

- 后续 tutor prompt、activity schema 和前端学习卡都优先围绕这些轻交互能力扩展
- 计划优先实现 `hint`、`more questions`、作答后短诊断，再考虑更重的解释层
- “把材料变成训练动作”会比“把材料变成长篇摘要”有更高优先级

## 2026-04-15 — 材料不是单独入口模式，而是线程里的随时附加上下文

### 决策

比赛版不再把“问答 / 材料”作为互斥入口模式来设计。
用户默认始终在同一个学习线程里推进，需要时随时把材料挂进当前线程或当前轮次。
材料数据默认不做纯扁平字符串拼接，而是至少保持两层：

- thread-level material library：这个线程已挂过哪些材料
- turn-level attachments：这一轮实际带给 agent 的材料子集

在需要总结时，再从结构化材料集合里派生出 summary / key concepts / evidence，而不是把原始材料先整体压平成一段大文本。

### 原因

- 用户学习过程中会在“继续追问”和“补充材料”之间来回切换，互斥模式会打断节奏
- 纯扁平化会丢掉材料边界、来源和选择关系，不利于 agent 判断“这一轮到底参考了什么”
- 比赛版更需要表现“系统会把材料作为编排输入”，而不是让用户先决定自己现在处于哪种模式

### 影响

- 前端主线程默认只保留一个 composer，材料改成可随时展开、选择、挂载的附加上下文 tray
- contract 后续需要明确区分 thread-level 挂载材料与 turn-level 附件
- source asset summary、evidence bundle、activity 生成都基于结构化材料集合派生，不直接依赖单段扁平文本

## 2026-04-15 — 学习动作允许一轮形成轻量卡组，但交互仍按顺序推进

### 决策

学习动作不限制为“每轮只能有一张卡”。
系统可以针对同一轮目标下发一个轻量 card deck，例如“先辨析 -> 再回忆 -> 再导师追问”。
但交互仍按顺序推进：用户一次只需要完成最上面这一张，完成或跳过后再翻到下一张。

### 原因

- 单卡足够轻，但有时不足以表现一个完整学习回合
- 像 Gemini 这样的学习产品已经验证“一组连续小卡”是可理解的，只要不要同时把所有解释摊开
- 卡组比长篇 plan 更适合表达“系统接下来打算怎么带你学”，同时保持用户负担可控

### 影响

- 前端允许把多张 activity 以同一卡组视觉堆叠在最后一条 agent 回复后
- 默认只激活最上面一张卡，下面卡只作为后续预告，不提前开放交互
- 后续 event schema 需要支持一次返回多张 activity，而不是只保留单 activity 单例

## 2026-04-15 — 学习反馈优先增强体感，但不暴露内部复杂度

### 决策

比赛版学习体验后续优先补“答对 / 答错 / 跳过 / 进入下一张卡”这些高反馈密度的轻交互效果，重点参考 Duolingo 的做法：

- 轻量音效
- 明确的对错状态动画
- 完成当前卡后的过渡反馈

这类反馈直接服务于“学起来有感”，优先级高于继续增加内部解释信息。

### 原因

- 当前学习卡已经有了基本结构，但体感还偏“原型工具”，不够像真正的学习产品
- 多邻国这类产品已经验证：短促明确的感官反馈能显著增强完成动作的意愿
- 比赛演示里，学习动作是否“有反馈、有节奏”会直接影响体验说服力

### 影响

- 前端后续优先补正确 / 错误 / 跳过 / 翻下一张卡的音效与动画
- 这些反馈默认围绕学习动作结果展开，不额外暴露更多内部 reasoning
- 后续如果引入 performance feedback，优先采用短反馈而不是长解释

## 2026-04-15 — 前端学习交互需要反推后端 prompt 与 contract

### 决策

前端新增的学习交互不是单边 UI 决定。
凡是会影响 agent 节奏的交互能力，例如：

- 随时加材料
- 多张 activity card deck
- `hint / more questions`
- 作答后的短诊断
- 对错反馈后的下一步动作

都需要同步反推后端 event contract 与 tutor prompt 约束，确保 agent 真能稳定支持这些交互。

### 原因

- 如果前端先做出能力，但后端 prompt 和 contract 没跟上，最终只会出现“UI 有壳、agent 不会用”的落差
- 学习产品里的交互节奏高度依赖 tutor prompt 对回合目标的理解
- 当前阶段最容易出问题的不是 UI 组件，而是前后端对“这一轮到底该发生什么”的理解不一致

### 影响

- 前端每新增一个学习交互能力，都要同步补对应的后端 prompt / contract 待办
- 学习引擎 owner 后续实现时，需要把前端已存在的交互件当成 prompt 需求来源，而不是只看当前后端结构
- `status / plan` 需要持续记录哪些前端交互已经出现、哪些还只是过渡壳子

## 2026-04-15 — 通用工程 skill 优先使用外部来源，项目内只保留 Xidea 特有 skill

### 决策

项目默认不再自己维护通用工程类 skill 的内容版本。
像前端设计、React / TypeScript、Python、agent、LangGraph、LangChain 这类通用技能，优先使用外部来源并 vendored 到 repo；
项目内只保留 Xidea 特有的 skill，例如 onboarding、docs governance、branch workflow、PR 协作。

### 原因

- 通用工程 skill 更适合复用社区或官方持续维护的内容，而不是在项目里重复养一套私有版本
- 项目自写的通用 skill 容易随时间失真，也会让“项目特有规则”和“通用工程常识”混在一起
- Xidea 当前更需要维护的是项目上下文和协作约束，不是重新发明 React / TypeScript / LangGraph 的最佳实践

### 影响

- repo 下的通用工程 skill 改为 vendored 外部 skill
- 前端相关默认优先使用 `vercel-react-best-practices`
- AGENTS.md 默认指向这些外部 skill 名称，而不是旧的项目私有通用 skill
- 项目内 skill 后续重点只放在 Xidea 特有规则与协作流程

## 2026-04-15 — 文档默认用“当前 / 下一步”表达，不混用阶段版本号

### 决策

项目文档默认用“当前实现是什么”和“下一步要做什么”来表达方向，不再混用 `v0`、`v1`、`vNext` 这类阶段版本号，除非它们本身就是代码、接口或命令名的一部分。

### 原因

- 文档同时混用“当前 / 下一步”和阶段版本号时，容易让同一件事出现两套命名
- 阶段标签经常会从历史实现残留到未来方向，增加理解成本
- 当前项目更需要稳定表达 source of truth，而不是维护一套随时间漂移的版本叙事

### 影响

- `status / plan / reference / skills` 默认按“现在 / 接下来”组织，而不是按 `v0 / v1`
- 保留 `/runs/v0`、`run_agent_v0()` 这类真实接口或代码标识，不做文案式改名
- 后续清理文档时，优先把阶段标签改成当前状态或后续目标

## 2026-04-15 — 对齐成熟 agent loop，当前 3-call 路径降为过渡实现

### 决策

比赛版下一轮学习引擎对齐成熟单 agent + tools 方案：
一次用户 run 以单个主决策回合为中心，允许在同一 run 内进行多次 tool / activity 循环；
不再把 `diagnosis -> reply -> plan` 作为长期稳定主路径。
`StudyPlan` 后续只作为可选解释层或 activity 摘要，不再要求独立 LLM 调用生成展示型路径。

### 原因

- 成熟 agent 对外通常表现为一轮 run，内部通过模型与工具循环完成 gather context -> act -> observe -> continue，而不是把诊断、回复、计划拆成多个容易漂移的串行文本调用
- 当前实现里 tool context 在诊断之后才加载，且 tool payload 没有真正进入核心决策 prompt，导致资料、thread memory、review state 虽然被读取，但没有充分参与判断
- 展示型 `StudyPlan` 不能直接触发出题、追问、复习等教学动作，和 Xidea 需要证明“系统真的决定你接下来怎么学”的比赛目标不符

### 影响

- runtime 优先收敛为 `load_context / prepare_evidence -> agent_turn -> tool_or_activity -> agent_turn(loop) -> writeback`
- 学习资料、thread memory、learner state、review context 需要在主决策前预取，并作为同一证据包进入主决策 prompt
- agent 需要能在对话内直接触发练习 / 复习 activity；`exercise-result / review-result` 成为后续状态更新输入
- 对话内 learning activity 应以结构化 event 或 tool / activity result 的形式进入消息流，由前端按事件插入一张或多张 card；不再把“学习动作 / 路径 / 证据”固化成固定面板
- 当一张 activity card 代表当前必须完成的学习动作时，主输入区默认不继续开放自由聊天；前端应切到“完成当前动作 / 跳过当前动作”的受约束交互，而不是允许用户直接开始下一轮普通对话
- `plan` 如果保留，默认只是 activity 的解释字段或摘要；不能要求前端总是单独渲染一整段 `plan` 区域
- 当前前端把 `diagnosis / plan` 归一化成 activity card 的做法只用于过渡联调，不代表长期 contract
- agent 需要专门的 tutor-oriented system prompt：核心任务是决定并主持学习回合，而不是像普通聊天助手那样优先给完整答案；高混淆、记忆走弱、迁移验证等场景下，应优先触发 activity 或 tool，而不是继续长篇解释
- 当前 2026-04-14 的“3 次模型调用”和“reply 优先、plan 后置”记录只代表过渡实现，不是下一阶段目标形态

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

当前继续采用“受约束单 pedagogical agent + Python / LangChain / LangGraph”作为编排核心；`apps/web` 是 interaction shell，`apps/agent` 是 orchestration brain。

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
