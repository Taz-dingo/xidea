# Full PPT Design

Date: 2026-04-22
Topic: Xidea 比赛答辩完整 PPT 设计

## Context

当前比赛版已经有一条可讲的最小闭环，但整体答辩 PPT 还缺一套完整、统一、可执行的结构设计。

本设计要解决的问题不是“再补几页内容”，而是把以下几件事收成同一条叙事主线：

- 为什么这件事值得做
- Xidea 到底是什么，不是什么
- 当前比赛版如何承载这个产品判断
- Demo 如何作为证据，而不是单独表演
- 技术方案如何和产品主张一一对应

## Audience And Constraints

- 答辩陈述时间：5 到 6 分钟
- 超时会被打断
- 评委画像：技术 leader 为主，同时关注 AI 产品创新机会
- PPT 风格：中文为主，关键词保留英文
- 视觉方向：技术产品感为底，AI 创新 pitch 感为抬升
- 需要同时兼容：
  - 主讲 PPT
  - 局部预录视频 / 动图
  - 单独 demo 主链

## Core Narrative

整套 PPT 的核心叙事固定为：

1. 过去的学习产品分别覆盖问答、材料理解、练习和复习中的单个环节
2. 把这些环节整合进同一个系统，不是为了功能更多，而是为了获得更完整的学习上下文
3. 只有在上下文更完整的前提下，系统才可能更准确地发现问题、整理用户画像、更新学习状态，并安排后续学习与复习
4. Xidea 要做的不是另一个单点学习工具，而是一个按学习主题 `scope` 组织、持续推进的 AI 学习编排系统
5. 当前比赛版先用 grounded 的材料上传路径跑通最小闭环，证明这套系统形态成立

## Value Chain

整合多个学习环节的意义，需要在答辩里被明确讲成因果链：

1. 整合多个学习环节
2. 系统拿到更完整、更连续的学习上下文
3. 系统更容易发现用户的理解问题、混淆点、学习画像和当前状态
4. 系统可以更合理地安排研讨、学习和复习
5. 用户更容易理解自己的学习状况，并在后续持续推进同一个学习主题

统一表达：

`整合的意义，不是把更多功能放到一起，而是让系统获得更完整的学习上下文，从而更准确地理解用户状态，并持续安排后续学习。`

## Current MVP And Long-Term Vision

长期愿景不是只围绕材料上传：

- 用户可以通过聊天逐步澄清自己要学什么
- AI 可以帮助搜集相关信息，辅助确定学习 `scope` 的边界
- 系统再基于这些上下文生成知识点、组织 session、推进后续学习

但当前比赛版不直接把这个愿景单独拿出来展开，而是采用以下表达原则：

- 前面轻提：长期上 `scope` 可以来自聊天、材料导入和 AI 辅助搜集
- 当前比赛版先从最 grounded 的材料上传入口出发
- 这样做不是缩窄产品边界，而是为了先证明最关键的学习编排闭环成立

统一口径：

`长期上，我们希望 AI 能参与学习 scope 的发现和边界确定；当前比赛版先从最 grounded 的材料上传入口出发，证明学习编排闭环可以成立。`

## Case Framing

主案例收敛为：

`围绕 LLM 主题进行持续学习`

但演示中不选过深知识点，而选评委更容易直观看懂的浅层知识点。案例应同时满足两点：

- 外层上像一个完整学习主题，而不是单个问答
- 内层上足够浅显，便于评委快速判断系统是否真的在“安排学习”

适合的演示知识点类型：

- `prompt` 和 `context` 的区别
- `pretraining`、`instruction tuning`、`RAG` 分别解决什么问题
- 什么场景更适合 `RAG`
- 为什么“会聊天”不等于“真正理解”

## Deck Strategy

整套 PPT 分为：

- 主讲版：23 页左右，服务正式陈述
- 附录版：4 到 6 页，服务追问、补充说明和备用截图

整体组织采用混合型结构：

1. 机会与产品判断
2. 产品定义与系统主线
3. 功能介绍与局部证据
4. Demo 主链
5. 技术方案
6. 收尾

## Main Deck Structure

### Module A: 开场与机会

#### Slide 1

封面

要求：

- 标题直接落在产品定义上，不只写项目名
- 强视觉封面，不放长文

#### Slide 2

一句话定义

推荐主句：

`用 AI 把分散的学习环节重新整合成持续学习系统`

#### Slide 3

竞品格局

目的：

- 快速说明现有产品分别覆盖不同学习环节
- 证明“为什么值得做新一层产品”

要求：

- 图表页，不做长文
- 只点出 `Anki / tutor / 语言训练 / 材料理解` 的分散格局

#### Slide 4

为什么要做整合

目的：

- 讲清整合带来的价值链

适合形式：

- 箭头图或流程图

#### Slide 5

核心判断

推荐主句：

`学习编排层，才是新的产品机会`

### Module B: 产品定义与系统主线

#### Slide 6

我们是什么，不是什么

要求：

- 左右对照页
- 明确说清 Xidea 不是 AI tutor、不是 AI summary、不是单点刷题工具

#### Slide 7

按学习主题 `scope` 组织持续学习

要求：

- 主讲 `scope`
- `Project` 只作为当前比赛版承载壳出现，不当成一级主张

#### Slide 8

产品总览图

主线固定为：

`scope -> materials -> knowledge points -> sessions -> feedback -> next round`

#### Slide 9

当前比赛版如何收敛

要求：

- 轻量桥接当前 MVP 与长期愿景
- 强调当前比赛版为什么从 grounded material flow 起步

### Module C: 功能介绍与局部证据

#### Slide 10

材料如何变成知识点

要求：

- 证明材料不会只被总结，而会变成知识点对象
- 适合用截图 + 标注，或局部动图

#### Slide 11

为什么需要研讨 `session`

要求：

- 解释研讨不是闲聊，而是在整理学习对象和边界
- 适合放短录屏

#### Slide 12

为什么学习和复习要分开

要求：

- 左右对比页
- 说明两类 session 的状态依据和作用不同

#### Slide 13

复习反馈如何驱动持续学习

要求：

- 循环图页
- 明确解释反馈如何进入下一轮安排

#### Slide 14

画像 / 热力图 / 状态视图

要求：

- 只证明系统真的在维护状态
- 不展开具体算法

#### Slide 15

功能证据拼图页

要求：

- 截图、动图缩略图、关键界面拼贴
- 不承载新概念，只承载真实感

### Module D: Demo 主链

#### Slide 16

Demo 导航

主链固定为：

`LLM 学习 scope -> 导入材料 -> 生成知识点 -> 学习 / 复习 -> feedback`

#### Slide 17

Demo 演示页 1

建议内容：

- 前半链路
- `scope / materials / knowledge points`

#### Slide 18

Demo 演示页 2

建议内容：

- 后半链路
- `session / feedback / next round`

### Module E: 技术方案

#### Slide 19

技术方案总览

推荐标题：

`Agent + Memory 如何支撑学习编排闭环`

#### Slide 20

Agent

主线：

`状态 -> 决策 -> 动作`

要求：

- 不讲成 LangGraph 教程
- 重点说明不是 chat + tools

#### Slide 21

Memory

要求：

- 明确回答 4 个问题：
  - 记录什么
  - 如何组织
  - 如何更新
  - 如何变成给 LLM 的上下文

#### Slide 22

闭环收口

要求：

- 说明 Agent 和 Memory 为什么一起构成持续学习系统
- 作为技术方案结论页

### Module F: 收尾

#### Slide 23

结论 / 展望

统一结论：

`别人解决学习中的单点，我们解决跨环节的判断、组织与持续推进。`

展望只轻提，不展开。

## Appendix Structure

附录建议包含：

1. 竞品补充表
2. 技术细节补充：状态对象 / memory 分层
3. 当前 MVP 与长期愿景边界
4. 路线图
5. 备用 demo 截图页
6. Q&A 备用页

## Slide Media Allocation

### Best Use Of Graphics

最值得专门做的 4 张图：

1. 学习环节分散图
2. 整合价值链图
3. 产品主线图
4. Agent + Memory 闭环图

### Best Use Of Pre-Recorded Clips

最值得提前录的 4 段录屏：

1. 材料上传 -> 生成知识点
2. 研讨 `session`
3. 学习 / 复习 `session`
4. feedback 回流 / 状态视图

其中前三段优先级最高。

### What Can Stay Static

更适合静态图或截图的内容：

- 竞品格局
- 我们是什么，不是什么
- `scope` 组织方式
- 画像 / 热力图概览
- Memory 分层结构
- Agent 闭环总览

## Media Strategy

整体采用混合策略：

- 功能介绍部分适合插入预录片段 / 动图
- 单独 demo 模块保留一条现场主链
- 如果现场效果不稳，可以回切预录素材，不中断叙事

## Text Density Rules

整套 deck 遵循硬规则：

`页上只写结论和结构，复杂推理留给口播。`

### Write On Slides

适合直接写成标题句的内容：

- 我们的产品定义
- 学习编排层的核心判断
- `scope`、知识点、session、feedback 的主关系
- `Agent + Memory` 的技术总判断

### Keep For Voiceover

适合留给口播的内容：

- 为什么当前比赛版先从 material-first 起步
- chat-first / AI-assisted `scope` discovery 的长期愿景
- 竞品细比
- 当前实现的局限、速度问题和效果仍在收敛
- 技术实现背后的更细框架细节

## Current vs Vision Guidance

整套 deck 中需要明确区分三类表达：

### Vision

允许偏愿景的部分：

- 机会判断
- 长期产品边界
- chat-first / AI-assisted `scope` discovery
- 多模态与更完整复习系统

### Current MVP

必须只讲当前已成立的部分：

- grounded material flow
- 知识点生成
- study / review 最小闭环
- feedback 回流
- 当前状态视图与 project-level 整理能力

### Bridge

需要桥接表达的部分：

- 当前比赛版为什么先收敛到材料上传
- 为什么 `Project` 是当前承载壳，而不是长期唯一形态
- 技术方案如何既支持当前闭环，也保留未来扩展边界

## Module Promises

### Opportunity Module

证明：

- 这不是另一个零散功能产品，而是一个值得成立的新产品层

### Product Module

证明：

- 系统主对象和主链已经被合理收敛

### Evidence Module

证明：

- 当前最小闭环已经真实跑通

### Tech Module

证明：

- 不是前端拼页面，而是 Agent + Memory 在支撑学习编排

### Closing Module

证明：

- 产品判断、证据和技术方案可以收成同一个结论

## Time Compression Rules

如果临场被压时间，优先保留：

1. 机会判断
2. 产品主线图
3. 材料 -> 知识点
4. 反馈如何驱动持续学习
5. Demo 主链
6. Agent + Memory

优先删减：

- 竞品细节
- 研讨 `session` 细讲
- 热力图和画像展开
- 框架实现细节

## Presentation Tone

推荐风格：

- 中文为主，关键词保留英文
- 技术产品感为底
- AI 创新 pitch 感为抬升
- 不走教育产品风格
- 不用过多工程黑话

推荐保留英文的词：

- `scope`
- `session`
- `agent`
- `memory`
- `feedback`

## Acceptance Check

本设计成立的标准是：

- 评委能理解为什么值得做“学习编排层”
- 评委不会把 Xidea 误解成普通 AI tutor 或 AI summary 工具
- 评委能复述当前比赛版如何承载这套产品判断
- Demo 能作为最小闭环证据，而不是单独表演
- 技术方案能解释为什么这不是 chat + tools
