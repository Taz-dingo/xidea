# Plan

## Current Sprint

### P0

- [x] 锁定比赛主案例和讲述顺序
  - owner: 产品 owner
- [x] 稳定单 pedagogical agent 的输入输出结构
  - owner: 学习引擎 owner
- [x] 划清 `Review Engine / Agent Memory / Consolidation` 的边界
  - owner: 学习引擎 owner
- [x] 定义 agent 的 state / action / tool / guardrail schema
  - owner: 学习引擎 owner
- [x] 搭出 LangGraph 最小 graph 骨架
  - owner: 学习引擎 owner
- [x] 保持 web demo 简洁可演示
  - owner: 前端 owner
- [x] 把编排证据链做成默认可见输出
  - owner: 前端 owner / 学习引擎 owner
- [x] 只保留 2 到 3 个最能证明主案例的训练动作
  - owner: 产品 owner / 学习引擎 owner
- [x] 建立可复用的项目接手和协作规则
  - owner: 全员
- [x] 定义 web 与 agent 之间的最小 API contract
  - owner: 学习引擎 owner / 前端 owner

### P1

- [ ] 细化 agent 决策路径与 evaluation 维度
  - owner: 学习引擎 owner
- [ ] 在主案例稳定后，再补 1 到 2 个能支撑主叙事的次级 demo surface
  - owner: 前端 owner / 产品 owner
- [x] 将学习画像进一步从前端推断迁到真实 agent / learner state 信号
  - owner: 学习引擎 owner / 前端 owner
- [x] 将复习热力图接到真实 `Review Engine` timeline，而不是只基于当前 session 状态渲染
  - owner: 学习引擎 owner / 前端 owner
- [x] 将材料面板接到真实 source asset / tool context，而不是长期依赖 fixture 数据
  - owner: 学习引擎 owner / 前端 owner
- [x] 增加 planner explanation 的结构化字段
  - owner: 学习引擎 owner
- [x] 将 `/runs/v0/stream` 从伪流式改成真实按步骤推送
  - owner: 学习引擎 owner
- [ ] 决定第一版 `Consolidation` 是手动触发演示还是模拟定时入口
  - owner: 学习引擎 owner / 产品 owner
- [ ] 准备答辩素材和对比竞品摘要
  - owner: 产品 owner
- [x] 整理 `docs/memory/decision-log.md` 与文档分层，控制长期记忆体积
  - owner: 全员

## Roadmap Horizons

### V1

- [x] 接真实模型 API（已默认接到智谱 OpenAI-compatible / `glm-5`，保留 OpenAI 兼容）
- 增加上传材料入口
- 增加更可信的内容摘要或结构化提炼结果
- 增加 1 到 2 个次级 demo surface
- 增加 evaluation 和答辩支撑材料

### V2

- 增强 `Review Engine`
- 引入真正的 spaced repetition 调度算法
- 优先考虑 `FSRS` 或同等级现代 SRS 方案，而不是只停留在启发式规则
- 增强 `Agent Memory / Consolidation`
- 增加更多输入模态与更多学科模板

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
   - 首页前端 v0 叙事壳已完成，当前重点从“接通真实 `/runs/v0` 数据”转到“减少 fallback / fixture 依赖”
7. `apps/web` 保持比赛主案例聚焦
   - 默认围绕 RAG 项目学习
   - 确保证据链默认可见
8. `apps/web` 右栏接真实状态
   - 学习画像改为基于真实 learner state / diagnosis 动态生成
   - 复习热力图改为读取 review inspector / review events
   - 材料状态改为读取真实 asset summary / thread context

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
