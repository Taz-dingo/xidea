# Spec

## Goal

用最小可演示的方式证明 Xidea 的核心差异点：
它不是单一学习工具，而是一个按项目组织的 AI 学习编排系统，能够接住多样输入，并根据学习者状态和项目上下文选择不同训练动作。

## In Scope

- 用 mock 数据表达问答输入与材料导入两类入口
- 用 `project / thread` 组织学习上下文、材料、问题历史和训练历史
- 用显式的 `LearnerState` 同时表达理解状态和记忆状态
- 用受约束的单 agent 表达系统如何选择训练动作
- 区分 `Review Engine`、`Agent Memory` 和 `Consolidation` 三层能力
- 用 React 前端展示输入、状态、编排逻辑、学习面板和路径输出
- 用 LangChain + LangGraph 承接第一版 agent runtime，但只启用最小必要能力
- 用仓库内文档支撑三人协作和 agent 上下文接力

## Out Of Scope

- 真实多模态解析链路
- 真实语音、视频理解
- 完整 spaced repetition 引擎
- 大范围页面扩张
- 开放式 autonomous agent
- 为了“看起来完整”而增加的非关键功能

## Core Demo Story

1. 用户围绕某个项目进入系统，可以通过原始材料导入，或普通问答开始学习
2. 系统一边读取项目上下文，一边形成学习者画像、当前状态判断和可复习对象
3. 系统基于状态决定更适合的训练方式，如问答、做题或复习
4. 系统输出动态学习路径，而不是固定流程，并把结果回写到学习状态与项目记忆
5. 页面把“为什么是这个项目上下文、为什么是这个训练动作”讲清楚

## Success Criteria

- 第一次看 demo 的人能快速理解这不是静态卡片工具
- 第一次看 demo 的人能理解输入和训练形式都可以变化，但核心判断逻辑是一套
- 第一次看 demo 的人能理解科学复习系统与 agent memory 是两层能力
- 团队成员能在不口头同步的情况下理解当前范围
- 任一新接手的人能在 10 分钟内找到项目规范、现状和下一步任务

## Current Implementation Target

- 维持一个简单 web demo
- 保留输入样例、学习者画像、状态、项目上下文和 agent 决策输出
- 强调“多输入 + 多训练 + AI 编排”的统一模型
- 把科学复习放在系统中作为学习域能力，而不是产品本体
- 用受约束的单 pedagogical agent 先跑通编排闭环
- 第一版就接入 LangChain + LangGraph，但不追求复杂多 agent 和复杂 graph
- 不追求复杂视觉和复杂交互

## Technical Direction

- `apps/web`: React + Tailwind + shadcn-friendly frontend
- `apps/agent`: Python + LangChain + LangGraph 的受约束单 agent core
- 两层之间通过显式 API contract 连接
- 第一版重点是 state、action、tool、guardrail 的设计，而不是复杂多 agent 编排
- graph、更多节点和更复杂 runtime 留作后续扩展，而不是第一版前提
