# Project Context

## Product

- 项目名: Xidea / 虾学
- 类型: 内部比赛 demo
- 当前目标: 用最小 demo 说明“这是一个按项目组织、支持多样输入和多样训练形式的 AI 学习编排系统”

## Current Scope

- 用 `project / thread` 组织学习上下文、材料、问题历史和状态
- 用 mock 数据表达多样输入、学习者状态、复习状态和编排输出
- 保持前端简单、稳定、易改
- 保留一个最小可讲清的受约束单 agent：输入、读状态、选择动作、生成结果、状态回写
- 区分面向学习者的复习系统与面向 agent 的项目记忆系统
- 前端采用 React + Tailwind 的快速演示栈
- 核心编排采用 Python + LangChain + LangGraph，但第一版只使用最小必要能力
- 优先支撑团队讨论和比赛讲述

## Out Of Scope For Now

- 真实多模态链路
- 复杂语音交互
- 完整 spaced repetition 引擎
- 大而全的产品化后台
- 开放式 autonomous agent
