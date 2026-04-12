# Decision Log

## 2026-04-12

### 决策

使用 LangGraph StateGraph 搭建最小编排图，5 个节点全部使用规则逻辑 mock 实现。

### 原因

- `plan.md` P0 要求搭出 LangGraph 最小 graph 骨架
- state / action / tool / guardrail 已定义完毕，具备搭建条件
- 规则 mock 足够支撑 demo 演示，不急着接真实模型

### 影响

- `graph.py` 从节点列表升级为可运行的 LangGraph StateGraph
- 5 个节点可独立测试，通过 `compile_graph()` 编译后直接 `invoke()`
- `generate_plan` 节点的规则逻辑与前端 `planner.ts` 保持对齐
- `write_back_memory` 节点集成了 guardrail 检查
- 后续接真实模型只需替换各节点内部实现

## 2026-04-12

### 决策

定义 agent 的 tool 和 guardrail schema，作为受约束单 agent 的行为边界。

### 原因

- `plan.md` P0 要求定义 agent 的 state / action / tool / guardrail
- state 和 action 已有枚举，但 agent 还不知道能调用什么工具、不能做什么
- 文档明确要求"受约束"，guardrail 是约束的代码化表达

### 影响

- 新增 `tools.py`：4 个最小必要工具（状态读取、单元读取、上下文读取、状态回写），全部 mock 实现
- 新增 `guardrails.py`：5 条行为约束规则（诊断优先、不懂不复习、高混淆先澄清、模式匹配、必须解释）
- 后续 LangGraph 节点可直接使用 `TOOL_REGISTRY` 查找工具、在关键节点后调用 `run_all_guardrails` 检查

## 2026-04-12

### 决策

完善 `apps/agent/src/xidea_agent/state.py` 数据模型，使 Python 端与前端 `types.ts` 对齐，并落地文档中要求的双轨状态模型。

### 原因

- Python 端只有 4 字段骨架，无法支撑后续 LangGraph 节点逻辑
- 前端已有完整的 LearningMode / LearnerState / LearningUnit / StudyPlan 类型定义
- `scientific-review-integration.md` 明确要求理解状态和记忆状态分开建模
- agent 的 action 和 mode 需要枚举约束，防止编排行为不可控

### 影响

- 新增 `LearningMode`（6 种训练模式）和 `TrainingAction`（5 种高层动作）两个枚举
- `LearnerState` 扩展为 9 字段，同时覆盖理解状态和记忆状态
- 新增 `SourceAsset`、`LearningUnit`、`StudyPlanStep`、`StudyPlan` 四个模型
- `GraphState` 改为三层结构：输入层 / 诊断层 / 编排输出层
- 后续 LangGraph 各节点可直接读写 `GraphState` 中的对应字段
- Python ↔ 前端通过 snake_case ↔ camelCase 转换保持字段一一对应

## 2026-04-10

### 决策

当前比赛 demo 的编排核心采用受约束的单 pedagogical agent，并在第一版就接入 LangChain / LangGraph 的最小 runtime。

### 原因

- 当前阶段更重要的是把“系统会决定你该怎么学”讲清楚
- 产品愿景更接近“agent 在约束下做教学决策”，而不是固定 workflow
- LangChain / LangGraph 生态值得尽早接入，便于团队边做边学习
- 复杂 graph、tool routing 和多节点 runtime 会提前引入工程噪声
- 团队现在更需要可讲、可演示、可协作的最小闭环

### 影响

- 当前主链路先收敛为“读取状态/上下文 -> agent 决策 -> 必要时调用工具 -> 生成学习动作 -> 回写”
- 第一版就定义清楚 agent 的 `state / action / tool / guardrail`，而不是把主逻辑写成固定 workflow
- LangGraph 先承载一个最小 graph，不急着堆叠多 agent 和复杂节点图
- 只有在多输入链路、多工具调用、中断恢复等需求明确后，再升级到更完整 graph

## 2026-04-10

### 决策

科学复习系统、agent memory 和定时整理系统是三层能力，不能混成同一层。

### 原因

- 科学复习服务学习者，本质是学习域模型与调度逻辑
- agent memory 服务系统本身，用于保存项目上下文、用户偏好和历史决策
- 定时整理系统负责压缩、强化和清理记忆，不直接替代前两者

### 影响

- 后续统一用 `Review Engine / Agent Memory / Consolidation` 三层来描述记忆相关能力
- 复习调度围绕 `learning item` 和掌握状态展开，而不是退化成固定卡片 UI
- agent 可以读取复习结果，但不把复习系统本身建模为 agent memory

## 2026-04-08

### 决策

当前阶段前端降级为最小表达，不追求复杂视觉和大范围功能展示。

### 原因

- 三人协作阶段，复杂 UI 会增加噪声
- 比赛当前更需要稳定表达核心差异点

### 影响

- 页面只保留阶段目标、输入样例、学习状态、路径输出、协作方式
- 后续新增页面前，先确认是否服务于比赛 story

## 2026-04-08

### 决策

统一把 Xidea 定义为 AI 学习编排系统，而不是某一种输入方式或某一种训练方式的产品。

### 原因

- 用户既可能通过材料导入进入系统，也可能通过普通问答进入系统
- 训练形式本身也是可切换的，不能把产品收窄成单一 mode
- 真正的核心差异点是系统在输入、诊断、训练之间做编排

### 影响

- 后续讨论产品时，统一从“输入形式 / 诊断方式 / 训练形式 / 编排逻辑 / 记忆回写”5 层来描述
- demo 可以展示多个能力，但都应服务于同一个编排主线

## 2026-04-08

### 决策

科学复习在 Xidea 中被定义为记忆调度层的子能力，而不是产品本体。

### 原因

- Anki 强在决定复习时机，但不负责决定当前最适合的学习动作
- Xidea 的差异点在于系统先判断用户是没懂、易混淆、需要练习，还是适合复习

### 影响

- 后续状态建模要同时包含理解状态和记忆状态
- 后续 demo 表达要避免把产品退化成“更强的卡片工具”

## 2026-04-08

### 决策

前端采用 TypeScript / React / Tailwind 的 UI 栈，核心编排采用 Python / LangChain / LangGraph 方向。

### 原因

- 前端需要高频快速迭代和更顺手的 UI 表达
- 编排核心优先选择更成熟的 Python agent 生态
- 两层边界清晰，便于后续通过 API contract 连接

### 影响

- repo 目录切换为 `apps/web` 和 `apps/agent`
- 后续需要补前后端 contract 和 graph node 设计
