# Agent State Design

## 概述

`apps/agent/src/xidea_agent/state.py` 定义了 Xidea 学习引擎的完整数据模型。
设计原则：与前端 `types.ts` 保持对齐、体现双轨状态模型、用枚举约束 agent 行为。

## 枚举

### LearningMode

Agent 可选的 6 种训练模式：

| 值 | 含义 | 前端对应 |
|---|---|---|
| `socratic` | 苏格拉底追问 | `socratic` |
| `guided-qa` | 1v1 导师问答 | `guided-qa` |
| `contrast-drill` | 对比辨析训练 | `contrast-drill` |
| `image-recall` | 看图回忆 | `image-recall` |
| `audio-recall` | 听音作答 | `audio-recall` |
| `scenario-sim` | 情境模拟 | `scenario-sim` |

### TrainingAction

Agent 推荐的 5 种高层训练动作：

| 值 | 触发条件 | 出处 |
|---|---|---|
| `teach` | 用户没懂，需要先教学 | `scientific-review-integration.md` |
| `clarify` | 用户容易混淆，需要澄清 | 同上 |
| `practice` | 基本理解但不稳，需要练习 | 同上 |
| `review` | 会了但快忘，进入复习节奏 | 同上 |
| `apply` | 需要迁移验证 | `spec.md` 核心故事 |

## 领域模型

### SourceAsset

用户导入的原始学习材料。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | str | 唯一标识 |
| `title` | str | 材料名称 |
| `kind` | Literal | pdf / web / note / audio / video / image |
| `topic` | str | 所属主题 |

### LearningUnit

从原始材料中提炼出的最小可学习单元。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | str | 唯一标识 |
| `title` | str | 单元标题 |
| `summary` | str | 概要描述 |
| `weakness_tags` | list[str] | 薄弱标签 |
| `candidate_modes` | list[LearningMode] | 可用训练模式 |
| `difficulty` | 1-5 | 难度等级 |

### LearnerState（双轨模型）

同时包含理解状态和记忆状态：

**理解状态轨**

| 字段 | 类型 | 说明 |
|---|---|---|
| `understanding_level` | 0-100 | 理解深度 |
| `confusion` | 0-100 | 混淆风险 |
| `weak_signals` | list[str] | 薄弱信号 |

**记忆状态轨**

| 字段 | 类型 | 说明 |
|---|---|---|
| `memory_strength` | 0-100 | 记忆强度 |
| `last_reviewed_at` | str/null | 上次复习时间 |
| `next_review_at` | str/null | 建议下次复习时间 |

**综合**

| 字段 | 类型 | 说明 |
|---|---|---|
| `mastery` | 0-100 | 综合掌握度 |
| `preferred_modes` | list[LearningMode] | 偏好训练模式 |
| `recommended_action` | TrainingAction | 系统推荐的动作 |

### StudyPlanStep

学习计划中的单个步骤。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | str | 步骤标识 |
| `title` | str | 步骤名称 |
| `mode` | LearningMode | 训练模式 |
| `reason` | str | 为什么安排这个步骤 |
| `outcome` | str | 期望效果 |

### StudyPlan

Agent 生成的动态学习路径。

| 字段 | 类型 | 说明 |
|---|---|---|
| `headline` | str | 计划标题 |
| `summary` | str | 综合说明 |
| `steps` | list[StudyPlanStep] | 步骤列表 |

## GraphState

LangGraph 编排过程中的完整状态容器，承载从输入到输出的一条链路。

```
START → ingest_input → diagnose_learner → select_training_mode → generate_plan → write_back_memory → END
```

| 层 | 字段 | 类型 | 说明 |
|---|---|---|---|
| 输入 | `source` | SourceAsset? | 导入的原始材料 |
| 输入 | `unit` | LearningUnit? | 提炼出的学习单元 |
| 输入 | `entry_mode` | qa / material-import | 用户入口方式 |
| 输入 | `topic` | str | 学习主题 |
| 诊断 | `learner_state` | LearnerState? | 诊断出的学习者状态 |
| 输出 | `plan` | StudyPlan? | 生成的学习计划 |
| 追踪 | `rationale` | list[str] | 决策过程说明 |

## LangGraph 最小编排图

已使用 LangGraph `StateGraph` 实现 5 个节点的线性编排。

### 节点说明

| 节点 | 职责 | 规则逻辑 |
|---|---|---|
| `ingest_input` | 接收输入，准备学习单元 | 有 unit 直接用 → 有 source 则 mock 提炼 → fallback 默认 unit |
| `diagnose_learner` | 诊断学习者状态 | 有 learner_state 跳过 → 否则从 mock tool 获取 |
| `select_training_mode` | 根据状态选择训练动作 | confusion>=70→CLARIFY / understanding<=45→TEACH / memory<=50→REVIEW / mastery>=70→APPLY / else→PRACTICE |
| `generate_plan` | 生成学习计划 | 与前端 planner.ts 逻辑对齐，包含去重和 candidate_modes 过滤 |
| `write_back_memory` | 回写状态 + guardrail 检查 | 调用 `run_all_guardrails`，记录违规到 rationale |

### 调用方式

```python
from xidea_agent.graph import compile_graph
from xidea_agent.state import GraphState

app = compile_graph()
result = app.invoke(GraphState())  # 全 mock 运行
```

### 支持的输入模式

1. **无输入** — fallback 到默认学习单元和学习者
2. **提供 source** — 从材料 mock 提炼出学习单元
3. **提供 learner_state** — 跳过诊断直接编排
4. **提供 unit + learner_state** — 完全自定义输入

## Tools

`apps/agent/src/xidea_agent/tools.py` 定义了 agent 可调用的工具。
第一版只提供最小必要的读写工具，全部使用 mock 数据。

| Tool | 用途 | 输入 | 输出 |
|---|---|---|---|
| `retrieve_learner_state` | 获取学习者当前状态 | learner_id, unit_id | LearnerState |
| `retrieve_learning_unit` | 获取学习单元详情 | unit_id | LearningUnit |
| `retrieve_project_context` | 获取项目上下文 | project_id | ProjectContext |
| `write_back_state` | 训练后回写状态 | learner_id, unit_id, updated_state | WriteBackResult |

所有工具通过 `TOOL_REGISTRY` 注册，供 graph 节点查找。
后续接入真实存储后，只需替换内部实现，接口不变。

### 后续可扩展

- `generate_content`：调用 LLM 生成教学内容
- `search_knowledge_graph`：查找关联概念
- `schedule_review`：向复习引擎注册复习计划

## Guardrails

`apps/agent/src/xidea_agent/guardrails.py` 定义了 agent 的行为约束规则。
每条 guardrail 是一个纯函数：`check(state: GraphState) -> GuardrailResult`。

| 规则 ID | 规则名 | 约束内容 | 出处 |
|---|---|---|---|
| G1 | 诊断优先 | 必须先完成诊断才能选择训练动作 | decision-log |
| G2 | 不懂不复习 | understanding_level < 40 时禁止 REVIEW | scientific-review-integration.md |
| G3 | 高混淆先澄清 | confusion >= 70 时必须包含澄清类步骤 | scientific-review-integration.md |
| G4 | 模式匹配 | 选择的 mode 必须在 unit.candidate_modes 内 | 前端 planner.ts 隐含 |
| G5 | 必须解释 | 每个 step 必须有非空 reason | spec.md |

### GuardrailResult

| 字段 | 类型 | 说明 |
|---|---|---|
| `rule_id` | str | 规则标识（G1-G5） |
| `rule_name` | str | 规则名称 |
| `passed` | bool | 是否通过 |
| `violation` | str | 违规说明（未通过时） |
| `suggestion` | str | 修正建议（未通过时） |

### 使用方式

```python
from xidea_agent.guardrails import run_all_guardrails, get_violations

results = run_all_guardrails(state)  # 执行全部检查
violations = get_violations(state)    # 只获取未通过的
```

## 前后端字段映射

Python 使用 `snake_case`，前端使用 `camelCase`，字段一一对应：

| Python | TypeScript |
|---|---|
| `understanding_level` | `understandingLevel` |
| `memory_strength` | `memoryStrength` |
| `preferred_modes` | `preferredModes` |
| `weak_signals` | `weakSignals` |
| `last_reviewed_at` | `lastReviewedAt` |
| `next_review_at` | `nextReviewAt` |
| `recommended_action` | `recommendedAction` |
| `weakness_tags` | `weaknessTags` |
| `candidate_modes` | `candidateModes` |
