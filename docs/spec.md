# Spec

## Goal

用最小可演示的方式证明 Xidea 的核心差异点：
它不是单一学习工具，而是一个面向持续学习任务的 AI 学习编排系统，能够围绕明确主题、材料、知识点、学习画像和复习状态持续组织学习。

长期目标上，Xidea 要同时成立三件事：

- 支持多模态输入，而不是只接文本问答
- 支持多类型学习形式，由系统决定当前更适合哪一种
- 具备类似 Anki 的科学复习系统，用独立的 SRS / Review Engine 决定何时复习与复习什么

当前比赛版默认只围绕一个主案例展开：
用户正在推进一个 AI 应用项目，需要真正理解并应用 RAG 系统设计，而不只是临时问答或被动看资料。

这只是比赛版的证明路径，不是长期产品边界。
长期上，Xidea 面向更广义的持续学习任务；当前只是先用“项目工作区”这条最容易讲清楚的 case 来证明系统价值。

## In Scope

- 锁定一个主案例来承载比赛叙事：AI 工程师围绕真实项目学习 RAG 系统设计
- 创建 `Project` 时先确认学习主题，并允许用户直接补充材料
- 让每个 `Project` 拥有项目级 memory、项目级学习画像和项目内 session 历史
- 基于主题和材料自动生成一批扁平 `Knowledge Point`
- 将知识点作为项目内最小学习单元；学习和复习都围绕知识点组织
- 允许 project chat 在讨论过程中建议新增知识点，但新增建议必须由 agent 基于 project context 做判断，默认需要用户确认；前端不自行做启发式新增判断
- 用显式的 `LearnerState` 与 project-level learning profile 同时表达局部状态和项目级聚合判断
- 用受约束的单 agent 表达系统如何选择训练动作与更新项目状态
- 允许同一系统支持多种学习形式，但比赛版学习/复习 session 先只做选择题
- 区分 `Review Engine`、`Agent Memory` 和 `Consolidation` 三层能力
- 用 React 前端展示 Project 首页、知识点工作台、session workspace 和知识点详情页
- 第一版优先讲清楚 why this action now，而不是把某一种学习形式做成产品本体
- 每个 demo 输出都要让人理解：项目主题 / 材料 -> 知识点与画像 -> 学习或复习编排 -> session 结果 -> 状态回写 这条链路确实存在
- 用 LangChain + LangGraph 承接第一版 agent runtime，但只启用最小必要能力
- 用仓库内文档支撑三人协作和 agent 上下文接力

## Out Of Scope

- 面向所有学科和所有人群的广义学习平台叙事
- 没有项目目标、没有持续上下文的泛化陪聊式 tutor
- 把 AI 自动找资料做成第一版必需主链路
- 真实多模态解析链路
- 真实语音、视频理解
- 完整 spaced repetition 引擎
- 自动切分或自动切换 project session
- 知识点层级图、前置依赖图和复杂 curriculum graph
- 简答题、开放问答题、多轮对练作为学习/复习的默认形式
- 重的人格化全局用户画像
- 开放式 autonomous agent
- 为了“看起来完整”而增加的非关键功能

## Core Demo Story

1. 用户创建一个围绕真实 AI 项目的 `Project`，先确认学习主题，并补充初始材料
2. 系统基于主题和材料理解项目范围，生成第一批扁平知识点、项目级 memory 和学习画像
3. 用户进入 Project 工作台，默认先看到知识点池，而不是一条无限延长的聊天记录
4. 用户可以继续 project chat、补材料、编辑知识点，或发起一次学习 / 复习 session
5. 学习与复习都围绕知识点进行；第一版先通过选择题 session 组织一轮学习动作和短反馈
6. 页面必须把“当前 project 在学什么、有哪些知识点、为什么这轮学这个、作答后如何回写状态”讲清楚

## Success Criteria

- 第一次看 demo 的人能快速理解这不是静态卡片工具
- 第一次看 demo 的人能理解主题、材料、知识点、session 和学习画像是同一套项目型学习结构
- 第一次看 demo 的人能理解输入模态和训练形式都可以变化，但核心判断逻辑是一套
- 第一次看 demo 的人能理解科学复习系统与 agent memory 是两层能力，且复习系统不是附属装饰
- 第一次看 demo 的人能说清楚：这个系统面向的是“围绕真实项目持续学习”的任务，而不是普通陪聊问答
- 第一次看 demo 的人能从页面结构上直接看懂系统在安排学习：Project 首页先呈现知识点池，session 是按需展开的学习过程
- 团队成员能在不口头同步的情况下理解当前范围
- 任一新接手的人能在 10 分钟内找到项目规范、现状和下一步任务

## Current Implementation Target

- 维持一个简单 web demo
- 先把产品主对象收敛为 `Project / Knowledge Point / Session / Learning Profile`
- 当前默认主案例固定为“AI 工程师学习 RAG 系统设计并服务于手头项目”
- 强调“项目主题 + 项目材料 + 知识点池 + 学习状态 + 动作选择”的统一模型，而不是泛化展示所有输入和学科
- 把科学复习放在系统中作为学习域能力，而不是产品本体
- 用受约束的单 pedagogical agent 先跑通编排闭环
- 第一版优先证明一次高价值判断：系统能区分哪些知识点还没学、哪些该复习、哪些已经稳定
- 第一版就接入 LangChain + LangGraph，但不追求复杂多 agent 和复杂 graph
- 第一版 Project 页默认展示知识点工作台；只有在用户明确进入 project / study / review session 时才展开 session workspace
- 用户侧默认不直出内部编排证据；主区优先展示知识点与动作反馈，画像、规则和设置放在辅助位置
- 允许轻量卡片状态、选择题 session、提交后短反馈和 archive 建议，但这些都只是项目型学习编排的承载方式，不是产品目标本身
- `special rules` 可以由 LLM 在创建 Project 时生成，并在二级菜单中供用户后续编辑
- 比赛版暂不实现真实多模态解析链路和完整 SRS 算法，但叙事上要保留“多模态输入 + 多类型学习 + SRS”这条长期主线

## Technical Direction

- `apps/web`: React + Tailwind + shadcn-friendly frontend
- `apps/agent`: Python + LangChain + LangGraph 的受约束单 agent core
- 两层之间通过显式 API contract 连接
- `apps/web` 只消费、确认和表达 agent / backend contract，不负责补 pedagogical judgment、知识点生命周期判断，或把后端信号脑补成正式业务对象
- project chat 中的知识点新增 / archive 建议属于 agent contract 的一部分，应该通过结构化事件或同等级 typed payload 输出，而不是让前端从自由文本或本地规则里猜测
- 学习引擎的智能目标是对齐 `Codex / Claude Code` 这类 agent runtime 的方法论与领域内判断质量：强调显式状态、上下文预取、结构化事件、tool arbitration 和状态回写；但不追求开放域自主执行、长链环境探索或 coding agent 级别的通用任务自治
- 第一版重点是 project schema、knowledge point lifecycle、state、action、tool、guardrail 的设计，而不是复杂多 agent 编排
- graph、更多节点和更复杂 runtime 留作后续扩展，而不是第一版前提
