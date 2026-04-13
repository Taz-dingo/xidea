# Decision Log

只保留“当前仍生效、后续会反复影响协作或实现”的活跃决策。
更早期、已实现、已替代或过细的历史记录见 [docs/archive/decision-log-history.md](../archive/decision-log-history.md)。

## 2026-04-14 — 决策日志改为活跃薄层

### 决策

`docs/memory/decision-log.md` 不再作为无限追加的历史流水账，而是只保留当前仍生效的关键决策；旧记录归档到 `docs/archive/decision-log-history.md`。

### 原因

- 当前文件已经堆积过多阶段性实现记录，开始影响扫读效率
- 长期记忆应该帮助后续协作，而不是把所有施工过程永久留在主入口
- 主 log 变短后，更容易和 `spec / status / plan` 分工清楚

### 影响

- 新决策先判断是否仍属于“长期、稳定、可复用”的活跃规则
- 已实现、已替代或纯历史背景的记录，优先移动到 archive
- 后续默认先看主 log，再按需回查 archive

## 2026-04-14 — 文档分层与精简规则

### 决策

`docs/` 继续维持 operating docs、process guides、reference docs、archive 四层结构，并主动合并重复参考文档，不让根目录或 reference 层持续膨胀。

### 原因

- 目录结构只是第一步，如果治理规则不跟上，文档还是会重新长回去
- `backlog`、`demo-showcase-strategy`、`scientific-review-integration` 已经和 `plan`、`competition-defense-kit`、`product-brief` 高度重叠
- 文档数量过多会降低新成员进入速度，也会增加 source of truth 漂移风险

### 影响

- `docs/process/*` 作为流程类当前规则，不再被当作普通 reference
- `docs/plan.md` 同时承接近期计划和较远路线图，不再单独维护 `reference/backlog.md`
- demo 展示策略并入 `docs/reference/competition-defense-kit.md`
- 科学复习相关的产品表述收敛到 `docs/reference/product-brief.md`

## 2026-04-13 — 产品定位与比赛证明路径

### 决策

Xidea 的稳定产品定位是“按项目组织的 AI 学习编排系统”；当前比赛版只用“AI 工程师围绕真实项目学习 RAG 系统设计”这个主案例来证明该定位。

### 原因

- 团队需要一个稳定的产品定义，避免退化成问答工具或卡片工具
- 比赛阶段又必须极度收敛，否则主线会被多案例、多功能打散

### 影响

- `spec.md`、`status.md`、答辩文档和 demo 表达都默认围绕主案例收敛
- 这种收敛只作用于比赛证明路径，不改变长期产品边界

## 2026-04-13 — 记忆系统边界

### 决策

`Review Engine`、`Agent Memory` 和 `Consolidation` 是三层不同能力；科学复习是记忆调度子能力，不是产品本体。

### 原因

- 不区分这三层，状态模型、动作选择和后续实现边界都会混乱
- 用户“没懂”和“快忘了”需要完全不同的系统动作

### 影响

- 系统必须同时维护理解状态和记忆状态
- 当前判断顺序默认是先决定学习动作，再决定是否进入复习

## 2026-04-13 — Runtime 与前后端边界

### 决策

第一版继续采用“受约束单 pedagogical agent + Python / LangChain / LangGraph”作为编排核心；`apps/web` 是 interaction shell，`apps/agent` 是 orchestration brain。

### 原因

- 当前阶段更重要的是把“系统会决定你该怎么学”讲清楚，而不是提前复杂化多 agent 结构
- web 侧已经明确需要消息流、chat surface 和状态展示，适合作为交互壳而不是主编排层

### 影响

- `apps/web` 负责交互、消息流、证据链展示和状态可视化
- `apps/agent` 负责状态读取、动作判断、工具调用、guardrail 和写回

## 2026-04-13 — 前端交互壳约束

### 决策

当前比赛版 web 前端默认采用 `shadcn/ui + Vercel AI SDK` 的交互壳，并要求关键前端任务补做真实浏览器验证。

### 原因

- 基础组件和消息流已经收敛到这套栈，继续手写 primitive 或本地消息拼接会增加重复成本
- 前端质量风险已经证明不能只靠静态检查

### 影响

- `apps/web` 优先复用现有 UI 组件与 AI SDK transport
- 前端交付默认补做页面结构、关键交互和 console 检查

## 2026-04-13 — 并行协作与分工路由

### 决策

当前默认按学习引擎、前端、产品 / demo 叙事三条主线并行推进；新任务开始前先判断主 owner、所属 workstream 和编辑边界。

### 原因

- 进入并行开发阶段后，如果不先路由，最容易发生 contract、页面结构和叙事同时漂移

### 影响

- 协作文档、onboarding 和 PR 范围整理都要先表达 workstream 与边界
- 跨 owner 任务需要明确主 owner 和配合 owner

## 2026-04-13 — 分支与 PR 工作流

### 决策

分支命名、短分支协作和 PR 描述模板通过项目级 skills 暴露，作为默认协作入口规则。

### 原因

- 这些请求往往直接进入执行，不会先翻协作文档
- 显式 skill 比散落规则更不容易漏掉

### 影响

- 分支相关请求优先触发 `branch-workflow`
- PR 描述相关请求优先触发 `pr-description`
