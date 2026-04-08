# Spec

## Goal

用最小可演示的方式证明 Xidea 的核心差异点：
它不是单一学习工具，而是一个 AI 学习编排系统，能够接住多样输入，并根据学习者状态选择不同训练动作。

## In Scope

- 用 mock 数据表达多样输入如何进入系统
- 用显式的 `LearnerState` 同时表达理解状态和记忆状态
- 用规则驱动的 planner 表达系统如何选择训练动作
- 用 React 前端展示输入、状态、编排逻辑和路径输出
- 用 Python agent 骨架承接后续 LangGraph 编排实现
- 用仓库内文档支撑三人协作和 agent 上下文接力

## Out Of Scope

- 真实多模态解析链路
- 真实语音、视频理解
- 完整 spaced repetition 引擎
- 大范围页面扩张
- 为了“看起来完整”而增加的非关键功能

## Core Demo Story

1. 用户可以通过原始材料导入，或普通问答进入系统
2. 系统一边理解内容，一边形成学习者画像和当前状态判断
3. 系统基于状态决定更适合的训练方式
4. 系统输出动态学习路径，而不是固定流程
5. 页面把“为什么是这个输入路径、为什么是这个训练动作”讲清楚

## Success Criteria

- 第一次看 demo 的人能快速理解这不是静态卡片工具
- 第一次看 demo 的人能理解输入和训练形式都可以变化，但核心判断逻辑是一套
- 团队成员能在不口头同步的情况下理解当前范围
- 任一新接手的人能在 10 分钟内找到项目规范、现状和下一步任务

## Current Implementation Target

- 维持一个简单 web demo
- 保留输入样例、学习者画像、状态、planner 输出
- 强调“多输入 + 多训练 + AI 编排”的统一模型
- 把科学复习放在系统中作为记忆调度子能力，而不是产品本体
- 不追求复杂视觉和复杂交互

## Technical Direction

- `apps/web`: React + Tailwind + shadcn-friendly frontend
- `apps/agent`: Python + LangChain + LangGraph orchestration core
- 两层之间后续通过显式 API contract 连接
