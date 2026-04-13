# Plan

## Current Sprint

### P0

- [x] 锁定比赛主案例和讲述顺序
  - owner: 产品 owner
- [ ] 稳定单 pedagogical agent 的输入输出结构
  - owner: 学习引擎 owner
- [ ] 划清 `Review Engine / Agent Memory / Consolidation` 的边界
  - owner: 学习引擎 owner
- [ ] 定义 agent 的 state / action / tool / guardrail schema
  - owner: 学习引擎 owner
- [ ] 搭出 LangGraph 最小 graph 骨架
  - owner: 学习引擎 owner
- [ ] 保持 web demo 简洁可演示
  - owner: 前端 owner
- [x] 把编排证据链做成默认可见输出
  - owner: 前端 owner / 学习引擎 owner
- [x] 只保留 2 到 3 个最能证明主案例的训练动作
  - owner: 产品 owner / 学习引擎 owner
- [ ] 建立可复用的项目接手和协作规则
  - owner: 全员
- [ ] 定义 web 与 agent 之间的最小 API contract
  - owner: 学习引擎 owner / 前端 owner

### P1

- [ ] 细化 agent 决策路径与 evaluation 维度
  - owner: 学习引擎 owner
- [ ] 在主案例稳定后，再补 1 到 2 个能支撑主叙事的次级 demo surface
  - owner: 前端 owner / 产品 owner
- [x] 增加 planner explanation 的结构化字段
  - owner: 学习引擎 owner
- [ ] 准备答辩素材和对比竞品摘要
  - owner: 产品 owner
- [ ] 整理 `docs/memory/decision-log.md` 与文档分层，控制长期记忆体积
  - owner: 全员

## Implementation Checklist v0

当前已经可以进入实现阶段。第一版建议按以下顺序落地：

1. `apps/agent` 定义 typed schema
   - `AgentRequest`
   - `StreamEvent`
   - `GraphState`
   - `Diagnosis`
   - `StudyPlan`
   - `StatePatch`
2. `apps/agent` 搭 SQLite 与 repository 骨架
   - `projects`
   - `threads`
   - `thread_messages`
   - `learner_unit_state`
   - `review_state`
3. `apps/agent` 搭 LangGraph 最小主链路
   - `load_context`
   - `diagnose`
   - `decide_action`
   - `maybe_tool`
   - `compose_response`
   - `writeback`
4. `apps/agent` 实现 `Review Engine v0`
   - 基于启发式规则更新 `memoryStrength / nextReviewAt`
   - 不实现完整 SRS / FSRS 算法
5. `apps/agent` 暴露 FastAPI streaming endpoint
   - 返回 `text-delta / diagnosis / plan / state-patch / done`
6. `apps/web` 接入真实 agent API
   - 使用 Vercel AI SDK 管理 message stream
   - 渲染 diagnosis、plan、state-patch 三类结构化结果
   - 首页前端 v0 叙事壳已完成，下一步优先把 mock 证据链切到真实 `/runs/v0` 数据
7. `apps/web` 保持比赛主案例聚焦
   - 默认围绕 RAG 项目学习
   - 确保证据链默认可见

## Ready To Build

以下内容已在本轮架构讨论中定稿，可直接进入实现：

- 技术栈分层
- web-agent 事件流协议
- LangGraph 最小主链路
- `GraphState / diagnosis / plan / state-patch` 结构
- `maybe_tool` 边界
- `Data State v0`
- `Review Engine v0`

当前不需要继续等待新的方向级决策，除非实现过程中发现明显冲突。

## Working Rule

- 如果 `P0` 没讲清楚，不进入更复杂功能
- 每次新任务开始前，先确认主 owner、所属 workstream 和主编辑目录
- 每完成一个任务，顺手更新 `docs/status.md`
- 会改变共识的任务，合并前更新 `docs/memory/decision-log.md`
