# Shared Boundary Freeze

这份文档冻结并行开发前必须统一的共享边界。
当前目标是让前后端围绕同一套对象、事件流、提交 contract 和页面结构推进，而不是在实现过程中继续争论对象语义。

这轮只冻结共享边界，不冻结具体实现方式。

## 1. Core Object Model

当前主对象冻结为：

- `Project`
- `Session`
- `KnowledgePoint`
- `ProjectLearningProfile`

关键配套状态对象冻结为：

- `KnowledgePointState`
- `ProjectMaterial`
- `SessionAttachment`
- `ProjectMemory`

### `Project`

- `id`
- `title`
- `topic`
- `description`
- `special_rules: string[]`
- `status`
- `created_at`
- `updated_at`

### `Session`

- `id`
- `project_id`
- `type: project | study | review`
- `title`
- `status: active | closed`
- `focus_knowledge_point_ids: string[]`
- `current_activity_id?`
- `created_at`
- `updated_at`

### `KnowledgePoint`

- `id`
- `project_id`
- `title`
- `description`
- `status: active | archived`
- `origin_type`
- `origin_session_id?`
- `source_material_refs: string[]`
- `created_at`
- `updated_at`

### `ProjectLearningProfile`

- `id`
- `project_id`
- `stage`
- `weak_points: string[]`
- `preferences: string[]`
- `freshness`
- `updated_at`

### `KnowledgePointState`

- `knowledge_point_id`
- `mastery`
- `learning_status`
- `review_status`
- `next_review_at`
- `archive_suggested`
- `updated_at`

### `ProjectMaterial`

- `id`
- `project_id`
- `kind`
- `title`
- `source_uri`
- `content_ref`
- `summary`
- `status`
- `created_at`
- `updated_at`

### `SessionAttachment`

- `id`
- `session_id`
- `project_material_id`
- `role`
- `attached_at`

### `ProjectMemory`

- `id`
- `project_id`
- `summary`
- `key_facts: string[]`
- `open_threads: string[]`
- `updated_at`

### Frozen Conclusions

- `KnowledgePoint` 正式替代当前 `LearningUnit`
- `ProjectLearningProfile` 只保留 project 级聚合信息
- `KnowledgePointState` 承担点级动态学习状态
- `Session` 正式替代 `thread`
- 从文档、TypeScript 类型和 API contract 开始统一使用 `session`
- 数据库表名或迁移脚本中允许暂时保留 `thread` 作为遗留实现名词，但不再扩展其产品语义
- `source_material_refs: string[]` 只能引用 `ProjectMaterial.id`
- project 级长期材料池和 session 级挂载关系必须分开
- `KnowledgePoint` 的来源追踪指向 `ProjectMaterial.id[]`
- `ProjectMemory` 是 project 级长期编排摘要，不是消息历史，也不是学习画像

## 2. Event Contract

SSE 目标事件集合冻结为：

- `text-delta`
- `activity`
- `knowledge-point-suggestion`
- `tool-result`
- `state-patch`
- `done`

### `activity`

事件名固定为 `activity`。
payload 结构固定为：

```json
{
  "event": "activity",
  "run_id": "run_xxx",
  "session_id": "session_xxx",
  "activities": []
}
```

`Activity` 最小 schema：

- `id`
- `kind`
- `knowledge_point_id`
- `prompt`
- `options?`
- `required`
- `submit_label`
- `meta: Record<string, unknown>`

### `tool-result`

`ToolResult` 最小 schema：

- `tool_name`
- `target_type`
- `target_id`
- `summary`
- `payload`
- `meta: Record<string, unknown>`

### `knowledge-point-suggestion`

事件名固定为 `knowledge-point-suggestion`。
payload 结构固定为：

```json
{
  "event": "knowledge-point-suggestion",
  "run_id": "run_xxx",
  "session_id": "session_xxx",
  "suggestions": []
}
```

`KnowledgePointSuggestion` 最小 schema：

- `id`
- `kind: create | archive`
- `project_id`
- `session_id`
- `knowledge_point_id?`
- `title`
- `description`
- `reason`
- `source_material_refs: string[]`
- `status: pending | accepted | dismissed`

### `done`

`done` 不要求一定带最终文本回复，但必须带收尾所需元信息。

建议最小字段：

- `run_id`
- `session_id`
- `status`
- `completed_at`

### Frozen Conclusions

- `plan` 不再作为目标 contract 的正式事件，只保留过渡兼容
- 第一版即使只发 1 张卡，也走 `activities[]`
- 第一版选择题 activity 至少要有 `id / kind / knowledge_point_id / prompt / options / required / submit_label`
- `tool-result` 只发结构化低噪声结果，不发原始内部 dump
- `knowledge-point-suggestion` 作为独立事件存在，不并入 `tool-result` 或 `state-patch`
- 第一版允许只发单条 suggestion，但事件层统一走 `suggestions[]`

## 3. Activity Submission Contract

第一版继续走同一个 run/chat 通道，不单独开 submit endpoint。

最小 payload 冻结为：

- `run_id`
- `project_id`
- `session_id`
- `activity_id`
- `knowledge_point_id`
- `result_type: exercise | review`
- `action: submit | skip`
- `answer`
- `meta: Record<string, unknown>`

### Frozen Conclusions

- `exercise-result` 和 `review-result` 都保留，用 `result_type` 区分
- `skip` 作为同一 result contract 里的 `action`
- 前端先只传单个 `knowledge_point_id`

## 4. Persistence Boundary

当前冻结的持久化对象为：

- `Project`
- `Session`
- `SessionMessage`
- `KnowledgePoint`
- `KnowledgePointState`
- `ProjectLearningProfile`
- `ProjectMaterial`
- `SessionAttachment`
- `ProjectMemory`
- `ReviewState`
- `ReviewEvent`
- `KnowledgePointSuggestion`

### Boundary Notes

- `KnowledgePoint` 存定义、来源和静态信息
- `KnowledgePointState` 存动态学习状态
- `ProjectLearningProfile` 存 project 级聚合画像
- `ProjectMemory` 存 project 级长期记忆摘要
- `ProjectMaterial` 存 project 级长期材料池
- `SessionAttachment` 存 session 与材料的挂载关系
- `SessionMessage` 只存消息，不承担业务状态
- `KnowledgePointSuggestion` 存待确认的新增 / archive 建议及其处理状态
- `run_id` 是协议级共享概念，不要求作为长期主对象落库
- `ToolResult` 默认不作为长期主对象持久化，除非后续明确需要回放或审计

## 5. Suggestion Resolution Contract

`knowledge-point-suggestion` 的确认与忽略不走自由文本消息，先冻结为显式 API：

- `POST /projects/{project_id}/knowledge-point-suggestions/{suggestion_id}/confirm`
- `POST /projects/{project_id}/knowledge-point-suggestions/{suggestion_id}/dismiss`

确认后最小返回：

- `suggestion`
- `knowledge_point?`
- `knowledge_point_state?`

### Frozen Conclusions

- `confirm` / `dismiss` 必须幂等
- `create` suggestion 确认后写入 `KnowledgePoint` 与对应 `KnowledgePointState`
- `archive` suggestion 确认后更新已有 `KnowledgePoint` / `KnowledgePointState`
- 不允许由前端直接写 knowledge point pool 来绕过 suggestion resolution API

## 6. Page Information Architecture

页面结构正式冻结为：

- `App Home`
- `Project Workspace`
- `Knowledge Point Detail`

同时冻结以下规则：

- 默认主区是 knowledge point list
- session 只在用户明确进入时展开
- detail 是独立页，不是常驻侧栏或抽屉
- `project chat` 是 `Project Workspace` 里的一个 `project` session，不是单独入口

## 7. Project Creation Flow

输入冻结为：

- `topic`
- `description`
- `initial_materials`
- `special_rules: string[]`

输出至少包括：

- `Project`
- `ProjectMemory`
- `ProjectLearningProfile`
- 初始 `KnowledgePoints`
- 初始 `project` session

### Current Consensus

- 第一版同步生成 knowledge points
- 同步生成 project memory 和 learning profile
- AI 自动找资料不作为主路径

## 8. Knowledge Point Lifecycle

来源先冻结为：

- `bootstrap`
- `project_chat`
- `manual`

状态流先冻结为：

- `active_unlearned`
- `active_learning`
- `active_review`
- `archived`

### Additional Rules

- 可编辑字段先收敛为 `title / description / source_material_refs`
- 学过至少一次后进入复习态
- archive 先走“系统建议 + 用户确认”
- archive 后允许恢复

## 9. Off-Topic Guardrail

产品规则先冻结为：

- 后端判定是否明显偏离当前 project `topic` 或 `special_rules`
- 可以简短回复提醒
- 不写 `ProjectMemory`
- 不新增 `KnowledgePoint`
- 不触发学习或复习 `activity`

## 10. Consolidation Entry

当前只冻结演示策略：

- 手动触发优先
- 可预留模拟定时入口
- 暂不做复杂 UI，只保留接口和最小触发点

## Final Freeze

- 正式废掉 `thread`，统一成 `Session`
- 正式用 `KnowledgePoint` 替代 `LearningUnit`
- `ProjectLearningProfile` 只保留 project 级聚合信息
- `KnowledgePointState` 承担点级动态学习状态
- 新增 `ProjectMaterial / SessionAttachment` 作为正式共享材料模型
- `ProjectMemory` 冻结为 project 级长期摘要对象
- SSE 正式目标切到 `text-delta / activity(activities[]) / knowledge-point-suggestion(suggestions[]) / tool-result / state-patch / done`
- `Activity / ToolResult` 冻结最小 schema
- `run_id` 升成正式共享运行态概念
- 页面正式冻结为 `App Home -> Project Workspace -> Knowledge Point Detail`
