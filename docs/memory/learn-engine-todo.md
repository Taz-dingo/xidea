# 学习引擎优化 TODO

> 创建时间：2026-04-13
> Owner：学习引擎
> 状态：已完成

## 架构方向

**LLM-first 架构**：LLM 是核心 pedagogical agent，规则仅作为 guardrails 约束 LLM 输出。

- 兼容的 LLM API key 是必须的，未设置时系统拒绝启动
- `run_agent_v0()` / `build_graph()` / `compile_graph()` 的 `llm` 参数为 keyword-only required
- 规则辅助函数保留代码用于测试和局部软降级，但不再作为独立运行路径

## 完成记录

### A 层：LLM 参与诊断 — 已完成

- [x] `llm.py` 新增 `llm_build_signals()` — LLM structured output 提取 `Signal[]`
- [x] `llm.py` 新增 `llm_diagnose()` — LLM structured output 输出 `Diagnosis`
- [x] `runtime.py` 修改 `diagnose_step()` — LLM 诊断为必须路径
- [x] `guardrails.py` 新增 `validate_diagnosis()` — 校验 LLM 诊断输出
- [x] `graph.py` 统一 LLM 传参

### B 层：LLM 参与规划 — 已完成

- [x] `llm.py` 新增 `llm_build_plan()` — LLM 直接生成完整 `StudyPlan`
- [x] `runtime.py` 修改 `compose_response_step()` — LLM plan 为主路径，失败时用模板补充（软降级）

### C 层：架构清理 — 已完成

- [x] Guardrails 从 advisory 升级为 blocking
- [x] 修复 review engine 的 `next_review_at` 传参问题
- [x] 状态数值边界保护（delta 衰减 + 重复衰减 + 阈值下调）

### LLM-first 架构修正 — 已完成

- [x] `build_llm_client()` 无兼容的 LLM key 时抛 `RuntimeError` 而非返回 `None`
- [x] `api.py` 启动时校验 LLM 可用性
- [x] `diagnose_step()` 移除 fallback 分支，LLM 诊断为必须路径；guardrail 违规时修正而非 fallback
- [x] `compose_response_step()` LLM plan + reply 为主路径
- [x] `run_agent_v0()` / `build_graph()` / `compile_graph()` 的 `llm` 参数改为 keyword-only required
- [x] 所有测试更新：去掉 "无 LLM fallback" 测试，新增 "无 key 报错" 测试
- [x] agent 全量 97 个测试全部通过
- [x] 文档更新

---

## 文件影响范围

| 文件 | 改动说明 |
|------|---------|
| `llm.py` | LLM 为核心，`build_llm_client` 无兼容的 LLM key 时抛错；信号提取 / 诊断 / 计划 / 回复 prompt |
| `runtime.py` | `diagnose_step` / `compose_response_step` 的 LLM 为必须路径；`llm` 参数 required |
| `graph.py` | `build_graph` / `compile_graph` 的 `llm` 参数 keyword-only required |
| `api.py` | 启动时调用 `build_llm_client()` 校验 |
| `guardrails.py` | 校验 LLM 诊断 + blocking 模式 |
| `review_engine.py` | 复习调度启发式规则 |
| `state.py` | `prior_next_review_at` 字段 |
| `tests/conftest.py` | 共享 mock LLM 构建函数 |
| `tests/test_*.py` | 所有 `run_agent_v0` 调用注入 mock LLM |
