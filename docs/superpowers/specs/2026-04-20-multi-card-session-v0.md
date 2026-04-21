# Multi-Card Session v0

Date: 2026-04-20
Topic: `study / review` 从单卡 focus 迁移到多卡编排 session

## Context

当前 demo 的 `study / review` 虽然在 UI 上已经不像“单张知识卡详情页”，但底层仍以单个 `knowledgePointId` 启动。
这会持续带来两层错位：

- 产品心智会误以为“session 就等于一张知识卡”
- 前端右栏和 session 文案很容易重新漂回“当前知识卡”叙事

本设计只解决比赛版 v0 的最小目标：

- 把 `study / review session` 定义成真正的学习编排对象
- 保留“小范围、可解释、可演示”的边界
- 不在这轮引入完整动态 curriculum 或全局自由调度

## Design Goal

第一版 `study / review session` 要证明：

- 系统不是围绕单卡被动出题
- 系统会根据状态、主题邻近和用户首句来组织一小轮学习
- 系统会在必要时调整下一步，并显式告诉用户当前的小学习计划

## Core Definition

- `project session` 负责 project 对话、材料挂载、知识点建议与范围澄清
- `study session` 负责未学域内的学习编排
- `review session` 负责已学 / 待复习域内的复习编排
- `study / review session` 不再绑定单卡，而是绑定：
  - 一个 session objective
  - 一个受控 candidate pool
  - 一个 current plan snapshot
  - 一个 current focus

`current focus` 只是当前游标，不再代表整轮 session 的全部语义。

## v0 Rules

### Startup

1. 用户点击 `学习 / 复习`
2. 前端进入待开始态，不立即创建 session
3. 用户说第一句话
4. 后端结合：
   - session type
   - 用户首句意图
   - 状态域
   - 主题相邻规则
   完成首次编排
5. 只有首次编排完成后，才真正创建 session

### Candidate Pool

- 候选池规模：`1~3` 张，默认尽量取 `3`
- `study` 只从未学域取
- `review` 只从已学 / 待复习域取
- `主题相邻` 第一版直接复用现有分组/标签/section 等已有规则

### Half-Dynamic Behavior

- session 内允许：
  - 池内重排
  - 同主题、同状态的受控替换
- session 内不允许：
  - 跨主题大跳转
  - 学习 / 复习混编
  - 每轮都从全项目自由抽卡

### Allowed Adjustments

只在以下情况触发 `plan_adjusted`：

- 暴露关键误解
- 当前计划前提被打破
- 用户主动改变学习方式，但仍留在当前范围内

普通答错一次，不构成默认改排理由。

## UI Expression

### Right Rail

右栏恢复为 `当前学习计划`，但不再展示“当前知识卡”。

只显示最近一次有效 plan snapshot，包括：

- 这轮目标
- 当前小计划
- 计划状态
- 最近一次调整原因

右栏不承载历史列表，历史通过详情弹层查看。

### Timeline

会话流新增专门的编排事件卡，只在关键节点出现：

- `plan_created` -> `本轮学习计划`
- `plan_adjusted` -> `计划已调整`
- `session_completed` -> 可选完成卡

普通 `plan_step_completed` 默认不单独插卡。

## Contract Direction

后端新增 session orchestration 语义：

- `objective`
- `current_candidate_pool`
- `current_plan_snapshot`
- `current_focus`
- `plan_events`

前端只消费这些 typed objects / events，不本地脑补编排语义。

## Acceptance Check

本设计成立的标准是：

- 右栏不再把 session 讲成单张知识卡
- 用户首句会实质性影响首轮编排
- session 创建时机改为“首次编排后创建”
- timeline 能看见首次编排和关键改排
- demo 中能清楚讲出“系统当前的这一小轮计划是什么”
