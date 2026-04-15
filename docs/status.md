# Status

## As Of 2026-04-15

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
- 明确 web 与 agent 当前采用事件流协议，先收敛 `text-delta / diagnosis / plan / state-patch / done`
- 锁定当前比赛版主案例为"AI 工程师围绕真实项目学习 RAG 系统设计"
- 明确当前比赛叙事只服务于 project-backed learning，而不是泛化 all-in-one 学习平台
- 明确当前 demo 必须让编排过程可见：至少展示输入上下文、学习状态、动作理由、路径输出和状态回写
- 明确比赛版主案例只是证明路径，不改变长期产品的扩展方向
- 将 web demo 数据统一收敛到 RAG 主案例，不再并列展示跨学科样例
- 将主案例映射成更可信的状态来源、诊断信号和回写预览
- 将编排证据链做成默认可见输出，并把 planner explanation 结构化为主决策与写回预览
- 完成 web 前端首页重构，强化"项目线程 -> 诊断 -> 动作选择 -> 学习路径 -> 回写"的默认叙事结构
- 首页信息架构已进一步改成更克制的 codex-style workspace：左侧 `project / session` 侧栏，中间保留当前 thread 必要内容，右侧放学习画像、复习系统和项目特有 inspector
- 当前 workspace 的视觉规则已收敛为"轻选中态 + 中性色主导 + 侧栏单行排版"，不再使用大面积黑色 active 和多彩状态块
- `apps/web` 已接入真实 `/runs/v0` 结果，可用本地代理和运行面板把 mock 证据链切到 agent 返回的 `diagnosis / plan / state-patch`
- `apps/web` 已正式接入 `shadcn/ui` 基础组件，当前 workspace 的按钮、卡片、徽标、滚动区和输入区不再是纯手写 primitive
- `apps/web` 已正式接入 Vercel AI SDK 的 `useChat + custom transport`，中间 thread 区开始按消息流方式承接 `/runs/v0` 返回，而不是只靠本地面板状态拼接
- 为本地前后端联调补上 Vite `/agent-api` 代理与 agent CORS 默认配置
- 前端当前已收尾到可提 PR 状态：当前 workspace 支持 `project -> sessions` 导航、`新建 project / 新建 session`、project 展开收起、宽屏三栏稳定布局，以及 agent `500` 时的非崩溃错误态
- 当前架构讨论已收敛到可开工状态，并明确 SQLite 状态层与启发式 `Review Engine`
- 完善 `state.py` 数据模型：双轨 LearnerState + 6 个领域模型 + 2 个枚举
- 定义 agent tool schema：4 个最小必要工具 + mock 实现 + TOOL_REGISTRY
- 定义 agent guardrail schema：5 条行为约束规则 + 统一检查入口
- 搭建 LangGraph 最小编排图：5 个节点 + StateGraph + 规则 mock 实现
- 将 `learn-engine` 分支上的 agent contract 对齐到 `AgentRequest / diagnosis / plan / state-patch / StreamEvent`
- 在 `apps/agent` 补上当前 runtime、SQLite repository 与 FastAPI `/runs/v0` / `/schemas` / storage endpoints
- LangGraph 编排图已切到 `load_context -> diagnose -> decide_action -> maybe_tool -> compose_response -> writeback`
- `load_context` 已可读取 SQLite 中的 recent messages 与 prior learner state 作为本轮基线
- 为 runtime、graph、API、repository roundtrip 补上 10 个测试，当前全部通过
- 明确当前默认按学习引擎 / 前端 / 产品叙事三条主线并行推进，并要求每次新开工先完成 workstream routing
- 丰富 `maybe_tool` 的 4 个 tool intent：asset-summary / unit-detail / thread-memory / review-context 全部从 stub 升级为结构化上下文输出
- 独立化 `Review Engine`：从 runtime 内联逻辑拆为独立模块，实现 6 条启发式规则 + 间隔调度 + 回忆成功/失败处理
- `ReviewPatch` 和 `review_state` 表增加 `review_count / lapse_count`
- 新增 25 个测试（12 tools + 13 review engine），总计 35 个全部通过
- 将 `diagnose_state()` 从 if-elif 瀑布升级为综合 action scoring 评分模型
- `build_signals()` 支持多轮信号累积 + prior state 趋势检测
- `estimate_learner_state()` 改为 confidence 加权 delta + 动态 confidence
- 新增效果评估：检测上一轮动作是否改善对应指标，无效动作自动降权
- 新增 `POST /runs/v0/stream` SSE streaming endpoint，并已改成真实按步骤推送：diagnosis → text-delta → plan → state-patch → done，不再先完整执行再一次性返回
- 新增 19 个测试（15 决策路径 + 4 SSE），总计 54 个全部通过
- `apps/web` 请求已按当前 `project / session` 真实绑定到 agent `project_id / thread_id`，不同 session 不再共用后端线程状态
- `apps/web` 已切到真实 SSE 消费 `/runs/v0/stream`，thread 区改为跟随后端流式事件逐步渲染
- `apps/web` 已将中间学习线程里的编排证据收回，只保留右侧 inspector 作为状态与监控面板
- `apps/web` 的材料入口已收成单线程里的随时加材料 tray，用户不再需要在“问答 / 材料”之间切模式
- `apps/web` 中栏输入区已收成单一输入框 + 内嵌发送按钮，thread 与 inspector 滚动区默认显示可见滚动条
- `apps/web` 左栏已收敛为更紧凑的 codex-style workspace 导航：project 用图标行呈现，session 只保留标题级信息
- `apps/web` 的学习画像已改为根据当前对话与运行态自动生成，不再由用户手动切换
- `apps/web` 的复习系统已新增 GitHub-style 近 5 周复习热力图
- `apps/web` 主布局已收敛为基础态 + `lg` 两段响应式，不再继续细分更碎的宽度区间
- `apps/web` 的左栏 project 已改为文件夹开关图标，并为 session reveal 补上轻量展开收起动画
- `apps/web` 的 agent 输出已默认收成核心摘要，长解释与证据链需要显式展开，用户输入与系统输出的视觉层级已拉开
- `apps/web` 的右栏已重构为监控型高信息密度面板，当前聚焦 session、learner、review 和 materials 四组状态
- `apps/web` 中栏已进一步收敛到"只有用户输入保留卡片，系统输出与诊断改走无边框信息流"，同时空白 session 不再显示解释性提示文案
- `apps/web` 现已在页面加载时主动探测 agent `/health`，并会为已选 session 尝试回读持久化 learner state；顶部状态徽标不再把"未 hydrate 的前端 fallback"误显示成后端断连
- `apps/web` 已将学习画像从前端角色猜测收敛为基于真实 learner state / diagnosis 的动态画像摘要，不再把预设 demo profile 注入 agent prompt
- `apps/web` 已将复习热力图切到真实 review inspector 数据，热力图单元基于持久化 review event / scheduled review 渲染，而不再按当前 session 消息数脑补
- `apps/web` 已将材料面板切到真实 asset summary context，右栏默认显示后端返回的材料摘要、关键概念和 excerpt，而不是只靠 fixture 文案拼接
- `apps/web` 已补上 session 级 inspector bootstrap / thread context 读取，首屏 hydration 改为一次性拉取 `thread_context / learner_state / review_inspector`
- `apps/web` 的 entry mode 与 source asset 选择已改成按 session 维度维护，切换 session 时不会再串用上一个 thread 的材料选择
- `apps/agent` 已补充 `thread_context` / `review_events` 持久化，以及 `assets/summary`、`review-inspector`、`inspector-bootstrap` 读取接口，用于支撑前端 inspector 真状态
- 已补 `favicon` 与首屏 hydration 循环修正；浏览器验证下页面可正常加载、材料入口可展开、console 无业务错误
- 重新整理 `docs/` 结构：根目录保留 operating docs，流程文档下沉到 `docs/process/`，参考材料下沉到 `docs/reference/`
- 生成 `docs/reference/agent-state-design.md` 设计文档
- 将 `docs/memory/decision-log.md` 收敛为活跃决策薄层，历史条目归档到 `docs/archive/decision-log-history.md`
- 将路线图并入 `docs/plan.md`，不再单独维护 `reference/backlog.md`
- 将 demo 展示规则并入 `docs/reference/competition-defense-kit.md`
- 将科学复习相关产品表述收敛到 `docs/reference/product-brief.md`
- LLM 接入全链路改造（A/B/C 三层）：信号提取 + 诊断决策 + 路径规划 + 回复生成全部由 LLM 驱动
- 架构修正为 LLM-first：LLM 是核心 pedagogical agent，规则仅作为 guardrails；兼容的 LLM API key 是启动必须项
- Guardrails 从 advisory 升级为 blocking，违规时在 LLM 诊断上直接修正（不 fallback 到规则）
- 修复 review engine 的 `next_review_at` 传参问题，规则 4 恢复生效
- 状态数值边界保护：delta 衰减 + 同类信号重复衰减
- 新增 26 个 LLM + guardrail / provider 兼容测试，当前 agent 全量 97 个全部通过
- `build_llm_client()` 切到 OpenAI-compatible 兼容层，默认接智谱 `glm-5`，同时保留 OpenAI 旧环境变量兼容
- 智谱运行时默认关闭 `thinking`，结构化阶段启用更严格的 JSON 输出约束；LLM HTTP client 默认不继承代理环境变量，减少本地代理/证书链导致的空正文和 TLS 问题
- `/runs/v0/stream` 已切到真实流式执行：API 直接消费 runtime 事件生成器，连接建立后会立即打开 SSE；当前事件顺序仍为 `diagnosis -> text-delta -> plan -> state-patch -> done`
- agent 主路径已将 `signal extraction + diagnosis` 合并为一次 bundled LLM 调用；正常链路从 4 次模型请求降到 3 次，且 reply 已从 plan 依赖里拆开，首屏等待主要收敛在 `bundled diagnosis -> reply`
- 已确认当前 `3` 次串行 LLM 调用 + 展示型 `StudyPlan` 属于过渡实现；下一阶段将对齐成熟 agent 方案，收敛为“预取上下文 -> 单次主决策调用 -> tool / activity loop -> 状态回写”
- `apps/web` 中栏已新增 activity-first 学习动作卡：当前会优先把 agent `diagnosis / plan` 归一化成可执行动作，并支持在对话里直接完成辨析 / 回忆 / 导师追问后，把结果回传给现有 agent 对话流；学习动作卡已从固定底部区块收成跟随最后一条 agent 回复出现的 inline card
- 已补充共享约束：当前前端的 activity-first 卡片仍是过渡适配；长期形态应由 agent 在消息流中发出结构化 activity / tool result 事件，前端按事件插 card，而不是固定保留整段学习动作 / 路径 / 证据面板
- 已补充共享约束：当 activity 是当前必须完成的学习动作时，主输入区不应继续开放自由聊天；当前 web 已补上“完成当前动作 / 跳过当前动作”的 gating。tutor agent 的专门 system prompt 仍记录在后续实现项中
- `apps/web` 现已补充 dev-only tutor fixture 面板：可以本地切换“边界辨析 / 主动回忆 / 导师追问 / 提交报错 / 无卡片回复”等场景，用于打磨 activity 插卡、gating 和失败回滚，不依赖后端联调
- `apps/web` 用户侧已收掉中间学习线程里的编排证据区，但保留右侧 inspector 作为状态与监控面板；学习动作卡当前默认只保留题干、选项或输入框与提交 / 跳过
- `apps/web` 的选择题 activity card 已进一步收成“题干 + 选项 + 提交 / 跳过”，不再把 objective / support / evidence 这类内部编排字段直接展示给用户
- 已整理一版可借鉴的学习模式 feature 清单，当前优先参考 `ChatGPT Study Mode / Claude 教育场景 / Gemini 学习工具` 的轻交互能力：quiz、flashcards、study guide、hint、more questions、作答后短反馈
- 已澄清：`flashcards`、quiz、study guide、guided QA 都只是候选学习形式，不是产品目标本身；长期主线仍是“多模态输入 + 多类型学习 + 类 Anki 的 SRS 复习系统”
- `apps/web` 已将“问答 / 材料”互斥入口收敛为单线程里的随时加材料 tray；当前材料以附加上下文方式挂进这一轮，不再要求用户先切模式
- `apps/web` 已补多张 learning activity 的 deck 视觉和 dev fixture；当前可以本地预览一组连续小卡叠放在最后一条 agent 回复后，并按顺序一张张翻下去
- 已确认下一步学习体验增强优先项之一是 Duolingo 风格的答对 / 答错 / 跳过 / 翻卡音效与动效，先记入 backlog，后续再实现
- 已确认前端新增学习交互需要同步反推后端 tutor prompt 和 event contract；否则只会出现 UI 有壳、agent 不会稳定配合的落差
- 已将这轮前端交互对后端的具体支撑要求补进 reference：包括随时加材料、card deck、作答 verdict / 短反馈、以及 tutor prompt 的回合节奏要求

### In Progress

- 收敛学习引擎下一步运行形态：让学习资料、thread memory、learner state、review context 在主决策前完成预取，并进入同一证据上下文
- 将展示型 `StudyPlan` 收敛为可执行 learning activity contract，支持 agent 在对话里直接触发出题 / 复习 / 导师追问
- 收敛 web-agent contract：从当前 `diagnosis / plan` 过渡适配切到结构化 activity / tool result 事件
- 收敛前端 activity gating：当前学习动作未完成前，主输入区改成受约束交互
- 收敛用户侧 activity 节奏：让“作答完成 -> 下一轮简短诊断 / 动作反馈”更自然，避免重新把内部证据摊回中间学习线程
- 规划并后续实现学习模式借鉴项：`hint / more questions / performance feedback / 材料直出 quiz 或 study guide`
- 将“thread-level material library + turn-level attachments”收成稳定 contract，替换当前前端先行适配的数据壳
- 将多 activity / card deck 从前端 fixture 和过渡归一化推进到真实后端事件
- 将前端已出现的学习交互件整理成后端 prompt / contract 需求清单，供学习引擎 owner 对齐实现
- 收敛 tutor system prompt：明确何时发起 activity、何时只给短引导、何时禁止继续自由讲解
- 收敛当前 `Consolidation` 的演示路径，决定是手动触发还是模拟定时入口

### Next

- 压缩主链路 LLM 调用次数，取消 `diagnosis -> reply -> plan` 这种独立串行文本调用，改成单次主决策 turn + loop
- 打通 `exercise-result / review-result` 回传与状态回写闭环，让练习结果和复习表现真正影响下一轮诊断
- 决定当前 `Consolidation` 是先做手动触发演示，还是带模拟定时入口的可视化 demo
- 决定主案例稳定后优先补哪个次级 demo surface：继续放大“材料导入”，还是转向“导师对练”
- 补答辩素材与竞品对比摘要，避免 demo 能演示但叙事支撑不足
- 可选：用真实 API key 做端到端测试，迭代 LLM prompt 效果
- 可选：清理 `enrich_plan_steps`（已被 `llm_build_plan` 替代）

### Risks

- 如果过早引入复杂 graph 或多 agent，当前 demo 容易被工程结构拖慢
- 如果 demo 展示很多能力但没有主线，差异点会不明显
- 如果主案例虽然锁定，但状态来源和动作理由不够可信，评委仍会把它看成概念样机
- 如果继续沿用“展示型 plan + 串行文本调用”，agent 会更像会解释的脚本，而不是会安排真实学习动作的系统
