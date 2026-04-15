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
| `teach` | 用户没懂，需要先教学 | `product-brief.md` |
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

## Decision Path — 综合诊断评分

`runtime.py` 的诊断决策路径已从 if-elif 瀑布升级为综合评分模型。

### 信号检测增强

| 维度 | 说明 |
|---|---|
| 多轮累积 | `build_signals()` 扫描 `recent_messages` 中所有 user 消息，同一关键词在多轮出现时 boost score 和 confidence |
| Prior state 趋势 | 对比 `prior_learner_unit_state`：confusion 持续偏高时追加趋势信号；memory 偏低但用户未提及时追加隐性遗忘风险信号 |
| 辅助函数 | `_multi_turn_frequency(messages, keywords)` 统计命中轮次；`_boost(base, turn_count)` 按轮次数线性提升 |

### 动态状态估算

| 改进 | 机制 |
|---|---|
| Confidence 缩放 | 每个信号的 delta 乘以 `signal.confidence`，高置信信号影响更大 |
| 动态 confidence | 不再固定 0.74；基于 `active_signal_count` 和 `source_diversity` 动态计算，范围 0.55–0.95 |

### 综合 Action 评分

用 `_score_actions()` 为 5 个动作打分，替代原来的 if-elif 瀑布：

| Action | 评分公式 | 说明 |
|---|---|---|
| clarify | `(confusion - 50) / 25` (confusion > 50) | 混淆度越高分越高 |
| review | `review_decision.priority` (0–1) | 直接使用 Review Engine 的优先级 |
| teach | `(60 - understanding) / 60 × 0.7` (understanding < 60) | 理解不足时触发 |
| apply | `(50 - transfer) / 50 × 0.6` (transfer < 50) | 迁移能力不足时触发 |
| practice | 固定基线 0.12 | 最低优先级兜底 |

选分数最高的 action 作为诊断结果，`Explanation.evidence` 包含所有 action 的得分排名。

### 效果评估

- 在 `_score_actions()` 中检查 `prior_state.recommended_action`
- 如果上一轮执行了某动作但对应指标未改善（如 clarify 后 confusion 仍 ≥ 55），该动作得分 ×0.75
- 避免反复选择无效动作，鼓励策略切换

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

`apps/agent/src/xidea_agent/tools.py` 定义了 agent 的 4 类工具意图和对应的上下文补充逻辑。
当前使用 seed 数据 + SQLite 持久化相结合，为 `maybe_tool` 节点提供结构化上下文。

### Tool Intent 概览

| Intent | 触发条件 | 返回的核心字段 |
|---|---|---|
| `asset-summary` | `entry_mode == "material-import"` | assets（含 contentExcerpt / keyConcepts / relevanceHint）、全局 keyConcepts |
| `unit-detail` | 默认 fallback | prerequisites / commonMisconceptions / coreQuestions / relatedUnits |
| `thread-memory` | `entry_mode == "coach-followup"` | recentMessages / learningProgress / lastDiagnosis |
| `review-context` | `diagnosis.recommended_action == "review"` | performanceTrend / decayRisk / lastReviewOutcome |

### asset-summary

为导入的学习材料提供结构化摘要。

| 字段 | 类型 | 说明 |
|---|---|---|
| `assetIds` | list[str] | 材料 ID 列表 |
| `assets` | list[dict] | 每个材料的详细信息 |
| `assets[].contentExcerpt` | str | 材料关键段落摘要 |
| `assets[].keyConcepts` | list[str] | 从材料中提取的核心概念 |
| `assets[].relevanceHint` | str | 与当前学习主题的关联说明 |
| `keyConcepts` | list[str] | 所有材料的去重概念合集 |
| `summary` | str | 整体摘要 |

### unit-detail

为当前聚焦的学习单元提供教学设计所需的结构化详情。

| 字段 | 类型 | 说明 |
|---|---|---|
| `focusUnitId` | str | 学习单元 ID |
| `title` / `summary` | str | 基础信息 |
| `candidateModes` / `weaknessTags` | list | 基础属性 |
| `difficulty` | int | 难度等级 |
| `prerequisites` | list[str] | 前置知识点 |
| `commonMisconceptions` | list[str] | 常见误解，配合 clarify 动作 |
| `coreQuestions` | list[str] | 核心验证问题，用于诊断理解深度 |
| `relatedUnits` | list[str] | 关联学习单元 |

### thread-memory

从 SQLite 读取会话历史和学习进度，支撑多轮教学连续性。

| 字段 | 类型 | 说明 |
|---|---|---|
| `threadId` | str | 会话 ID |
| `recentMessages` | list[dict] | 最近消息历史 |
| `learningProgress` | dict / null | 累计学习进度快照（mastery / understanding / memory 等） |
| `lastDiagnosis` | dict / null | 上一轮的推荐动作和依据 |
| `summary` | str | 整体摘要 |

### review-context

从 SQLite 读取复习调度状态，并评估记忆衰减风险。

| 字段 | 类型 | 说明 |
|---|---|---|
| `focusUnitId` | str | 聚焦单元 ID |
| `dueUnitIds` | list[str] | 待复习单元 |
| `scheduledAt` | str / null | 计划复习时间 |
| `performanceTrend` | dict / null | 记忆强度 / 理解水平 / 混淆度 + 趋势说明 |
| `decayRisk` | str | 记忆衰减风险：low / medium / high / critical |
| `lastReviewOutcome` | dict / null | 上次复习效果 |
| `summary` | str | 整体摘要 |

### Seed 数据

当前围绕 RAG 主案例维护了 3 份材料和 3 个学习单元的结构化 seed 数据：

**材料（_ASSET_ENRICHMENT）**：
- `asset-1`：RAG 系统设计评审记录 — 架构取舍和性能数据
- `asset-2`：检索召回与重排对比笔记 — 概念边界辨析
- `asset-3`：线上 bad case 复盘 — 真实问题诊断

**单元（_UNIT_ENRICHMENT）**：
- `unit-rag-retrieval`：召回 vs 重排的边界 — 前置概念、常见误解、核心问题
- `unit-rag-core`：RAG 不是简单检索 + 拼接 — 上下文构造设计
- `unit-rag-explain`：向产品和评审解释 RAG — 表达迁移

### 后续可扩展

- 接入真实 NLP 解析，从 PDF / 网页中自动提取 `contentExcerpt` 和 `keyConcepts`
- 基于 LLM 动态生成 `commonMisconceptions` 和 `coreQuestions`
- 接入知识图谱自动推导 `prerequisites` 和 `relatedUnits`

## Guardrails

`apps/agent/src/xidea_agent/guardrails.py` 定义了 agent 的行为约束规则。
每条 guardrail 是一个纯函数：`check(state: GraphState) -> GuardrailResult`。

| 规则 ID | 规则名 | 约束内容 | 出处 |
|---|---|---|---|
| G1 | 诊断优先 | 必须先完成诊断才能选择训练动作 | decision-log |
| G2 | 不懂不复习 | understanding_level < 40 时禁止 REVIEW | product-brief.md |
| G3 | 高混淆先澄清 | confusion >= 70 时必须包含澄清类步骤 | product-brief.md |
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

## Review Engine

`apps/agent/src/xidea_agent/review_engine.py` — 独立启发式复习调度层。

### 职责边界

- Review Engine 解决「什么时候复习」
- LangGraph 编排层解决「现在该怎么学」
- 两者协同但不互相替代

### ReviewState

| 字段 | 类型 | 说明 |
|---|---|---|
| `unit_id` | str | 学习单元 ID |
| `memory_strength` | 0-100 | 记忆强度 |
| `last_reviewed_at` | datetime / null | 上次复习时间 |
| `next_review_at` | datetime / null | 计划下次复习时间 |
| `review_count` | int | 累计复习次数 |
| `lapse_count` | int | 累计遗忘次数 |

### 6 条启发式规则

| 规则 | 条件 | 决策 |
|---|---|---|
| 1 | `understandingLevel < 60` | 不复习，优先 teach / clarify |
| 2 | `confusionLevel > 70` | 不复习，优先 clarify |
| 3 | `understandingLevel >= 60` 且 `memoryStrength < 65` | 可以复习 |
| 4 | `nextReviewAt <= now` | 提高复习优先级 |
| 5 | 回忆成功 | memory +，间隔拉长，reviewCount +1 |
| 6 | 回忆失败 | memory -，间隔缩短，lapseCount +1 |

### 间隔调度

- 基础间隔：1 天
- 成功后：`1 × 1.8^reviewCount` 天（上限 30 天）
- 失败后：缩短至 `基础 × 0.5`（上限 3 天）

### 核心 API

```python
from xidea_agent.review_engine import (
    should_enter_review,
    on_recall_success,
    on_recall_failure,
    apply_outcome,
    compute_decay_risk,
    schedule_next_review,
)

decision = should_enter_review(understanding_level=65, confusion_level=30, memory_strength=50)
outcome = on_recall_success(review_state, now=now)
new_state = apply_outcome(review_state, outcome)
```

### 与编排层的集成

- `runtime.py` 的 `diagnose_state()` 调用 `should_enter_review()` 判断是否推荐 review
- `runtime.py` 的 `build_state_patch()` 调用 `schedule_next_review()` 计算下次复习时间
- `ReviewPatch` 已扩展 `review_count` / `lapse_count` 字段
- `review_state` 表已对应增加两列

## LLM 接入 — LLM 是核心决策者，规则仅作为 Guardrails

### 设计原则

- **LLM 是核心 pedagogical agent**：信号提取、诊断决策、计划生成、教学回复全部由 LLM 驱动
- **规则仅作为 guardrails**：约束 LLM 输出，确保教学安全性（如不懂不复习、高混淆先澄清）
- **Guardrails 违规时修正而非 fallback**：guardrail 拒绝 LLM 诊断后，直接在 LLM 诊断上修正，而非回退到规则诊断
- **兼容的 LLM API key 是必须的**：未设置时系统拒绝启动，不存在"纯规则模式"
- 规则辅助函数（`build_signals` / `diagnose_state` / `build_plan`）保留代码，但仅用于：
  - 信号提取的软降级（LLM 信号提取失败时用规则补充）
  - 计划生成的软降级（LLM 计划生成失败时用模板补充）
  - 测试辅助（不 mock LLM 时可单独测试规则逻辑）
- Schema（`Signal / Diagnosis / StudyPlan`）不变，前端 contract 不受影响

### 当前实现中的 LLM 调用路径

| 环节 | 主路径（LLM） | 软降级 | 硬失败 |
|------|--------------|--------|--------|
| 信号提取 | `llm_build_signals()` | `build_signals()` 规则补充 | — |
| 状态估算 | `estimate_learner_state()` 规则辅助 | — | — |
| 诊断决策 | `llm_diagnose()` + guardrail 校验 | — | 抛 RuntimeError |
| 计划生成 | `llm_build_plan()` | `build_plan()` 模板补充 | — |
| 回复生成 | `generate_assistant_reply()` | `compose_assistant_message()` 模板 | — |

### 当前模块结构

`llm.py` 封装所有 OpenAI-compatible 调用：

```python
from xidea_agent.llm import (
    LLMClient, build_llm_client,
    llm_build_signals, llm_diagnose, llm_build_plan,
    generate_assistant_reply, enrich_plan_steps,
)

llm = build_llm_client()  # 无兼容的 LLM API key 时抛 RuntimeError
signals = llm_build_signals(llm, messages, observations, entry_mode, prior_state)
diagnosis = llm_diagnose(llm, learner_state, signals, entry_mode, target_unit_id)
plan = llm_build_plan(llm, topic, unit_title, candidate_modes, diagnosis, learner_state, user_msg)
reply = generate_assistant_reply(llm, diagnosis, plan, learner_state, user_message)
```

### 当前编排层集成

`runtime.py` 的 `diagnose_step()` 和 `compose_response_step()` 的 `llm` 参数是 **required**（非可选）：

1. `diagnose_step(state, llm=llm)`:
   - LLM 信号提取失败 → 用规则信号补充（软降级）
   - LLM 诊断 → `validate_diagnosis` guardrail 校验
   - Guardrail 违规 → 在 LLM 诊断上直接修正（不 fallback 到规则诊断）
   - LLM 诊断返回 None → 抛 RuntimeError（硬失败）
2. `compose_response_step(state, llm=llm)`:
   - LLM 计划生成失败 → 用模板补充（软降级）
   - LLM 回复生成失败 → 用模板补充（软降级）

`run_agent_v0()` 的 `llm` 参数为 keyword-only required。
`graph.py` 的 `build_graph()` / `compile_graph()` 的 `llm` 参数同样为 keyword-only required。

### Mature-Agent Alignment

当前实现里，主路径仍然是 bundled diagnosis 后再独立生成 reply 和 plan。
这条 3-call 路径只是现在已经落地的实现；
后续目标是把它收敛成“单次主决策调用 + tool / activity loop”。

目标形态：

- 第一次主决策前先准备完整 evidence bundle：`source assets + thread memory + learner state + review context`
- `agent_turn` 直接决定三件事：当前 pedagogical action、是否需要触发 tool / activity、是否已经能给最终回复
- tool 或 learning activity 的结果回写成 `Observation` 或 `exercise-result / review-result`
- agent 基于新 observation 继续下一轮 turn，直到给出最终回复并完成 writeback
- `StudyPlan` 如果保留，应来自已执行或将执行的 activity 摘要，而不是单独的展示型规划调用
- 前端展示默认跟随结构化事件：activity 或 tool result 进入消息流后，再按事件插入 card；不能把固定“学习动作 / 路径 / 证据”面板写死成长期假设
- 如果当前 activity 属于必须完成的学习动作，主输入区应被视为受约束交互；普通自由问答要等这轮 activity 完成或被显式跳过
- tutor system prompt 需要明确：当前首要目标是决定并主持学习回合，而不是先给完整解释；高混淆、记忆走弱、迁移验证场景优先触发 activity

这意味着下一阶段更关注：

- diagnosis 是否真的用上完整上下文
- activity 是否真正被触发并进入对话
- exercise / review 的结果是否进入下一轮状态更新

### System Prompts

| Prompt | 用途 | 关键约束 |
|--------|------|---------|
| `SIGNAL_EXTRACTION_SYSTEM_PROMPT` | 信号提取 | 输出 JSON 数组，kind 限定枚举 |
| `DIAGNOSIS_SYSTEM_PROMPT` | 诊断决策 | 输出 JSON 对象，遵守 G2/G3 教学约束 |
| `PLAN_GENERATION_SYSTEM_PROMPT` | 计划生成 | 输出完整 StudyPlan JSON |
| `REPLY_SYSTEM_PROMPT` | 教学回复 | 不改变诊断结论，2-4 句话 |

### Tutor Prompt Requirements For Current Frontend

当前前端已经有一批学习交互件，后端 prompt 需要显式支持这些行为。
这部分不是“可选优化”，而是前后端节奏对齐要求。

#### 1. 材料在任意回合都可附加

prompt 需要理解：

- 用户不再通过单独模式进入“材料轮”
- 当前轮可能附带 `turn_attachment_ids`
- 线程里可能还有更大的 `thread_material_ids`

模型不应把“有材料”简单理解成另一种独立模式，
而应把它当成当前回合额外可用的证据。

#### 2. 一轮允许输出 card deck

prompt 需要允许：

- 不止触发一张 activity
- 在同一轮里规划一个轻量顺序卡组
- 仍然保持一次只让用户做最上面那张

也就是说，prompt 目标不只是“要不要发卡”，
而是“这轮是否需要发一个顺序动作组”。

#### 3. 作答后先给 verdict，再决定下一步

prompt 需要优先输出：

- 这次作答是 `correct / incorrect / partial / skipped`
- 一句极短反馈
- 是否进入下一张卡或回到自由问答

不要默认回到长解释。
前端后续的音效、动效和翻卡都依赖这个 verdict 信号。

#### 4. 支持 `hint / more questions`

prompt 需要能在当前 activity 上继续派生：

- `hint`
- `more questions`

而不是把每次补充都写成一整段新的普通回复。

#### 5. 主持学习回合，而不是写学习总结

system prompt 至少需要明确以下节奏：

- 先决定这轮是否该发 activity 或 card deck
- 发卡后，文本只保留短引导
- card 未完成时，不继续自由展开
- 作答后，先给短反馈，再决定是翻下一张还是切换动作

### 环境变量

| 变量 | 必须 | 默认值 | 说明 |
|---|---|---|---|
| `XIDEA_LLM_API_KEY` | 条件必填 | 无（缺失时启动报错） | 通用 LLM key，默认按智谱 OpenAI-compatible 入口使用 |
| `ZAI_API_KEY` | 条件必填 | 无（缺失时启动报错） | 智谱官方环境变量名 |
| `OPENAI_API_KEY` | 条件必填 | 无（缺失时启动报错） | OpenAI 兼容回退 |
| `XIDEA_LLM_BASE_URL` | 否 | 智谱 `https://open.bigmodel.cn/api/paas/v4/` 或 OpenAI 默认 | 自定义 OpenAI-compatible base URL |
| `XIDEA_LLM_MODEL` | 否 | `glm-5` 或 `gpt-4o-mini` | 使用的模型 |

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
