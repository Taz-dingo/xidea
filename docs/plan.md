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
- [x] 完成编排证据展示探索，并收敛为“中间线程不直出、右侧 inspector 承载”
  - owner: 前端 owner / 学习引擎 owner
- [x] 只保留 2 到 3 个最能证明主案例的训练动作
  - owner: 产品 owner / 学习引擎 owner
- [x] 建立可复用的项目接手和协作规则
  - owner: 全员
- [x] 定义 web 与 agent 之间的最小 API contract
  - owner: 学习引擎 owner / 前端 owner

### P1

- [ ] 将 agent 主路径收敛为“预取上下文 -> 单次主决策调用 -> tool / activity loop”，减少串行 LLM 调用
  - owner: 学习引擎 owner
- [ ] 让学习资料、thread memory 和 review context 在主决策前完成预取，并进入同一证据上下文
  - owner: 学习引擎 owner
- [ ] 将 `StudyPlan` 从展示型输出改成可执行 learning activity contract，支持 agent 在对话里直接触发出题 / 复习
  - owner: 学习引擎 owner / 前端 owner
- [ ] 将 web-agent contract 从固定 `plan` 展示收敛为结构化 activity / tool result 事件，由前端按事件插入 card，而不是默认渲染固定面板
  - owner: 学习引擎 owner / 前端 owner
- [ ] 将“材料输入”从互斥入口模式改成线程中的随时附加上下文，明确 thread-level material library 与 turn-level attachments 的数据形态
  - owner: 前端 owner / 学习引擎 owner
- [ ] 收敛 activity 的交互 gating：当前有未完成学习动作时，主输入区默认锁住自由聊天，只保留完成当前动作或显式跳过
  - owner: 前端 owner / 学习引擎 owner
- [ ] 将单 activity 进一步扩到轻量 card deck：允许一轮下发多张顺序卡，但始终只激活最上面一张
  - owner: 前端 owner / 学习引擎 owner
- [ ] 为学习动作补高反馈密度的正确 / 错误 / 跳过 / 翻卡音效与动画，优先参考 Duolingo 的轻反馈节奏
  - owner: 前端 owner
- [ ] 打通 `exercise-result / review-result` 的回传与状态回写闭环
  - owner: 学习引擎 owner / 前端 owner
- [ ] 细化 agent 决策路径与 evaluation 维度
  - owner: 学习引擎 owner
- [ ] 为 tutor agent 补专门的 system prompt：明确何时必须触发 activity、何时只给短引导、不再把“完整解释”当默认目标
  - owner: 学习引擎 owner
- [ ] 为前端已存在的学习交互补对应的 tutor prompt / contract 支撑，至少覆盖“随时加材料、多 card deck、hint、作答后短反馈”
  - owner: 学习引擎 owner / 前端 owner
  - 参考实现要求已写入 `docs/reference/architecture.md` 和 `docs/reference/agent-state-design.md`
- [ ] 将学习模式优先借鉴项整理成可实现 backlog，并按轻交互优先级推进
  - owner: 前端 owner / 学习引擎 owner
  - 当前优先项：
    - `hint`
    - `more questions`
    - 作答后短诊断 / performance feedback
    - 基于材料直接生成 quiz / flashcards / study guide
    - 一轮生成轻量 card deck，而不是长篇 plan
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
- [ ] 决定当前 `Consolidation` 是手动触发演示还是模拟定时入口
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
- 将展示型 plan 收敛为可执行 activity，并支持对话内练习 / 复习
- 增加 1 到 2 个次级 demo surface
- 增加 evaluation 和答辩支撑材料

### Later Horizon

- 增强 `Review Engine`
- 引入真正的 spaced repetition 调度算法
- 优先考虑 `FSRS` 或同等级现代 SRS 方案，而不是只停留在启发式规则
- 增强 `Agent Memory / Consolidation`
- 增加更多输入模态与更多学科模板

## Implementation Checklist

当前已经可以进入实现阶段。建议按以下顺序落地：

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
4. `apps/agent` 实现 `Review Engine`
   - 基于启发式规则更新 `memoryStrength / nextReviewAt`
   - 不实现完整 SRS / FSRS 算法
5. `apps/agent` 暴露 FastAPI streaming endpoint
   - 当前返回 `diagnosis / text-delta / plan / state-patch / done`
   - 下一步补结构化 activity / tool result 事件，逐步替代固定 `plan` 展示
6. `apps/web` 接入真实 agent API
   - 使用 Vercel AI SDK 管理 message stream
   - 当前已能消费 diagnosis、plan、state-patch，并把它们归一化成 activity card；学习动作卡会插到最后一条 agent 回复后
   - 当前有未完成 activity 时，主输入区已切到“完成当前动作 / 跳过当前动作”的受约束交互
   - 当前前端已支持“随时加材料”的附加上下文 tray，不再要求先切到单独材料模式
   - 当前前端已支持多张学习卡的 deck 视觉，但真实后端仍需补稳定的多 activity contract
   - 下一步把 activity 来源从 `diagnosis / plan` 归一化过渡逻辑收敛到稳定的后端 event contract
   - 首页前端叙事壳已完成，当前重点从“接通真实 `/runs/v0` 数据”转到“减少 fallback / fixture 依赖”
7. `apps/web` 保持比赛主案例聚焦
   - 默认围绕 RAG 项目学习
   - 中间线程优先展示学习动作与反馈，证据与状态信息放在右侧 inspector
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
- `Data State`
- `Review Engine`

当前不需要继续等待新的方向级决策，除非实现过程中发现明显冲突。

## Working Rule

- 如果 `P0` 没讲清楚，不进入更复杂功能
- 每次新任务开始前，先确认主 owner、所属 workstream 和主编辑目录
- 每完成一个任务，顺手更新 `docs/status.md`
- 会改变共识的任务，合并前更新 `docs/memory/decision-log.md`
