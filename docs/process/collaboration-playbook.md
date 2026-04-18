# Collaboration Playbook

## Goal

三个人协作时，优先保证：

1. `main` 始终可演示
2. 每个人都能并行推进
3. 重要背景和决策不会只留在聊天里

## Roles

### 产品 owner

- 负责比赛 story
- 控范围和优先级
- 维护 `docs/reference/product-brief.md`

### 学习引擎 owner

- 负责学习状态、diagnosis / plan / state-patch contract、planner、规则
- 维护 `apps/agent/src/xidea_agent`、agent API、repository、runtime 和相关文档

### 前端 owner

- 负责页面、交互、演示稳定性
- 维护 `apps/web/src/app/` 和 `apps/web/src/components/`

## Current Workstream Split

当前 v0 默认按三条主线并行：

- 学习引擎主线：稳定 `apps/agent` 的 schema、runtime、storage、guardrails、tests 和 `/runs/v0`
- 前端主线：稳定 `apps/web` 的 demo flow、证据链展示，并接入真实 agent 返回
- 产品 / demo 叙事主线：稳定比赛故事线、页面讲述顺序、范围取舍、答辩表述和 demo script

当前这一轮如果前端已基本收口，允许把学习引擎主线临时再拆成 backend / agent 两条并行子线：

- backend 子线：主改 `state.py`、`repository.py`、`api.py`，负责 schema、storage、Project 创建 / bootstrap、session/material contract
- agent 子线：主改 `runtime.py`、`llm.py`、`tools.py`、`activity_results.py`、`review_engine.py`、`knowledge_points.py`，负责主决策链路、prompt、tool arbitration、知识点 lifecycle、writeback

这条拆分默认只服务当前执行阶段，不替代长期 owner 结构。

这三条主线的默认边界是：

- 学习引擎 owner 不主动改前端展示结构，除非为了联调修复明确的小接口问题
- 前端 owner 不主动改 agent contract，除非先和学习引擎 owner 对齐字段变化
- 产品 / demo 叙事 owner 可以调整 story、文案、演示顺序和证明重点，但涉及代码边界变化时要先同步相关技术 owner
- 前端 owner 不负责补 learning-engine judgment：不在 `apps/web` 本地生成知识点建议、archive 建议、off-topic 判定、activity contract 或 project-level writeback 语义
- 如果后端暂时缺 contract，前端只能显式展示“待后端接入 / 暂无结构化事件”，不能把 `diagnosis / plan / state-patch` 二次推导成正式业务对象
- backend / agent 并行时，`state.py` 默认视为热点文件：由 backend 子线主改，agent 子线先通过字段清单或小 PR 对齐需求
- backend / agent 并行时，`docs/process/shared-boundary-freeze.md` 仍是共享 contract source of truth；不要从当前前端实现反推后端语义

## Start-Of-Task Check

每次新开工先做一次轻量路由：

1. 判断当前任务主要属于学习引擎、前端，还是跨 owner 协作
2. 写清楚这次要改的主目录和不打算碰的边界
3. 如果是跨 owner 任务，先说明谁是主 owner，谁只做配合

如果这一步不明确，先补文档、issue 或 PR 说明，不直接开始大范围改代码。

## Branching

采用轻量 trunk-based 协作：

- 长期分支只有 `main`
- 所有人从 `main` 拉短分支
- 分支存活时间尽量不超过 1 到 2 天

命名：

- `feat/<owner>/<topic>`
- `docs/<owner>/<topic>`
- `fix/<owner>/<topic>`
- `refactor/<owner>/<topic>`

## Pull Request Rule

每个 PR 需要回答 3 件事：

1. 改了什么
2. 为什么现在做
3. 有没有影响其他 owner

提 PR 前默认先完成两件事：

- 补齐这次改动对应的 docs 更新，包括 `spec / status / plan / docs/memory` 中真正该更新的部分
- 先做一轮自 review，确认实现、文档、验证和风险说明已经对齐，再交给 reviewer

如果 PR 包含代码改动：

- 默认需要附带测试或验证用例
- 如果当前阶段没有补测试，必须明确写出原因、风险和后续补齐计划

如果影响共享认知，PR 里必须附带对 `docs/memory/` 的更新。

## Daily Cadence

### 每天开始

- 同步 `main`
- 看一眼 `docs/memory/open-questions.md`
- 看一眼 `docs/plan.md`

### 每天结束

- 能合并的 PR 尽量当天合并
- 新决策写入 `decision-log`
- 没解决的问题写入 `open-questions`

## Conflict Handling

如果两个人要改同一块：

- 先明确谁是 owner
- 非 owner 尽量通过 PR 建议，不直接大改
- 必要时先拆成两个 PR，先合基础，再合上层
