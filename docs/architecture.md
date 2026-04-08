# 系统骨架

## 核心模块

### 1. Content Ingestion

输入各种学习材料：

- 文本
- 图片
- 音频
- 视频
- 网页
- PDF
- 笔记

输出统一的 `SourceAsset`。

### 2. Knowledge Distillation

从原始材料中提炼出：

- 概念
- 技能
- 事实
- 易混点
- 前置依赖
- 推荐训练方式

输出 `LearningUnit` 和 `KnowledgeGraphSlice`。

### 3. Learner Diagnosis

根据用户历史表现判断：

- 是否真正理解
- 是否只是短时记住
- 哪些概念容易混淆
- 哪种训练方式更有效

输出 `LearnerState`。

### 4. Session Planner

根据 `LearningUnit + LearnerState` 规划本轮学习路径：

- 先讲解
- 先提问
- 先看图识别
- 先听音回答
- 先做对比
- 先做情境模拟

输出 `StudyPlan`。

### 5. Tutor Runtime

执行每一步学习动作：

- 苏格拉底式追问
- 1v1 教师问答
- 语音对练
- 看图识别
- 听音回答
- 视频理解
- 情境模拟

### 6. Memory Loop

把结果写回长期状态：

- 记忆稳定度
- 理解深度
- 常见错误类型
- 最有效训练方式

## 当前分层

### `apps/web`

负责：

- 页面
- 交互
- 学习状态可视化
- planner 输出展示

### `apps/agent`

负责：

- 输入理解
- 用户画像更新
- 路径编排
- 训练动作选择
- 记忆回写

## MVP 建议边界

比赛版先做：

- 文本 / PDF / 网页输入
- 学习者状态建模
- 2 到 3 种训练模式切换
- 一条能解释“为什么这样安排”的动态学习路径 demo

先不做：

- 复杂视频理解
- 真实实时语音链路
- 完整 spaced repetition 引擎
- 多人协作学习社区

## Web 目录建议

- `apps/web/src/app`: 页面和编排层
- `apps/web/src/components`: 复用组件
- `apps/web/src/data`: demo 数据
- `apps/web/src/domain`: 类型与纯函数

## Agent 目录建议

- `apps/agent/src/xidea_agent/state.py`: 核心状态模型
- `apps/agent/src/xidea_agent/graph.py`: 编排节点和图定义
- `apps/agent/src/xidea_agent/api.py`: 对外服务接口
