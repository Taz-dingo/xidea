# Project Context

## Product

- 项目名: Xidea / 虾学
- 类型: 内部比赛 demo
- 当前目标: 用最小 demo 说明“这是一个面向持续学习任务、支持多样输入和多样训练形式的 AI 学习编排系统”

## Current Scope

- 用 `Project` 组织学习主题、材料、知识点、session 历史和状态
- 每个 Project 拥有项目级 memory 与 project-level learning profile
- 用扁平 knowledge points 作为项目内最小学习单元
- 用显式的 `project / study / review` session 承接聊天、学习与复习过程
- 用 mock 数据表达多样输入、学习状态、复习状态和编排输出
- 保持前端简单、稳定、易改
- 保留一个最小可讲清的受约束单 agent：输入、读状态、选择动作、生成结果、状态回写
- 区分面向学习者的复习系统与面向 agent 的项目记忆系统
- 前端采用 React + Tailwind 的快速演示栈
- 核心编排采用 Python + LangChain + LangGraph，但第一版只使用最小必要能力
- 优先支撑团队讨论和比赛讲述
- 当前比赛版用“AI 工程师围绕真实项目学习 RAG 系统设计”作为第一证明场景
- `Project / 工作区` 是当前 demo 的证明壳，不是产品边界；长期上 Xidea 仍然面向更广义的持续学习任务

## Out Of Scope For Now

- 真实多模态链路
- 复杂语音交互
- 完整 spaced repetition 引擎
- 大而全的产品化后台
- AI 自动找资料作为第一版主链路
- 知识点层级关系和复杂 curriculum graph
- 开放式 autonomous agent
