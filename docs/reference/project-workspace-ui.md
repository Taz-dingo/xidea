# Project Workspace UI

这份文档描述当前 `project-centric MVP` 的页面信息架构、核心页面状态和关键交互规则。

用途：

- 给前端新 session 提供可直接照着实现的 UI 设计基线
- 把聊天中已经确认的页面结构收敛成稳定 reference
- 明确哪些是默认态，哪些是进入 session 后才展开的工作态

这是一份参考设计文档，不替代 [docs/spec.md](../spec.md)、[docs/status.md](../status.md) 和 [docs/plan.md](../plan.md) 的 source of truth 角色。

## Design Goal

UI 需要传达这 3 件事：

1. 用户进入的是一个 `Project` 学习工作区，而不是普通聊天页
2. `Knowledge Point` 是项目内的核心学习对象，`Session` 是围绕这些对象发生的过程
3. 系统在持续组织“该学什么、先学什么、接下来复习什么”，而不是只做问答

## Interaction Copy Rule

Workspace UI 默认遵守下面这条文案规则：

- 不用解释性 CTA 文案替代交互设计，例如“点击查看详情”“点击查看完整信息”“悬停查看更多”
- 优先用图形化方式表达状态和动作，例如 hover、边框/阴影变化、动效、图标、色彩强调和布局层级，而不是先写一句说明文字
- 用户已经能从 hover、边框变化、阴影、图标、按钮样式或整体点击区域理解的行为，不再额外补一句说明
- 预览卡、缩略卡和子卡默认只保留业务摘要；完整信息统一放进详情页、弹层或展开态
- 文案只用于表达业务语义、状态变化和系统判断，不用于反复提醒用户“这里可以点”

做前端实现或 review 时，优先先调结构、图标、动效和反馈，不要把“补一行提示字”当默认修正手段

## Page Map

当前 MVP 的页面层级固定为：

1. `App Home`
2. `Project Workspace`
3. `Knowledge Point Detail Modal`

不在第一版内的页面：

- 独立的全局 dashboard
- 独立的 learning profile 管理页
- 独立的 special rules 管理页
- 常驻四栏或多 inspector 的复杂工作台

## Core Objects In UI

### Project

页面级容器，承载：

- topic
- description
- special rules
- materials
- knowledge points
- sessions
- learning profile summary

### Knowledge Point

项目内最小学习单元。
在 UI 上以浏览卡片形式展示，不直接承担作答行为。

### Session

项目内的一次互动过程，显式区分为：

- `project`
- `study`
- `review`

### Project Learning Profile

项目级轻量学习画像。
默认只以摘要形式展示，不抢主区。

## App Home

### Goal

回答 3 个问题：

1. 我有哪些 project
2. 哪个 project 现在最值得继续
3. 怎么快速进入或新建 project

### Layout

- 顶部：全局导航
- 左侧：project filter/navigation
- 主区：continue card + project cards

### Top Bar

包含：

- 产品名
- `新建 Project`
- 搜索入口
- 用户菜单

### Left Sidebar

只保留轻量导航：

- `All Projects`
- `Recent`
- `Due Review`
- `Archived`

不要在首页展示：

- 全局聊天流
- 全局知识点瀑布流
- 重统计 dashboard

### Main Area

#### Continue

页面顶部优先显示一个 `Continue` 模块：

- project title
- topic 简述
- 下一个建议动作，如“复习 4 个知识点”
- 最近更新时间
- CTA：`继续 Project`

#### Project Grid

每张 Project 卡片展示：

- project 名
- 一句话 topic / description
- knowledge point 数量
- 待复习数量
- 最近更新时间
- `进入` CTA

### Low-fi Wireframe

```text
+--------------------------------------------------------------------------------------------------+
| Xidea                                                                     [新建 Project] [搜索] |
+--------------------------------------------------------------------------------------------------+

+----------------------+--------------------------------------------------------------------------+
| Sidebar              | Main                                                                     |
|                      |                                                                          |
| All Projects         | Continue                                                                 |
| Recent               |                                                                          |
| Due Review           |  ┌────────────────────────────────────────────────────────────────────┐  |
| Archived             |  | RAG System Design                                                  |  |
|                      |  | Topic: 围绕 RAG 系统设计进行项目型学习                              |  |
|                      |  | 下一个动作: 复习 4 个知识点                                          |  |
|                      |  | 最近更新: 昨天                                                        |  |
|                      |  | [继续 Project] [开始复习]                                             |  |
|                      |  └────────────────────────────────────────────────────────────────────┘  |
|                      |                                                                          |
|                      | My Projects                                                              |
|                      |                                                                          |
|                      |  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  |
|                      |  | RAG System Design  |  | Evaluation Basics  |  | Prompt Design      |  |
|                      |  | 12 知识点           |  | 8 知识点            |  | 5 知识点            |  |
|                      |  | 4 待复习            |  | 2 未学              |  | 1 待复习            |  |
|                      |  | 昨天更新             |  | 今天更新            |  | 3天前更新           |  |
|                      |  | [进入]              |  | [进入]              |  | [进入]              |  |
|                      |  └────────────────────┘  └────────────────────┘  └────────────────────┘  |
+----------------------+--------------------------------------------------------------------------+
```

## Project Workspace

这是当前产品最核心的页面。

## Current Implemented Layout

截至 `2026-04-19`，当前已经落地的 Project Workspace 浏览态结构是：

- 顶部：品牌 / breadcrumb / 搜索 / 新建项目
- 第一层主卡：Project 概览
- 第二层双栏：左侧 session rail，右侧知识卡主区
- Project 概览卡内部再拆成左右两半：
  - 左侧：项目标题、topic、description、rules、横向状态指标
  - 右侧：`项目材料 / 复习热力图 / 学习画像` 三张洞察子卡

洞察子卡的布局固定为：

- 左列单独放 `项目材料`
- 右列上下放 `复习热力图` 和 `学习画像`

这三张子卡都只承载摘要预览，完整内容统一通过弹层承接。

### Top Header

固定展示：

- `Project title`
- `Topic`
- `Description`
- `项目约束`
- 横向 `Project 状态`
- 右侧 `Project 洞察子卡`
- 标题旁轻量 `编辑` 入口

注意：

- `学习 / 复习 / 研讨` 入口不再放在 Project 主卡顶部，而是放到左侧 session rail 内，与对应会话类型直接绑定
- Project 编辑态允许直接编辑 `title / topic / description / special rules`
- 编辑态底部按钮使用固定宽度，不拉满一整行

### Two Page States

Project Workspace 有两个核心状态：

1. 默认浏览态
2. session 展开态

不要默认常驻一个三栏工作台。

## Project Workspace: 默认浏览态

### Goal

用户进入 project 时，先看到知识点池，而不是先看到聊天。

### Layout

- 左侧：Project Nav
- 中间：Knowledge Points 主区

此状态下：

- 不默认展开 session workspace
- 可以保留轻量 `Recent Sessions` 入口
- learning profile 只显示轻量摘要

### Left: Project Nav

包含：

- `Overview`
- `Due Review`
- `Archived`
- `Recent Sessions`

`Recent Sessions` 只作为入口，不在默认态占据大面积空间。

### Main: Knowledge Points

主区结构：

1. `Profile Summary`
2. knowledge point stats
3. masonry / dense card grid

#### Profile Summary

仅显示轻量摘要：

- 当前阶段
- 主要薄弱点
- 最近更新时间

不要默认展开完整画像解释。

#### Knowledge Point Cards

每张卡正面展示：

- title
- description
- mastery visual
- 当前阶段状态
- 下次复习信号

状态展示规则：

- 未学过：显示 `未学`
- 学过至少一次：显示复习态，如 `待复习 / 稳定 / 需强化`
- 掌握度始终存在，但优先用视觉信号表达

卡片正面不默认展示：

- 最近学习日期
- 长文本解释
- 复杂来源信息

### Card Visual Rules

- 用中性色和克制的状态信号
- 不使用大面积高饱和状态块
- 不把状态完全依赖纯文字解释
- 优先用轻标签、边框、角标、点状强度表达 mastery / review

### Low-fi Wireframe

```text
+--------------------------------------------------------------------------------------------------+
| Project: RAG System Design                    [学习] [复习] [新建 project session] [··· More]   |
| Topic: 围绕 RAG 系统设计进行项目型学习                                                           |
| Desc : 目标是理解设计取舍，并能用于项目答辩与方案讨论                                             |
+--------------------------------------------------------------------------------------------------+

+----------------------+----------------------------------------------------------------------------+
| Project Nav          | Knowledge Points                                                           |
|                      |                                                                            |
| Overview             | Profile Summary                                                            |
| Due Review           | 当前阶段: 基础理解中    薄弱点: 概念混淆 / 迁移弱    最近更新: 昨天         |
| Archived             |                                                                            |
|                      | 统计: 未学 6   待复习 4   已归档 2                                         |
| Recent Sessions      |                                                                            |
| - [project] 当前会话 |  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐              |
| - [review] 复习#09   |  | Chunking       |   | Retrieval      |   | Reranking      |              |
|                      |  | 切块策略       |   | 检索召回       |   | 重排策略       |              |
|                      |  | 切分文档并平衡   |   | 决定召回哪些   |   | 对候选结果做   |              |
|                      |  | 信息完整性与噪音 |   | 相关内容       |   | 二次排序       |              |
|                      |  | [掌握度 ●○○]    |   | [掌握度 ●●○]   |   | [掌握度 ●●●]   |              |
|                      |  | [待复习]        |   | [未学]         |   | [稳定]         |              |
|                      |  | 今日到期        |   |                |   | 3天后          |              |
|                      |  └────────────────┘   └────────────────┘   └────────────────┘              |
|                      |                                                                            |
|                      |  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐              |
|                      |  | Query Rewrite   |   | Context Window |   | Bad Case定位    |              |
|                      |  | 查询改写       |   | 上下文构造     |   | 常见失真定位    |              |
|                      |  | 调整输入以提高   |   | 控制给模型的   |   | 判断问题出在    |              |
|                      |  | 检索质量         |   | 内容组织方式   |   | 哪一层         |              |
|                      |  | [掌握度 ●○○]    |   | [掌握度 ●●○]   |   | [掌握度 ●○○]   |              |
|                      |  | [未学]          |   | [待复习]       |   | [未学]         |              |
|                      |  |                |   | 明天复习       |   |                |              |
|                      |  └────────────────┘   └────────────────┘   └────────────────┘              |
+----------------------+----------------------------------------------------------------------------+
```

## Project Workspace: session 展开态

### Entry Conditions

以下动作会进入 session 展开态：

- 点击 `学习`
- 点击 `复习`
- 点击某个 existing session
- 点击 `新建 project session`

### Layout

- 左侧：Project Nav
- 中间：Session Workspace
- 右侧：Knowledge Points Context Rail

这里的核心原则是：

- `Session` 进入时才展开
- Session 是工作态，不是默认主态

### Left: Project Nav

与默认浏览态保持一致，避免用户迷失位置。

### Center: Session Workspace

顶部包含：

- Session tabs / switcher
- 当前 session title / tag
- 可选的关闭或结束 session 动作

主区根据 session type 展示不同内容。

#### project session

用于承载：

- project chat
- 材料补充
- 知识点建议新增
- 知识点轻量编辑
- topic / rules 修改入口

行为规则：

- 默认继续当前 `project session`
- 用户可手动新建新的 `project session`
- 系统不自动切分 `project session`

#### study session

用于承载：

- 围绕未学知识点的一轮学习
- 第一版只做选择题
- 短反馈

#### review session

用于承载：

- 围绕已学知识点的一轮复习
- 优先处理到期知识点
- 第一版只做选择题

### Right: Knowledge Points Context Rail

只展示与当前 session 相关的轻量知识点上下文：

- 本轮涉及的 knowledge points
- 当前状态
- 轻量时间信号
- 可跳转到详情

不要在 session 展开态右侧塞入完整详情、完整画像和复杂 inspector。

### Low-fi Wireframe

```text
+--------------------------------------------------------------------------------------------------+
| Project: RAG System Design                    [学习] [复习] [新建 project session] [··· More]   |
+--------------------------------------------------------------------------------------------------+

+----------------------+-----------------------------------------------+-------------------------+
| Project Nav          | Session Workspace                             | Knowledge Points        |
|                      |                                               |                         |
| Overview             | Session Tabs                                  | 当前相关知识点          |
| Due Review           | [project 当前会话] [project 材料整理] [+]     |                         |
| Archived             | --------------------------------------------  | ┌────────────────┐      |
| Recent Sessions      |                                               | | Chunking       |      |
| - [project] 当前会话 | 用户: 这篇材料里为什么要做 chunking？         | | [待复习]       |      |
| - [project] 材料整理 |                                               | | 今日到期       |      |
| - [review] 复习#09   | Agent: 这和当前 project 中的知识点             | └────────────────┘      |
|                      | 「Chunking」直接相关。                         |                         |
|                      |                                               | ┌────────────────┐      |
|                      | 是否要新增一个相关知识点，聚焦“切块粒度选择”？ | | Context Window |      |
|                      |                                               | | [待复习]       |      |
|                      | [确认新增] [忽略]                             | | 明天复习       |      |
|                      |                                               | └────────────────┘      |
|                      | + 添加材料                                    |                         |
|                      | + 编辑知识点                                  |                         |
|                      | + 修改 project topic / rules                  |                         |
+----------------------+-----------------------------------------------+-------------------------+
```

## Knowledge Point Detail

### Routing

点击 knowledge point 卡片后，在当前 workspace 上方打开独立 modal。

不在 Project Workspace 主布局内长期维持完整 detail 面板，也不切路由离开当前工作区上下文。

### Goal

承载一个 knowledge point 的完整查看和管理信息。

### Layout

1. 顶部返回或关闭入口
2. Summary + actions
3. supporting sections

### Summary

展示：

- title
- description
- mastery
- 当前状态
- 下次复习
- 最近学习时间

### Actions

第一版可包含：

- `编辑`
- `加入学习`
- `加入复习`
- `Archive`

### Supporting Sections

详情页承载：

- 来源材料
- 相关 sessions
- 学习 / 复习热力图
- 编排备注或系统解释

## Key Interaction Rules

### Start Study

点击 `学习` 后：

- 直接创建新的 `study session`
- 自动发出一条 kickoff prompt，把当前知识点作为第一张 card 的 focus
- 后端可按需要继续把相关知识点编入同一轮 session
- 创建成功后进入 session 展开态
- 中间主区切到当前 study session

### Start Review

点击 `复习` 后：

- 直接创建新的 `review session`
- 自动发出一条 kickoff prompt，把当前知识点作为第一张 card 的 focus
- 后端可按需要继续把相关知识点编入同一轮 session
- 创建成功后进入 session 展开态

### New Project Session

点击 `研讨` 后：

- 先进入 pending intent / 准备开始态
- 用户补一条本轮研讨意图后，才真正创建新的 `project session`
- 创建成功后进入 session 展开态

### Continue Project Session

默认继续当前 `project session`，不自动切分。

### New Project

点击 `新建 Project` 后：

- 在当前页面上方打开 modal
- 不在主内容区插入创建卡片
- 关闭按钮放在卡片内部右上角，而不是悬空在 modal 外

### Modal Close Placement

当前 workspace UI 里的 modal 统一遵守：

- 关闭按钮放在卡片内容边界内
- 不使用悬空在弹层外部的关闭按钮
- 用户也可以通过点击遮罩关闭，但主视觉关闭入口仍放在卡片内部

### Add New Knowledge Point

材料导入后：

- 可批量生成 knowledge points

project chat 中：

- 默认先给新增建议
- 用户确认后再正式新增

### Archive Suggestion

knowledge point 不自动直接归档。
第一版规则：

- 系统建议
- 用户确认
- 再执行 archive

### Off-topic Guardrail

如果用户内容和当前 project 明显不相关：

- agent 主动提醒
- 可给简短回应
- 不更新 project memory
- 不新增 knowledge point
- 不触发学习 / 复习编排

## Visual Direction

整体方向是 `workspace`，不是 `chat app`，也不是重 dashboard。

应满足：

- 默认主角是 knowledge points，不是聊天
- session 是按需展开的工作态
- 页面密度高于营销页，但低于监控台
- 视觉上更像研究工作区 / 学习工作台，而不是客服对话页

### Style Principles

- 中性色为主
- 轻选中态
- 克制的层级和分隔
- 状态信号简洁，不喧宾夺主
- 卡片信息密度高，但不堆砌长文本

避免：

- 满屏聊天产品样式
- 满屏多色状态块
- 首页做成复杂 dashboard
- Workspace 默认四块并列长期共存

## Responsive Guidance

### Desktop

优先完整呈现：

- App Home
- Project Workspace 默认浏览态
- session 展开态的三段式结构
- 独立 detail page

### Narrow Screen

窄屏优先降级为分段视图：

- Project Nav 折叠
- Session Workspace 与 Knowledge Points 通过 tab 或 route 切换
- Knowledge Point Detail 保持独立页

第一版不要求在窄屏上复刻桌面布局比例。

## Implementation Notes

当前这份 UI 设计对应的实现优先级：

1. `App Home`
2. `Project Workspace` 默认浏览态
3. `Project Workspace` session 展开态
4. `Knowledge Point Detail`

前端实现时需要优先保证：

- 默认态与 session 展开态清晰分开
- `学习 / 复习 / 新建 project session` 是顶层主动作
- session 展开后，用户不需要在左右两侧来回跳视线才能完成主要操作
- Knowledge Point Detail 独立跳转，不在主 workspace 内长期挤占空间
