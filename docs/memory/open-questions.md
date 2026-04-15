# Open Questions

## Product

- 主案例稳定后，第二个辅助案例是否需要保留“材料导入”视角，还是优先补“导师对练”视角
  - owner: 产品 owner

## Learning Engine

- ~~planner 是保持规则驱动，还是接一层真实模型来给出 explanation~~
  - **已解决（2026-04-14）**: diagnose 和 compose_response 已接入真实 LLM，planner（build_plan）保持规则驱动作为稳定结构，explanation 由 LLM 在 diagnose 阶段生成
- [ ] LLM 集成测试端到端验证：API 额度恢复后运行确认全部通过
  - owner: 学习引擎 owner

## Frontend

- 下一屏优先补“材料导入”还是“导师对练”
  - owner: 前端 owner
