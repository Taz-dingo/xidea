# Plan

## Current Sprint

### Current Parallel Split

当前前端默认先不作为并行主线。
本轮两人拆分先集中在 `apps/agent`，目标是先把 backend contract / storage 与 agent runtime / writeback 分开推进，减少共享热点文件冲突。

#### Backend owner

- 主目录：`apps/agent/src/xidea_agent`
- 主文件：`state.py`、`repository.py`、`api.py`
- 本轮 checklist：
  - [ ] 收敛对外 request / response / stream schema，统一向 `Project / Session / KnowledgePoint` 命名靠拢
  - [ ] 扩 `projects` 持久化字段，补齐 `title / description / special_rules`
  - [ ] 补 `project_materials / session_attachments` 的表结构、repository 方法和最小读取接口
  - [ ] 收敛 `project / study / review` 三类 session 的基础字段与创建 contract
  - [ ] 补 Project 创建 / bootstrap 最小链路：topic、description、materials、special rules、初始 memory、learning profile、knowledge points、project session

#### Agent owner

- 主目录：`apps/agent/src/xidea_agent`
- 主文件：`runtime.py`、`llm.py`、`tools.py`、`activity_results.py`、`review_engine.py`、`knowledge_points.py`
- 本轮 checklist：
  - [ ] 继续把主链路收敛到“预取证据上下文 -> 单次主决策 -> 少量动态 tool loop -> writeback”
  - [ ] 将 `project / study / review` 三类 session 的行为差异落实到 runtime / prompt / activity 决策
    - 当前进展：`AgentRequest` 已显式带 `session_type`，`project session` 不再默认塞 fallback `target_unit_id`
    - 当前进展：`project session` 才会产出 knowledge point suggestion，且不再直接下发 learning activity；`review session` 会优先保持回忆校准语义
  - [ ] 收敛知识点生命周期：bootstrap、project chat create suggestion、archive suggestion、confirm 后状态变化
  - [ ] 将 project materials、project memory、learning profile、review context 进一步收口为同一主决策证据包
  - [ ] 定出当前 `Consolidation` 的最小演示路径，优先手动触发

#### Shared Hotspots

- `state.py` 是当前并行热点文件，由 backend owner 主改；agent owner 如需加字段，先对齐字段清单再合入
- `docs/process/shared-boundary-freeze.md` 是共享 contract source of truth；先改文档，再改实现
- 前端后续只消费稳定 contract，不反向定义 backend / agent 语义

#### Suggested Sequence

1. backend owner 先落 schema / repository / API 基础层
2. agent owner 基于稳定 schema 并行推进 runtime / prompt / writeback
3. 两块合流后，再由前端切 `typed activity_result`

### P0

- [x] 锁定比赛主案例和讲述顺序
  - owner: 产品 owner
- [x] 稳定单 pedagogical agent 的输入输出结构
  - owner: 学习引擎 owner
- [x] 划清 `Review Engine / Agent Memory / Consolidation` 的边界
  - owner: 学习引擎 owner
- [x] 定义 agent 的 state / action / tool / guardrail schema
  - owner: 学习引擎 owner
- [x] 搭出 LangGraph 最小 graph 骨架
  - owner: 学习引擎 owner
- [x] 保持 web demo 简洁可演示
  - owner: 前端 owner
- [x] 完成编排证据展示探索，并收敛为“中间线程不直出、右侧 inspector 承载”
  - owner: 前端 owner / 学习引擎 owner
- [x] 只保留 2 到 3 个最能证明主案例的训练动作
  - owner: 产品 owner / 学习引擎 owner
- [x] 建立可复用的项目接手和协作规则
  - owner: 全员
- [x] 定义 web 与 agent 之间的最小 API contract
  - owner: 学习引擎 owner / 前端 owner
- [x] 收敛新的 project-centric MVP：Project、Knowledge Point、Session、Learning Profile 四个主对象
  - owner: 产品 owner / 前端 owner / 学习引擎 owner
- [x] 收敛 Project Workspace 的页面主结构：默认知识点工作台、按需展开 session workspace、知识点详情独立跳转
  - owner: 产品 owner / 前端 owner

### P1

- [ ] 将 agent 主路径收敛为“预取 project 证据上下文 -> 单次主决策调用 -> tool / session loop -> 状态回写”，优先解决当前回复过慢的问题
  - owner: 学习引擎 owner
  - 原因：
    - 当前实现仍存在串行 LLM 调用，首轮回复等待偏长
    - 这不仅是架构收敛问题，也是当前 demo 交互时延问题
  - 当前进展：
    - 已将 `signal extraction + diagnosis` bundling 为 1 次调用
    - 已将 `reply + plan` bundling 为 1 次调用；sync 与 stream 目前都收敛到 2 次主模型调用
    - 已补 `main_decision` 单次主决策调用：当 `diagnosis.needs_tool=false` 时，sync / stream 会在同一次主调用里同时拿到 `signals + diagnosis + reply + plan`
    - 已把可预判的 tool context 前置到主决策前：`material-import -> asset-summary`、`coach-followup -> thread-memory`、`review -> review-context`、带 `target_unit_id` 的常规问答 -> `unit-detail`
    - 已补 typed `status` stream 事件，首个可消费事件不再等到 diagnosis；前端可在主调用未返回时先展示阶段反馈
    - 已把 stream 端点的 reply 路径切到真实 `stream_assistant_reply`，不再把 bundled reply 在服务端切块伪装成流式
    - 已压缩 observation 摘要长度，减少结构化主调用里的无效 prompt 膨胀
    - 已把非 project session 的材料上下文预取收掉，避免 study / review 被 thread context 里的旧材料拖慢或污染
    - 已补 `project session` 的 low-info 快路径：`hi / hello / 在吗 / 继续` 这类 turn 会直接短路成 project-chat 澄清，不再白跑 LLM 诊断
    - 已补 `study / review session` 的 capability / meta guard：`你可以做什么 / 你能怎么帮我` 这类 turn 会先返回 session 能力说明，不再误触学习卡或复习卡
    - 已把 prompt 结构升级成“共享 base prompt + `project / study / review` 分轨 session prompt”，并继续保留 runtime guard；`project session` 也已加 pedagogical reply 过滤和 template fallback，避免文本语义漂回“先做题 / 先回忆”
    - 已把 `project session` 的默认语义进一步收成“学习方向 / 主题讨论 / 材料线索 / 知识点更新”四类推进目标，避免 prompt 和 runtime fallback 再退回空泛的 project 管理对话
    - 已修正 reply 生成链路里的 `user_msg` 传递错误：当前使用真实 `message.content`，不再把整个 `Message` 对象字符串塞进 prompt
    - 已把 study / review 的 activity fallback 文案改得更贴当前知识点和主题，不再继续问“为什么系统这样安排你”这类自指问题
    - 已把 choice activity contract 扩成 `is_correct / feedback_layers / analysis`，前端据此本地执行“错了继续、对了再过”的即时反馈；整组卡完成后仍统一回传一次 `activity_result`
    - 已把 completed deck history 收进前端 runtime store 和右侧 inspector，当前可回看每张卡的尝试轨迹与错误分析
    - 当前剩余缺口集中在 LLM 仍主动返回 `needs_tool=true` 的少数场景：这些路径现在会优先复用预取上下文，但整体仍是 `main_decision -> tool/session loop -> bundled response`
- [ ] 定义 Project 创建流程 schema：topic、description、initial materials、special rules、bootstrap output
  - owner: 学习引擎 owner / 产品 owner
- [ ] 定义 Project 最小持久化对象：project memory、learning profile、knowledge points、sessions
  - owner: 学习引擎 owner
- [ ] 定义 Knowledge Point 最小 schema 与生命周期
  - owner: 学习引擎 owner / 前端 owner
  - 范围：
    - 标题、描述、来源材料、origin session
    - 掌握度、学习/复习状态、下次复习信号
    - archive 建议与确认
- [x] 定义 knowledge point suggestion contract：由 agent 在 project chat 中输出结构化新增 / archive 建议，前端只负责渲染与确认
  - owner: 学习引擎 owner / 前端 owner
  - 范围：
    - project context 预取边界：project memory、special rules、已有 knowledge points、selected materials、recent session context
    - `knowledge-point-suggestion` 的 payload、去重和 off-topic 边界
    - 用户确认新增 / 忽略 / 接受 archive 建议时的 API contract
  - 参考：`docs/reference/learning-engine-backend-integration.md`
- [x] 定义 project-level learning profile 最小 schema，并接入后续编排上下文
  - owner: 学习引擎 owner
  - 范围：
    - 当前阶段
    - 主要薄弱点
    - 轻量学习偏好
    - 新鲜度 / 最近更新时间
- [x] 让学习资料、project memory、learning profile、review context 在主决策前完成预取，并进入同一证据上下文
  - owner: 学习引擎 owner
  - [ ] 定义 `project / study / review` 三类 session 的职责与状态转换
  - owner: 产品 owner / 学习引擎 owner / 前端 owner
  - 当前进展：
    - request contract 已显式带 `session_type`
    - `project session` / `review session` 的最小运行时差异已开始落到 agent
    - `project session` 已不再发题，且前端只在 project session 暴露材料入口 / project inspector
    - `project session` 的低信息 turn 已不再误触学习回复；下一步重点转到更细的 project-chat judgment 质量和 `needs_tool=true` 残留路径
    - study / review session 已切到整组 `activities[]` 卡组，并在本地做完整组后再统一进入下一轮 agent loop
    - 剩余缺口主要在 session create/bootstrap contract、持久化字段和更完整的状态转换
- [x] 将 Project Workspace 改成默认知识点工作台，只有进入 session 时才展开 session workspace
  - owner: 前端 owner
  - 参考：`docs/reference/project-workspace-ui.md`
- [x] 将 knowledge point 详情做成独立页面，并承载来源材料、相关 sessions、热力图和编辑入口
  - owner: 前端 owner
  - 参考：`docs/reference/project-workspace-ui.md`
- [ ] 收敛 project chat 行为：默认继续当前会话，支持手动新建 `project session`，不自动切分
  - owner: 前端 owner / 学习引擎 owner
- [ ] 支持 project chat 中的新增材料、知识点建议新增、知识点轻量编辑、topic/rules 修改入口
  - owner: 前端 owner / 学习引擎 owner
  - 说明：
    - 前端入口可先完成，但知识点建议新增的最终判断权归 agent；当前前端本地启发式已移除，等待 backend suggestion 事件
  - 当前进展：
    - backend 已补 `project_materials` 持久化与 `list / upload` API
    - frontend 已在 `Edit Project Meta` 和 `project session` 材料 tray 接入真实本地文件上传；上传结果会回流到当前 project materials，并可直接附着到当前 `project session`
    - 当前剩余缺口是“创建 Project 时直接上传本地文件”这条创建流；第一版仍沿用 demo seed 材料选择
- [x] 将学习 / 复习 session 第一版限制为选择题，不先接入简答题与开放式对练
  - owner: 产品 owner / 前端 owner / 学习引擎 owner
- [ ] 打通 `exercise-result / review-result` 的回传与状态回写闭环，让学习/复习结果真正影响知识点状态与 project learning profile
  - owner: 学习引擎 owner / 前端 owner
  - 当前进展：
    - backend typed contract、repository writeback、project-level preload 已完成
    - frontend 已将整组 activity 完成结果作为 typed `activity_result` 随下一轮请求回传
    - 当前剩余缺口是把多张 card 的表现进一步拆成更细粒度的 backend writeback，而不是只做整组聚合结果
- [x] 明确 project 不相关内容的 guardrail：主动提醒，但不更新 memory、不新增知识点、不触发学习/复习编排
  - owner: 学习引擎 owner
- [x] 定义 knowledge point archive 建议规则：多次复习稳定后由系统建议，用户确认执行
  - owner: 学习引擎 owner / 产品 owner
- [ ] 决定当前 `Consolidation` 是手动触发演示还是模拟定时入口
  - owner: 学习引擎 owner / 产品 owner
- [ ] 准备答辩素材和对比竞品摘要
  - owner: 产品 owner
- [x] 整理 `docs/memory/decision-log.md` 与文档分层，控制长期记忆体积
  - owner: 全员

## Roadmap Horizons

### V1

- [x] 接真实模型 API（已默认接到智谱 OpenAI-compatible / `glm-5`，保留 OpenAI 兼容）
- 增加上传材料入口
- 增加更可信的内容摘要或结构化提炼结果
- 将 project memory、learning profile、knowledge point pool 做成稳定持久化对象
- 将展示型 plan 收敛为 session 内可执行 activity，并支持学习 / 复习结果回写
- 增加 1 到 2 个次级 demo surface
- 增加 evaluation 和答辩支撑材料

### Later Horizon

- 增强 `Review Engine`
- 引入真正的 spaced repetition 调度算法
- 优先考虑 `FSRS` 或同等级现代 SRS 方案，而不是只停留在启发式规则
- 增强 `Agent Memory / Consolidation`
- 增加更多输入模态与更多学科模板
- 逐步把比赛版叙事推进到“多模态输入 + 多类型学习 + SRS”完整主线
- 在主案例稳定后，再决定是否补更强的 web search 辅助找资料能力

## Implementation Checklist

当前已经可以进入实现阶段。建议按以下顺序落地：

1. `apps/agent` 定义 typed schema
   - `Project`
   - `Session`
   - `KnowledgePoint`
   - `KnowledgePointSuggestion`
   - `ProjectLearningProfile`
   - `Activity`
   - `StatePatch`
2. `apps/agent` 搭 SQLite 与 repository 骨架
   - `projects`
   - `sessions`
   - `session_messages`
   - `knowledge_points`
   - `project_learning_profiles`
   - `project_memories`
   - `review_state`
3. `apps/agent` 搭 LangGraph 最小主链路
   - `load_project_context`
   - `resolve_session_intent`
   - `maybe_tool`
   - `compose_session_output`
   - `writeback`
4. `apps/agent` 实现 `Review Engine`
   - 基于启发式规则更新 `memoryStrength / nextReviewAt`
   - 不实现完整 SRS / FSRS 算法
5. `apps/agent` 暴露 FastAPI streaming endpoint
  - 过渡态可继续兼容 `diagnosis / text-delta / plan / state-patch / done`
  - 下一步补结构化 `activity / tool-result / knowledge-point-suggestion / state-patch / done` 事件，逐步替代固定 `plan` 展示
  - 参考：`docs/reference/learning-engine-backend-integration.md`
6. `apps/web` 接入真实 agent API
   - 使用 Vercel AI SDK 管理 message stream
   - 当前已能消费 diagnosis、plan、state-patch；activity 现已停止由前端归一化补齐，后续以 session-aware backend event contract 为准
   - 当前有未完成 activity 时，主输入区已切到“完成当前动作 / 跳过当前动作”的受约束交互
   - 当前前端已支持“随时加材料”的附加上下文 tray，不再要求先切到单独材料模式
   - 当前前端已支持多张学习卡的 deck 视觉，但真实后端仍需补稳定的多 activity contract
   - 下一步由 backend 补稳定的 `activity` 事件；前端不再从 `diagnosis / plan` 推导伪 activity contract
   - 当前 project chat 里的知识点新增建议已不再由前端本地启发式生成；下一步改为消费 agent 结构化 suggestion 事件，并通过确认 API 写回 project knowledge point pool
   - Project 首页前端叙事壳已完成，当前重点从“接通真实 `/runs/v0` 数据”转到“减少 fallback / fixture 依赖”
7. `apps/web` 重构信息架构
   - 首页先收成 `App Home -> Project Workspace -> Knowledge Point Detail`
   - Project Workspace 默认优先展示 knowledge points
   - 只有进入某个 session 时才展开 session workspace
8. `apps/web` 接 project-level state
   - 学习画像改为 project-level 聚合画像摘要
   - 复习信号改为围绕 knowledge points 与 project review 状态展示
   - 材料状态改为 project-level materials + session-level attachments 的组合视图

## Ready To Build

以下内容已在本轮架构讨论中定稿，可直接进入实现：

- 技术栈分层
- `Project / Knowledge Point / Session / Learning Profile` 四个主对象
- `project / study / review` 三类 session 边界
- `App Home -> Project Workspace -> Knowledge Point Detail` 页面主结构
- Project Workspace 默认知识点工作台、session 按需展开的产品心智
- 学习 / 复习第一版只做选择题
- web-agent 事件流协议的迁移方向
- `maybe_tool` 边界
- `Review Engine`
- project 级 off-topic guardrail

当前不需要继续等待新的方向级决策，除非实现过程中发现明显冲突。

## Working Rule

- 如果 `P0` 没讲清楚，不进入更复杂功能
- 每次新任务开始前，先确认主 owner、所属 workstream 和主编辑目录
- 每完成一个任务，顺手更新 `docs/status.md`
- 会改变共识的任务，合并前更新 `docs/memory/decision-log.md`
