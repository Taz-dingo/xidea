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

## Working Rule

- 如果 `P0` 没讲清楚，不进入更复杂功能
- 每完成一个任务，顺手更新 `docs/status.md`
- 会改变共识的任务，合并前更新 `docs/memory/decision-log.md`
