# Contributing

## Branch Strategy

- `main`: 始终保持可演示、可构建
- 每个人都从 `main` 拉短生命周期分支
- 分支命名统一为 `type/owner/topic`

例子：

- `feat/guang/planner-ui`
- `docs/liuliu/demo-script`
- `fix/chen/build-error`

建议 `type` 只用：

- `feat`
- `docs`
- `fix`
- `refactor`

## Daily Workflow

1. 每天开始前先同步 `main`
2. 开工前先判断当前任务属于哪个 owner / workstream
3. 在自己的短分支上工作
4. 一个分支只做一件事
5. 提 PR 到 `main`
6. 至少一人 review 后再合并

## Ownership

- 产品 / demo 叙事 owner 改 story、范围、文案、答辩材料和 demo script
- 学习引擎 owner 改 `apps/agent/src/xidea_agent`、agent contract、LangGraph runtime、SQLite repository、后端 API 与测试
- 前端 owner 改 `apps/web/src/app`、`apps/web/src/components`、交互和展示，并消费稳定的 agent contract

如果跨 owner 改动较大，先在 PR 里写清楚原因。

## Commit Style

推荐使用简短前缀：

- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `chore:`

## Working Agreement

- 小步提交，避免一个 PR 混太多方向
- 文档和 demo 同步推进，避免只做代码不讲故事
- 重要方案变化先写进 `docs/`
- 改了长期记忆相关内容，要同步更新 `docs/memory/`
- 涉及代码改动的 PR 默认附带测试；如果暂时没有测试，PR 描述里要明确写出原因、风险和后续补齐计划
- 如果一个决定会影响其他两个人，先写入 decision log 再推进
