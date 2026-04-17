# Learning Engine Backend Integration

这份文档服务于学习引擎 owner。
目标不是解释愿景，而是让一个新开的 session 能直接按这里落实现有 backend / agent 侧工作，并和当前 `apps/web` 对接。

默认和这两份文档一起读：

- [../process/shared-boundary-freeze.md](../process/shared-boundary-freeze.md)
- [../spec.md](../spec.md)

## Goal

当前 backend / agent 的实现目标分两层：

1. 先满足当前 web 已经接上的运行链路，避免前端再补 learning-engine 语义
2. 再补回产品上已经明确需要的 project chat knowledge point suggestion / archive suggestion 能力

这份文档只覆盖学习引擎 owner 的实现面，不覆盖 UI 设计。

## Fresh Session Kickoff

如果这是一个新开的学习引擎 session，默认先这样起手：

1. 先确认当前任务主 owner 是学习引擎，主目录是 `apps/agent/src/xidea_agent`
2. 先读 `docs/process/shared-boundary-freeze.md`，不要从现有前端表现反推 contract
3. 先补当前 web 的硬阻塞：显式 `activity` 事件 + backend project context preload
4. 先用测试锁住行为，再补 runtime 和 repository，不要先改 prompt 文案

默认第一刀实现范围：

- 让 `/runs/v0` 和 `/runs/v0/stream` 都能稳定产出 `activity`
- 让 runtime 在主决策前从 repository 读到 project context
- 让 `thread_context / inspector-bootstrap / review-inspector` 与 writeback 保持一致

不要在第一刀里同时做：

- project CRUD 全量落库
- 复杂多 agent runtime
- 前端兜底 fallback
- 从自由文本里猜 suggestion

## Current Frontend Contract

当前 web 已经直接依赖这些接口：

- `POST /runs/v0`
- `POST /runs/v0/stream`
- `GET /assets/summary`
- `GET /threads/{thread_id}/context`
- `GET /threads/{thread_id}/inspector-bootstrap`
- `GET /threads/{thread_id}/units/{unit_id}`
- `GET /threads/{thread_id}/units/{unit_id}/review-inspector`

### Important Current Truth

- 前端已经移除了 project chat 本地知识点 suggestion heuristic
- 前端已经移除了根据 `diagnosis / plan` 本地合成 activity card 的过渡逻辑
- 当前前端仍会显示 `diagnosis / plan / state-patch` 相关摘要，但学习动作卡只认 backend 显式 `activity` 事件
- 当前前端会把 session 选中的全部材料 id 一起发给 backend，不再只截前两份材料
- 当前前端发来的 `project` 信息只能当 hint；真正的 project context source of truth 必须在 backend

这意味着：

- 没有 `activity` 事件，study / review session 的核心交互就不会出现
- 没有稳定 project context，knowledge point suggestion / off-topic / writeback 一定会继续漂

## Implementation Phases

### Phase A: 先补当前 web 的硬依赖

必须做到：

- `/runs/v0` 和 `/runs/v0/stream` 能返回显式 `activity`
- `state-patch`、`learner_state`、`review_inspector` 和 `thread_context` 与 stream/writeback 一致
- backend 自己加载 project context，不依赖前端 request 里的临时文案

这是当前最直接的联调阻塞项。

### Phase B: 补回知识点建议流

必须做到：

- stream 增加 `knowledge-point-suggestion`
- 增加 suggestion confirm / dismiss API
- repository 能持久化 pending suggestion 和确认结果

这一步完成后，前端可以重新接回 project chat 里的知识点建议卡，但这次以 backend contract 为准。

### Phase C: 补 project object 持久化与 bootstrap

必须做到：

- project 创建和编辑不再只靠前端本地 store
- bootstrap 时生成初始 knowledge points、project memory、project learning profile、初始 project session

这一步不是当前 stream 联调的硬阻塞，但它是 closing product gap 的必要项。

## File-Level Changes

### `apps/agent/src/xidea_agent/state.py`

新增或调整：

- `ProjectContext`
- `KnowledgePoint`
- `KnowledgePointState`
- `ProjectLearningProfile`
- `KnowledgePointSuggestion`
- `KnowledgePointSuggestionEvent`
- `ActivityEvent` 如果当前还只是前端本地类型，要在 backend schema 正式化

当前 `StreamEvent` 需要至少扩成：

- `diagnosis`（过渡保留）
- `text-delta`
- `activity`
- `knowledge-point-suggestion`
- `plan`（过渡保留）
- `state-patch`
- `done`

当前 `GraphState` 需要新增：

- `project_context`
- `project_memory`
- `project_learning_profile`
- `knowledge_points`
- `knowledge_point_suggestions`

原则：

- `AgentRequest.topic`、`context_hint` 只能当 hint，不是权威 project context
- backend 内部判断使用 repository / preload 结果，不使用前端拼出来的 project narrative 当 source of truth

### `apps/agent/src/xidea_agent/repository.py`

当前已有：

- `projects`
- `threads`
- `thread_messages`
- `thread_context`
- `learner_unit_state`
- `review_state`
- `review_events`

下一步最少补：

- `projects` 表字段扩展：`title`、`description`、`special_rules`
- `knowledge_points`
- `knowledge_point_state`
- `project_learning_profiles`
- `project_memories`
- `project_materials`
- `session_attachments`
- `knowledge_point_suggestions`

最少方法：

- `get_project_context(project_id, session_id)`
- `list_project_knowledge_points(project_id)`
- `save_knowledge_point_suggestion(...)`
- `resolve_knowledge_point_suggestion(...)`
- `create_or_update_project_memory(...)`
- `create_or_update_project_learning_profile(...)`

### `apps/agent/src/xidea_agent/tools.py`

新增 `project-context` 层能力。

可以是显式 `ToolIntent`，也可以在 `load_context_step()` 内直接 preload，但输出对象至少要统一包含：

- project topic / description
- special rules
- selected session attachments
- project material summaries
- existing knowledge points
- recent session context
- project memory
- project learning profile

如果保留 tool 形式，建议新增：

- `project-context`

不要继续把这层散落在 `asset-summary`、`thread-memory` 和前端 request hint 之间。

### `apps/agent/src/xidea_agent/runtime.py`

推荐主顺序：

1. `load_project_context_step`
2. `load_session_context_step`
3. `diagnose_step`
4. `decide_action_step`
5. `maybe_tool_step`
6. `maybe_emit_activity_step`
7. `maybe_emit_knowledge_point_suggestion_step`
8. `compose_response_step`
9. `writeback_step`

硬规则：

- `activity` 由 backend 明确生成；不再假设前端会根据 `diagnosis / plan` 自己补
- knowledge point suggestion 由 backend 明确生成；不再假设前端会自己猜
- off-topic 在 runtime 内判断，并阻止 memory / knowledge point / activity 写回

### `apps/agent/src/xidea_agent/api.py`

保留现有读取接口，同时新增：

- `POST /projects/{project_id}/knowledge-point-suggestions/{suggestion_id}/confirm`
- `POST /projects/{project_id}/knowledge-point-suggestions/{suggestion_id}/dismiss`

建议下一步再补，但不作为当前 web stream 联调阻塞：

- `POST /projects`
- `PATCH /projects/{project_id}`
- `GET /projects/{project_id}`

## Runtime Requirements

### 1. Activity Emission

当前 web 要求：

- 当 backend 判断当前轮应该进入学习动作时，必须发出 `activity`
- 没有 `activity` 时，前端只显示对话，不会再脑补学习卡

最小 `activity` payload 需要覆盖：

- `id`
- `kind`
- `knowledge_point_id`
- `title`
- `objective`
- `prompt`
- `support`
- `mode`
- `evidence`
- `submit_label`
- `input`

### 2. Knowledge Point Suggestion Emission

当前产品要求：

- project chat 可建议新增知识点
- archive 走“系统建议 + 用户确认”

统一做成：

- `knowledge-point-suggestion` 独立事件
- `kind: create | archive`
- `status: pending | accepted | dismissed`

### 3. Off-Topic Guardrail

必须由 backend 判断，命中后：

- 允许发简短提醒文本
- 不写 `ProjectMemory`
- 不新增 `KnowledgePoint`
- 不发学习 / 复习 `activity`
- 不发 create / archive suggestion

### 4. Writeback

writeback 至少覆盖：

- `KnowledgePointState`
- `ProjectLearningProfile`
- `ProjectMemory`
- `ReviewState`
- `ReviewEvent`

不要只更新 `thread` 级 learner state，而不把 project 级对象一起推进。

## Frontend Integration Notes

当前前端已经做好的部分：

- session 消息流渲染
- materials tray
- activity gating
- review inspector / asset summary / thread context hydration
- project meta 快捷入口
- knowledge point detail / archive UI

因此 backend 对接时要注意：

- 可以继续发 `diagnosis / plan` 作为过渡兼容
- 但学习动作一定要发显式 `activity`
- `knowledge-point-suggestion` 可以现在就开始发；当前 web 会安全忽略，后续再补消费
- 不要依赖前端发来的 demo project 文案做最终判断

## Acceptance Checklist

新 session 按这份文档实现后，至少应满足：

### A. 当前 web 联调通过

- `project / study / review` session 都能继续跑 `/runs/v0/stream`
- study / review 场景能收到显式 `activity`
- 完成 activity 后，下一轮诊断与状态回写能更新 inspector 读取接口
- materials tray 选中的材料能进入 backend 判断

### B. 不再需要前端 heuristic

- 前端不需要本地合成 activity
- 前端不需要本地生成 knowledge point suggestion
- 前端不需要本地推导 project learning profile 判断

### C. 结构化 suggestion 可恢复产品需求

- backend 能在 project chat 发出 `knowledge-point-suggestion`
- backend 能处理 confirm / dismiss
- suggestion 确认后知识点池发生真实后端写回

## Test Checklist

至少补这些测试：

- `test_stream_emits_activity_for_study_session`
- `test_project_chat_can_emit_create_knowledge_point_suggestion`
- `test_off_topic_does_not_emit_activity_or_suggestion`
- `test_confirm_create_suggestion_writes_knowledge_point`
- `test_confirm_archive_suggestion_updates_knowledge_point_state`
- `test_project_context_is_loaded_from_repository_not_frontend_hint`

## Reading Shortcut For A Fresh Session

如果下一次是新开的学习引擎实现 session，建议按这个顺序读：

1. [../spec.md](../spec.md)
2. [../status.md](../status.md)
3. [../plan.md](../plan.md)
4. [../process/shared-boundary-freeze.md](../process/shared-boundary-freeze.md)
5. 这份文档
6. `apps/agent/src/xidea_agent/state.py`
7. `apps/agent/src/xidea_agent/repository.py`
8. `apps/agent/src/xidea_agent/runtime.py`
9. `apps/agent/src/xidea_agent/api.py`
