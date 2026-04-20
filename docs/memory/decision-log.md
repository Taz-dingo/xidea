# Decision Log

只保留“当前仍生效、且不写下来后续很容易反复争或反复踩坑”的活跃决策。
它不负责重复 `spec` 里的当前产品定义，也不负责记录 `status` 里的已完成事项。
更早期、已实现、已替代或过细的历史记录见 [docs/archive/decision-log-history.md](../archive/decision-log-history.md)。

## 使用边界

- `docs/spec.md` 负责回答“现在要做什么、产品边界是什么”
- `docs/status.md` 负责回答“最近做成了什么、现在还缺什么”
- `docs/plan.md` 负责回答“接下来做什么”
- 本文只记录“为什么必须这么定，以及这条结论会约束后续哪些实现或协作”

## 2026-04-20 — `study / review` 必须是多卡编排 session，而不是单卡 focus 容器

### 决策

- `study / review session` 不再以单个 `knowledgePointId` 作为主语义
- 点击 `学习 / 复习` 后先进入待开始态；用户首句参与首次编排，首次编排完成后才创建真实 session
- session 的核心对象改为：
  - `candidate pool`
  - `current plan snapshot`
  - `current focus`
  - `plan events`
- 右栏固定展示 `当前学习计划`，会话流只在首次编排和关键改排时显示专门的编排事件卡

### 原因

- 如果继续用单卡 focus 作为 session 主语义，产品心智会持续漂回“当前知识卡详情页”，证明不了“系统会决定你接下来怎么学”
- 首句参与首次编排，能把用户意图真正纳入学习决策，而不是让 session 先空落库再事后补语义
- 右栏显示当前 plan、timeline 只显示关键变化，才能同时兼顾“可解释”和“界面不失控”

### 影响

- learning-engine owner 负责产出正式 orchestration object / event，而不是让前端从文本里猜测计划变化
- frontend owner 只消费 orchestration contract，不能自己脑补“哪些卡应该在这一轮、这次是否算改排”
- 后续如果要继续增强动态性，应优先在受控 candidate pool 内演进，而不是重新退回全项目自由选卡

## 2026-04-20 — `Consolidation` 作为无感 `System Checkpoint` 固定内嵌进 Project 总览卡，而不是手动工具入口

### 决策

- `Consolidation` 在比赛版里不做手动触发按钮
- 进入 `Project` 时，前端先展示数据库里上一版 `Consolidation` 结果，同时后台静默刷新最新结果
- 展示位固定在 `Project Workspace` 顶部项目总览卡内部，放在项目状态区下方
- UI 只暴露刷新中 / 成功 / 失败状态，不把它做成普通 `AI summary`

### 原因

- 手动触发更像工具能力，削弱“系统会持续整理学习状态”的主叙事
- 首屏先展示旧结果，再后台刷新，既能保证体验稳定，也能保留“系统正在持续更新 project 收口”的真实感
- 内嵌到项目卡里更符合“这是项目当前状态的一部分”，也能减少与下方知识卡区的重复信息
- 如果把它做成长文本 summary，很容易退化成泛用总结卡，证明不了编排系统价值

### 影响

- 前后端都要围绕“结构化 project-level checkpoint”来设计 payload 和 UI，而不是只回一段总结文字
- 后续答辩讲法统一为“系统每次回到项目时都会先给出上一次的学习收口，再无感刷新最新状态”

## 2026-04-20 — 演示优先级收敛为“主链稳态 -> 无感 checkpoint -> 高信号题卡 -> 演示级 RSR”，语音不进主线

### 决策

- 演示前的实现优先级固定为：
  - 主链稳态与创建流补齐
  - 无感 `Consolidation / System Checkpoint`
  - 少量高信号真实题卡类型
  - 演示级 `RSR / Review Engine`
- 语音模式这轮不进入主线阻塞项，只保留为录屏或口头展望

### 原因

- 这轮比赛最重要的是让评委快速看懂“系统在安排学习”，其次才是 wow 感
- 题卡类型扩展能直接证明系统会因知识状态切换训练形式，ROI 明显高于重语音链路
- 当前演示条件下不大概率现场开麦；如果强推语音，风险和稳定性成本高于收益

### 影响

- `plan` 和实现排期都应优先围绕主链、checkpoint、题卡和演示级复习能力推进
- 语音相关设计可以保留在长期主线里，但这轮不应反向占用主线稳定性预算

## 2026-04-19 — `Project / 工作区` 只是当前比赛版的主案例承载方式，不代表产品长期边界

### 决策

- Xidea 的产品定位收敛为“面向持续学习任务的 AI 学习编排系统”，而不是“只服务项目场景的学习工具”
- 当前比赛版继续使用 `Project / 工作区` 作为主案例和主界面容器，但它只是证明壳，不是产品边界

### 原因

- 如果把“项目”讲成产品本体，评审会把系统能力误解成一个过度具体的壳层实现
- 这条边界会反复影响前端文案、答辩叙事、产品范围和后续 demo 扩展

### 影响

- 后续对外讲述优先强调“AI 学习编排系统”，再说明当前 demo 用项目工作区承载演示
- `spec` 可以继续描述当前比赛版如何使用 `Project`，但不应把它写成长期产品边界

## 2026-04-17 — 前端不得补 learning-engine judgment 或脑补 backend contract

### 决策

- `apps/web` 不本地生成 pedagogical judgment、knowledge point create/archive suggestion、off-topic 判定、project learning profile 判断
- `apps/web` 不把 `diagnosis / plan / state-patch` 二次推导成正式业务对象
- 如果后端暂时缺结构化事件，前端只能显式降级展示，不能用 heuristic 默默补齐业务语义

### 原因

- 一旦前端开始补 learning-engine judgment，系统会迅速变成“双轨真相”：agent 负责回复，前端负责真正决定业务语义
- 这会直接破坏 project context、guardrail、去重、writeback 和 typed event contract 的一致性

### 影响

- 后续 review 要把“是否在前端偷偷补 learning-engine judgment”作为显式检查项
- 临时降级应写进 `status` / `plan`，而不是默默沉淀成长期实现

## 2026-04-17 — 知识点 suggestion / archive 是 agent-owned 的结构化业务对象

### 决策

- 知识点新增 / archive 建议必须由 agent 基于 project context 做判断并输出结构化结果
- stream 使用独立 `knowledge-point-suggestion` 事件
- resolution 走显式 confirm / dismiss API，而不是混在自由文本或其他事件里

### 原因

- 这条能力本身就是“系统决定你现在应该沉淀什么知识点”的核心证明点，不应由 UI 层替代
- 只有 agent 才能稳定读取 project memory、special rules、已有 knowledge points、selected materials 和 recent context 做一致判断

### 影响

- suggestion 相关 contract、去重、archive 规则和写回语义统一归 learning engine / backend 所有
- 前端只负责渲染、确认和降级展示

## 2026-04-16 — 并行开发前冻结共享边界

### 决策

- 并行开发阶段默认以 [docs/process/shared-boundary-freeze.md](../process/shared-boundary-freeze.md) 作为共享边界 source of truth
- 共享对象、事件流、提交 contract 和页面主结构，先改冻结文档，再改实现

### 原因

- 当前最容易返工的不是方向本身，而是对象、payload、storage 和页面边界在不同 owner 手里继续漂移
- 如果共享边界只存在于聊天或局部实现中，前后端和产品叙事会再次分叉

### 影响

- schema、repository、API contract 和前端类型统一向冻结文档里的命名和边界收敛
- 如果后续要改共享边界，优先更新冻结文档和决策日志，而不是只在实现里悄悄变化

## 2026-04-18 — `project / study / review` 的边界按 session 类型硬收口

### 决策

- `project session` 只负责 project 对话、材料挂载、topic / rules 调整和 knowledge point suggestion / archive suggestion，不直接下发学习题卡
- `study session` 和 `review session` 才允许下发学习动作
- learning activity contract 正式以一组 `activities[]` 为主，而不是单张 `activity`

### 原因

- 如果不把 session 边界收死，后面很容易再次回到 project session 发题、study/review 混 project materials、activity 一张一轮 agent 的混乱状态
- 这条边界会持续影响 runtime、前端交互、event contract 和评审演示路径

### 影响

- `spec` 可以描述当前三类 session 的产品心智；本文只保留“为什么必须硬收口”这层约束
- 后续如要放开新的 session 能力，先改 `spec` 和共享 contract，再改实现

## 2026-04-15 — 学习引擎长期收敛为单 agent + tool/activity loop，而不是展示型 plan 驱动

### 决策

- 学习引擎的长期稳定形态是“主决策回合 + tool/activity loop + writeback”
- `StudyPlan` 只保留为可选解释层或摘要，不再作为长期主路径中心

### 原因

- 展示型 `StudyPlan` 和串行文本调用无法稳定证明“系统真的决定你接下来怎么学”
- 这条取舍会持续影响 runtime、stream 事件、前端交互和性能优化方向

### 影响

- 后续学习引擎优化优先看主决策证据包、tool arbitration、activity loop 和状态回写，而不是优先堆更多展示型 explain output

## 2026-04-14 — 学习引擎采用 LLM-first 架构

### 决策

- LLM 是核心 pedagogical agent
- 规则仅作为 guardrails 约束 LLM 输出，而不是独立主路径
- 兼容的 LLM API key 是启动必须项

### 原因

- 产品定位是“受约束的单 pedagogical agent”；如果规则做主路径，系统会退化成另一个静态工具
- 这是学习引擎架构层的基础前提，后续很多实现判断都依赖它

### 影响

- runtime、graph、provider 和测试默认围绕 LLM-first 组织
- 规则辅助函数保留用于校正、测试和局部软降级，但不再作为独立生产路径
