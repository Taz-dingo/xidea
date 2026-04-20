# Multi-Card Session v0 Implementation Plan

Date: 2026-04-20
Topic: 前后端最小实现切片

## Goal

把 `study / review` 从单卡 focus session 改成多卡半动态编排 session，并以最小改动打通：

- 首句参与首次编排
- session orchestration 持久化
- 右栏当前学习计划
- timeline 编排事件卡

## Slices

### 1. Contract

- 为 runtime / repository / frontend 定义 `session_orchestration`
- 定义 `plan_created / plan_adjusted / plan_step_completed / session_completed`
- 约束候选池 `1~3` 张

### 2. Backend orchestration bootstrap

- 在首次上下文加载时构造 candidate pool
- 基于状态域、主题邻近和首句意图生成 objective / plan / focus
- 在首次编排完成后创建 session 语义

### 3. Repository persistence

- 在 `thread_context` 中持久化当前 orchestration
- 持久化 orchestration event history
- 回读时恢复当前 plan 与 timeline

### 4. Frontend hydration

- 把 thread context 中的 orchestration hydrate 到 runtime snapshot
- 让 active session 的 focus 跟随 orchestration，而不是只跟随本地 selected knowledge point

### 5. UI

- 右栏改为 `当前学习计划`
- 会话流插入专门的 orchestration event card
- 详情态查看完整 plan log

### 6. Verification

- 后端：新增 orchestration 构建与持久化测试
- 前端：至少跑生产构建，确认 contract 与渲染不报错

## Out Of Scope

- 全项目自由动态调度
- 复杂语义聚类
- 细粒度 planner trace
- 完整 `FSRS` 或更厚的 review explanation
