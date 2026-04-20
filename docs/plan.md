# Plan

## Current Sprint

### Current Focus

当前主链已经打通，`Current Sprint` 不再以“大块基础建设”推进，而是集中收尾剩余缺口。

#### Learning Engine owner

- 主目录：`apps/agent/src/xidea_agent`
- 当前重点：
  - [ ] 继续把主路径收敛到“预取证据上下文 -> 单次主决策 -> 少量动态 tool loop -> writeback”
  - [ ] 清掉残留 `needs_tool=true` 场景与 split path 额外 activity 调用
  - [ ] 把新知识卡继续沉淀成更厚的教学对象，提升 `study / review` 对动态知识卡的上下文支撑
  - [ ] 将多张 card 的 `activity_result` 进一步拆成更细粒度的 backend writeback
  - [ ] 定出当前 `Consolidation` 的最小演示路径，优先手动触发

#### Frontend owner

- 主目录：`apps/web/src/app`、`apps/web/src/components`
- 当前重点：
  - [ ] 继续验证 project chat 默认续写链路，重点检查跨项目切换、切 session、挂材后多轮追问时是否还有旧上下文泄漏
  - [ ] 补齐“创建 Project 时直接上传本地文件”这条创建流

#### Product / Demo owner

- 主目录：`docs/spec.md`、`docs/status.md`、`docs/plan.md`、答辩材料
- 当前重点：
  - [ ] 决定 `Consolidation` 的 demo 形态：手动触发演示，还是模拟定时入口
  - [ ] 准备答辩素材和竞品对比摘要

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
    - 已取消 `project session` 的 deterministic low-info 主路径拦截；当前 `ok / 继续 / hi / 细化一下` 这类短消息会重新回到 LLM 推进，而不是被模板式澄清误伤
    - 已补 `study / review session` 的 capability / meta guard：`你可以做什么 / 你能怎么帮我` 这类 turn 会先返回 session 能力说明，不再误触学习卡或复习卡
    - 已把 prompt 结构升级成“共享 base prompt + `project / study / review` 分轨 session prompt”，并继续保留 runtime guard；`project session` 也已加 pedagogical reply 过滤和 template fallback，避免文本语义漂回“先做题 / 先回忆”
    - 已把 `project session` 的默认语义进一步收成“学习方向 / 主题讨论 / 材料线索 / 知识点更新”四类推进目标，避免 prompt 和 runtime fallback 再退回空泛的 project 管理对话
    - 已修正 reply 生成链路里的 `user_msg` 传递错误：当前使用真实 `message.content`，不再把整个 `Message` 对象字符串塞进 prompt
    - 已把 study / review 的 activity 主路径切到 LLM 实时生成：当前优先消费 `main_decision` / `bundled response` 内直接返回的 `activities`，只有模型没稳定给卡时才回退到模板 builder
    - 已把前端 mock runtime snapshot 里的预置卡片撤掉，避免 backend 已切真后，seed / fallback 状态继续把 demo 题卡泄漏到 UI
    - 已把 dev tutor fixture 从比赛版前端主路径移除；正常 session 不再被 inspector、URL 参数或残留 runtime state 误切到 fixture
    - 已把 choice activity contract 扩成 `is_correct / feedback_layers / analysis`，前端据此本地执行“错了继续、对了再过”的即时反馈；整组卡完成后仍统一回传一次 `activity_result`
    - 已将 choice 题干与选项提示词再收紧：题目必须围绕知识点本身提问，错误项要对应真实误解；并已把正确答案位置做稳定打散，避免长期固定在第一个选项
    - 已把 completed deck history 收进前端 runtime store 和右侧 inspector，当前可回看每张卡的尝试轨迹与错误分析
    - 已把 `material-import` 的结构化知识点落库链修正成多 suggestion 路径：assistant 文本里明确提到的多条知识点会逐条写入 suggestion / knowledge point，而不是只落首条
    - 已将材料导入后知识卡的 `description / reason` 改成 LLM 补全，模板只保留为 fallback；历史模板 desc 已做一次性回刷
    - 当前剩余缺口集中在三处：一是 LLM 仍主动返回 `needs_tool=true` 的少数场景；二是 split path 下如果 bundled response 没带 `activities`，runtime 仍可能多一次 activity 生成调用；三是新知识卡仍缺少更完整的“教学化沉淀对象”，study / review 对用户动态知识卡的上下文支撑还不够厚
- [x] 定义 Project 创建流程 schema：topic、description、initial materials、special rules、bootstrap output
  - owner: 学习引擎 owner / 产品 owner
- [x] 定义 Project 最小持久化对象：project memory、learning profile、knowledge points、sessions
  - owner: 学习引擎 owner
- [x] 定义 Knowledge Point 最小 schema 与生命周期
  - owner: 学习引擎 owner / 前端 owner
  - 范围：
    - 标题、描述、来源材料、origin session
    - 掌握度、学习/复习状态、下次复习信号
    - archive 建议与确认
  - 当前进展：
    - backend 已补 `knowledge_points / knowledge_point_state / knowledge_point_suggestions`、详情读取与轻量编辑接口
    - archive 已收口为“系统建议 -> 用户确认”，confirm / dismiss API 已落地
    - 当前剩余缺口已从“schema 未定义”转为“动态知识卡的教学化沉淀对象还不够厚”
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
- [ ] 收敛 `project / study / review` 三类 session 的职责与状态转换
  - owner: 产品 owner / 学习引擎 owner / 前端 owner
  - 当前进展：
    - request contract 已显式带 `session_type`
    - `project session` / `review session` 的最小运行时差异已落到 agent
    - `project session` 已不再发题，且前端只在 project session 暴露材料入口 / project inspector
    - `study / review session` 已切到整组 `activities[]` 卡组，并在本地做完整组后再统一进入下一轮 agent loop
    - backend 已补 session 基础字段、Project bootstrap 和最小 create/read/update 链路
  - 当前剩余缺口：
    - 继续收口 session create/bootstrap contract 的边界
    - 明确更完整的状态转换与 project chat 默认续写规则
- [x] 将 Project Workspace 改成默认知识点工作台，只有进入 session 时才展开 session workspace
  - owner: 前端 owner
  - 参考：`docs/reference/project-workspace-ui.md`
- [x] 将 knowledge point 详情做成独立页面，并承载来源材料、相关 sessions、热力图和编辑入口
  - owner: 前端 owner
  - 参考：`docs/reference/project-workspace-ui.md`
- [ ] 收敛 project chat 行为：默认继续当前会话，支持手动新建 `project session`，不自动切分
  - owner: 前端 owner / 学习引擎 owner
  - 当前进展：
    - 点击 `研讨 / 学习 / 复习` 已统一先进入待开始态，只有首条真实消息后才创建 thread
    - project chat 的知识点建议、topic/rules 快捷入口、知识点轻量编辑路径都已接通
    - 当前仍需继续检查跨项目切换、切 session 和挂材后多轮追问时，是否还有旧 thread 上下文或旧草稿泄漏
- [ ] 补齐 project chat / Project 创建流的最后入口缺口
  - owner: 前端 owner / 学习引擎 owner
  - 当前进展：
    - backend 已补 `project_materials` 持久化与 `list / upload` API
    - frontend 已在 `Edit Project Meta` 和 `project session` 材料 tray 接入真实本地文件上传；上传结果会回流到当前 project materials，并可直接附着到当前 `project session`
    - frontend 已移除知识点建议新增的本地 heuristic，当前以 backend suggestion 事件为准
    - topic/rules 修改入口与知识点轻量编辑入口已接通
  - 当前剩余缺口：
    - “创建 Project 时直接上传本地文件”这条创建流仍未补齐；第一版当前仍沿用 demo seed 材料选择
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
- 增强动态知识卡的“教学化沉淀对象”，让 `study / review` 更稳定复用用户新建知识卡
- 将学习 / 复习结果写回从整组聚合进一步细化到单卡表现
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

当前已经从“基础搭建”进入“收尾与答辩准备”阶段。建议按以下顺序推进：

1. `apps/agent` 继续收敛主决策链路
   - 清掉残留 `needs_tool=true` 场景
   - 避免 split path 下额外多一次 activity 生成调用
   - 参考：`docs/reference/learning-engine-backend-integration.md`
2. `apps/agent` 增强动态知识卡沉淀对象
   - 继续补厚知识卡的教学化 detail/context
   - 让 `study / review` 对用户新建知识卡的上下文支撑更稳定
3. `apps/web` 与 `apps/agent` 继续收口 session 生命周期
   - 验证 project chat 默认续写链路
   - 明确 session create/bootstrap 的边界和状态转换
4. `apps/web` 补齐创建 Project 时的真实本地文件上传
   - 消掉当前仍依赖 demo seed 材料的创建流
5. `apps/agent` 细化 `activity_result` writeback
   - 从整组聚合结果继续拆到单卡表现
6. 产品 / 学习引擎共同确定 `Consolidation` 演示形态
   - 手动触发演示，或模拟定时入口
7. 产品 owner 准备答辩支撑材料
   - demo 讲述顺序
   - 竞品对比摘要
   - evaluation / 风险说明

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
