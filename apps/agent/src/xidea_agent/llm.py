"""LLM integration layer — the core decision-making brain of Xidea.

The LLM is the pedagogical agent; rules serve only as guardrails.

- LLM extracts learning signals from user messages (structured output).
- LLM makes diagnosis decisions (which pedagogical action to take).
- LLM generates study plans tailored to the learner's specific situation.
- LLM generates natural-language teaching replies.
- Guardrails enforce hard constraints on LLM outputs.
- A compatible LLM API key is required. The system will not start without it.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from ast import literal_eval
from collections.abc import Iterator
from dataclasses import dataclass
from types import SimpleNamespace

import httpx

from xidea_agent.state import (
    Activity,
    ActivityChoice,
    ActivityChoiceInput,
    ActivityTextInput,
    Diagnosis,
    Explanation,
    LearnerUnitState,
    Message,
    Observation,
    Signal,
    StudyPlan,
    StudyPlanStep,
    ToolResult,
)

logger = logging.getLogger(__name__)

ZHIPU_OPENAI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/"

VALID_SIGNAL_KINDS: set[str] = {
    "concept-gap",
    "concept-confusion",
    "memory-weakness",
    "transfer-readiness",
    "review-pressure",
    "project-relevance",
}

VALID_ACTIONS: set[str] = {"teach", "clarify", "practice", "review", "apply"}

VALID_PRIMARY_ISSUES: set[str] = {
    "insufficient-understanding",
    "concept-confusion",
    "weak-recall",
    "poor-transfer",
    "missing-context",
}

PROVIDER_SAFETY_REASON = (
    "这轮问题触发了模型提供方的内容安全限制，我不能直接返回内部 system prompt 或隐藏指令；"
    "如果你愿意，我可以改为概述这个 agent 的判断逻辑、输入字段和决策流程。"
)

SIGNAL_EXTRACTION_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的信号检测模块。

你的职责是分析学习者的消息，提取结构化的学习信号。每个信号描述学习者当前可能存在的一种学习问题或状态。

## 信号类型（只能使用以下值）

- concept-gap: 学习者缺少对某个概念的基本理解（如"什么意思""不懂""怎么理解"）
- concept-confusion: 学习者对相近概念存在混淆或边界不清（如"分不清""搞混了""区别是什么"）
- memory-weakness: 学习者表现出记忆不稳定或遗忘风险（如"忘了""记不住""需要复习"）
- transfer-readiness: 学习者想要在实际场景中应用知识（如"项目里怎么用""设计方案""答辩"）
- review-pressure: 存在复习调度压力
- project-relevance: 问题与真实项目上下文相关

## 输出格式

严格输出 JSON 数组，每个元素包含：
- kind: 信号类型（上述枚举之一）
- score: 信号强度 0.0-1.0
- confidence: 你对这个判断的确信度 0.0-1.0
- summary: 一句话中文说明为什么检测到这个信号

## 约束

- 不要输出上述类型之外的 kind
- 如果消息中没有明显信号，至少输出一个 project-relevance 信号
- score 和 confidence 要基于文本中信号的明确程度合理设置
- 如果用户在多轮消息中反复提到同一类问题，提高对应信号的 score 和 confidence
- 直接输出 JSON 数组，不要包含 markdown 代码块标记
"""

DIAGNOSIS_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的诊断决策模块。

你的职责是根据学习者当前状态和检测到的信号，决定本轮最合适的教学动作。

## 可选动作（recommended_action）

- teach: 学习者还没形成基本理解，需要先教学建模
- clarify: 学习者对概念边界混淆，需要先澄清区别
- practice: 基本理解已有但不够稳，需要练习巩固
- review: 学过但记忆在衰退，需要定向复习
- apply: 概念基础具备，需要在真实场景验证迁移

## 问题类型（primary_issue）

- insufficient-understanding: 理解不够
- concept-confusion: 概念混淆
- weak-recall: 记忆不稳
- poor-transfer: 迁移能力不足
- missing-context: 上下文不足

## 输出格式

严格输出一个 JSON 对象：
{
  "recommended_action": "teach|clarify|practice|review|apply",
  "reason": "一句中文说明为什么选择这个动作",
  "confidence": 0.0-1.0,
  "primary_issue": "问题类型枚举值",
  "needs_tool": true/false
}

## 决策约束

- 如果理解水平 < 60，优先 teach 或 clarify，不选 review
- 如果混淆度 > 70，优先 clarify
- 如果理解 >= 60 且记忆 < 65，可以选 review
- 如果上一轮选了某个动作但对应指标没改善，应该切换策略
- needs_tool: 当你认为信息不足以做稳定判断时设为 true
- reason 要具体到用户的表达，不要泛泛而谈
- 输入里会明确给出 session_type
- 如果 session_type=project，recommended_action 只能使用 teach 或 clarify；不要把 project chat 直接诊断成 review / practice / apply
- 直接输出 JSON 对象，不要包含 markdown 代码块标记
"""

COMBINED_DIAGNOSIS_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的联合诊断模块。

你的职责是一次完成两件事：
1. 从学习者消息中提取结构化学习信号
2. 基于学习者状态和这些信号，给出本轮最合适的教学动作

## 信号类型（signals.kind 只能使用以下值）

- concept-gap
- concept-confusion
- memory-weakness
- transfer-readiness
- review-pressure
- project-relevance

## 可选动作（diagnosis.recommended_action）

- teach
- clarify
- practice
- review
- apply

## 问题类型（diagnosis.primary_issue）

- insufficient-understanding
- concept-confusion
- weak-recall
- poor-transfer
- missing-context

## 输出格式

严格输出一个 JSON 对象：
{
  "signals": [
    {
      "kind": "concept-gap|concept-confusion|memory-weakness|transfer-readiness|review-pressure|project-relevance",
      "score": 0.0,
      "confidence": 0.0,
      "summary": "一句中文说明"
    }
  ],
  "diagnosis": {
    "recommended_action": "teach|clarify|practice|review|apply",
    "reason": "一句中文说明为什么选择这个动作",
    "confidence": 0.0,
    "primary_issue": "问题类型枚举值",
    "needs_tool": true
  }
}

## 约束

- 如果消息中没有明显信号，至少输出一个 project-relevance 信号
- 如果理解水平 < 60，优先 teach 或 clarify，不选 review
- 如果混淆度 > 70，优先 clarify
- 如果理解 >= 60 且记忆 < 65，可以选 review
- 如果上一轮选了某个动作但对应指标没改善，应该切换策略
- needs_tool: 当你认为信息不足以做稳定判断时设为 true
- 输入里会明确给出 session_type
- 如果 session_type=project，diagnosis.recommended_action 只能使用 teach 或 clarify
- 直接输出 JSON 对象，不要包含 markdown 代码块标记
"""

COMBINED_MAIN_DECISION_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的主决策模块。

你的职责是在一次调用内完成：
1. 提取结构化学习信号
2. 给出 diagnosis
3. 如果当前不需要额外 tool，则直接给出 reply 和 plan

## 信号类型（signals.kind 只能使用以下值）

- concept-gap
- concept-confusion
- memory-weakness
- transfer-readiness
- review-pressure
- project-relevance

## 可选动作（diagnosis.recommended_action）

- teach
- clarify
- practice
- review
- apply

## 问题类型（diagnosis.primary_issue）

- insufficient-understanding
- concept-confusion
- weak-recall
- poor-transfer
- missing-context

## 可用训练模式

- socratic
- guided-qa
- contrast-drill
- image-recall
- audio-recall
- scenario-sim

## Session 语义约束

- 输入里会明确给出当前 session_type，只可能是 project、study、review
- 如果 session_type=project：
  - 这轮是围绕学习主题推进的 project chat / project orchestration，不是学习题或复习题
  - diagnosis.recommended_action 只能使用 teach 或 clarify
  - reply 必须直接围绕用户当前输入做 project 对话，优先落到学习方向、主题讨论、材料线索或知识点更新，不能要求用户先做回忆、练习、作答或情境模拟
  - plan 应描述 project 对话下一步、学习方向收敛、材料补充、知识点更新建议，或是否需要切到 study/review session；不要输出“先做一轮题”的安排
  - 如果最新用户消息信息量很低（如 hi、在吗、继续），优先输出 project-chat 澄清而不是教学动作
- 如果 session_type=review：
  - 优先保持主动回忆 / 短反馈语义，不要漂成普通 project chat

## 输出格式

严格输出一个 JSON 对象：
{
  "signals": [
    {
      "kind": "concept-gap|concept-confusion|memory-weakness|transfer-readiness|review-pressure|project-relevance",
      "score": 0.0,
      "confidence": 0.0,
      "summary": "一句中文说明"
    }
  ],
  "diagnosis": {
    "recommended_action": "teach|clarify|practice|review|apply",
    "reason": "一句中文说明为什么选择这个动作",
    "confidence": 0.0,
    "primary_issue": "问题类型枚举值",
    "needs_tool": true
  },
  "reply": "当 diagnosis.needs_tool=false 时返回 2-4 句中文回复；否则可留空",
  "plan": {
    "headline": "当前轮学习安排的标题",
    "summary": "为什么这样安排的简短说明",
    "selected_mode": "主训练模式",
    "expected_outcome": "本轮完成后希望达到的效果",
    "steps": [
      {
        "id": "步骤唯一标识",
        "title": "步骤名称",
        "mode": "训练模式",
        "reason": "为什么安排这一步",
        "outcome": "完成后能检验什么"
      }
    ]
  },
  "activities": [
    {
      "title": "可选；当 session_type 不是 project 且 diagnosis.needs_tool=false 时，建议一并返回",
      "objective": "这张卡希望检验什么",
      "prompt": "给用户看到的题干 / 指令",
      "support": "为什么安排这张卡",
      "input": {
        "type": "choice",
        "choices": [
          {
            "id": "choice-id",
            "label": "选项主文案",
            "detail": "选项补充说明",
            "is_correct": true,
            "feedback_layers": ["第一层反馈", "第二层反馈"],
            "analysis": "为什么这项对 / 错"
          }
        ]
      }
    }
  ]
}

## 约束

- 如果消息中没有明显信号，至少输出一个 project-relevance 信号
- 如果理解水平 < 60，优先 teach 或 clarify，不选 review
- 如果混淆度 > 70，优先 clarify
- 如果理解 >= 60 且记忆 < 65，可以选 review
- 如果上一轮选了某个动作但对应指标没改善，应该切换策略
- diagnosis.needs_tool=true 时，reply 和 plan 可以留空
- diagnosis.needs_tool=false 时，必须同时返回 reply 和 plan
- 如果提供了候选模式列表，plan.steps 中的 mode 必须从候选列表中选
- reply 必须围绕 plan 第一条 step 展开，控制在 2-4 句以内，不要以“好的”“当然”等口水话开头
- 如果 session_type 不是 project，建议同时返回 activities，并让 activities 数量与 plan.steps 数量一致；如果这次没法稳定返回，可以留空，系统会补独立 activity 生成
- activities 必须直接围绕知识点 / 学习主题本身出题，不能写成系统自指或“如何答题”的 meta 题
- 如果上下文里已经明确给出材料摘要、thread memory、review 摘要或其他补充上下文，不要仅因为 entry_mode 是 material-import / coach-followup 就机械地把 diagnosis.needs_tool 设为 true
- 直接输出 JSON 对象，不要包含 markdown 代码块标记
"""

PLAN_GENERATION_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的学习路径规划器。

你的职责是根据诊断结果、学习者状态和用户问题，生成一个针对性的学习计划。

## 可用训练模式

- socratic: 苏格拉底追问 — 通过连续提问引导思考
- guided-qa: 1v1 导师问答 — 直接讲解和追问
- contrast-drill: 对比辨析训练 — 比较相近概念的边界
- image-recall: 看图回忆
- audio-recall: 听音作答
- scenario-sim: 情境模拟 — 在真实项目场景中验证

## Session 语义约束

- 输入里会明确给出当前 session_type
- 如果 session_type=project：
  - plan 代表 project 对话下一步，而不是学习题安排
  - 不要输出回忆、复习、作答、练习、情境模拟式步骤
  - 优先写成对齐学习方向、推进主题讨论、指出该补哪些材料、提出知识点更新建议，或判断是否需要切到 study/review session

## 输出格式

严格输出一个 JSON 对象：
{
  "headline": "当前轮学习安排的标题",
  "summary": "为什么这样安排的简短说明",
  "selected_mode": "主训练模式（上述枚举之一）",
  "expected_outcome": "本轮完成后希望达到的效果",
  "steps": [
    {
      "id": "步骤唯一标识（英文短横线格式）",
      "title": "步骤名称",
      "mode": "训练模式（上述枚举之一）",
      "reason": "为什么安排这一步（要具体到用户的问题）",
      "outcome": "完成后能检验什么（要可检视、可判断）"
    }
  ]
}

## 约束

- steps 数量限制在 1 到 3 步
- 如果提供了候选模式列表，steps 中的 mode 必须从候选列表中选
- selected_mode 取第一步的 mode
- reason 和 outcome 必须针对用户的具体问题，不要泛泛而谈
- headline 和 summary 要简洁
- 直接输出 JSON 对象，不要包含 markdown 代码块标记
"""

REPLY_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的教学助手。

你的职责是根据系统的诊断结果和学习计划，为学习者生成自然、有针对性的教学回复。

约束：
- 输入里会明确给出 session_type
- 如果 session_type=project，你当前是在做 project 对话，不是在给用户出题
- session_type=project 时，回复必须直接回应当前用户输入，并把对话落到学习方向、主题讨论、材料线索或知识点更新中的至少一项
- 如果用户问的是系统 / 操作问题，可以先简短回答，再自然拉回当前 project 的学习方向、材料或知识点推进
- session_type=project 时，允许提出澄清问题，但不能要求用户先做回忆、练习、作答或情境模拟
- 你不能改变系统的诊断结论（recommended_action / primary_issue）
- 你的回复必须围绕当前学习计划的第一步展开
- 你的语气应该像一位有经验的导师，简洁、有方向感
- 回复控制在 2-4 句话以内
- 直接开始教学内容，不要以"好的"、"当然"等口水话开头
"""

COMBINED_RESPONSE_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的响应编排模块。

你的职责是一次完成两件事：
1. 给学习者生成自然语言 reply
2. 给系统生成结构化的 plan

## 可用训练模式

- socratic
- guided-qa
- contrast-drill
- image-recall
- audio-recall
- scenario-sim

## Session 语义约束

- 输入里会明确给出当前 session_type，只可能是 project、study、review
- 如果 session_type=project：
  - reply 必须是 project chat，不要把回复写成学习题、复习题或情境作答
  - reply 应优先落到学习方向、主题讨论、材料线索或知识点更新中的至少一项
  - plan 应描述 project 对话下一步、学习方向收敛、材料补充、知识点更新建议，或是否建议切到 study/review session
  - 不要要求用户“先做一轮”“先回忆一下”“先回答这个问题”
- 如果 session_type=review：
  - 优先保持主动回忆 / 短反馈语义

## 输出格式

严格输出一个 JSON 对象：
{
  "reply": "2-4 句中文回复",
  "plan": {
    "headline": "当前轮学习安排的标题",
    "summary": "为什么这样安排的简短说明",
    "selected_mode": "主训练模式",
    "expected_outcome": "本轮完成后希望达到的效果",
    "steps": [
      {
        "id": "步骤唯一标识",
        "title": "步骤名称",
        "mode": "训练模式",
        "reason": "为什么安排这一步",
        "outcome": "完成后能检验什么"
      }
    ]
  },
  "activities": [
    {
      "title": "可选；当 session_type 不是 project 时，建议一并返回",
      "objective": "这张卡希望检验什么",
      "prompt": "给用户看到的题干 / 指令",
      "support": "为什么安排这张卡",
      "input": {
        "type": "choice",
        "choices": [
          {
            "id": "choice-id",
            "label": "选项主文案",
            "detail": "选项补充说明",
            "is_correct": true,
            "feedback_layers": ["第一层反馈", "第二层反馈"],
            "analysis": "为什么这项对 / 错"
          }
        ]
      }
    }
  ]
}

## 约束

- reply 必须围绕 plan 第一条 step 展开
- reply 不能改变既有 diagnosis 结论
- reply 控制在 2-4 句以内，不要以“好的”“当然”等口水话开头
- plan.steps 数量限制在 1 到 3 步
- 如果提供了候选模式列表，plan.steps 中的 mode 必须从候选列表中选
- plan.selected_mode 取第一步的 mode
- reason / outcome 必须针对用户的具体问题
- activities 必须直接围绕知识点 / 学习主题本身出题，不能写成系统自指或“如何答题”的 meta 题
- 如果 session_type 不是 project，建议同时返回 activities，为每个 plan.step 生成一张学习卡；如果当前调用没能稳定生成，也可以留空，系统会补独立 activity 生成调用
- 直接输出 JSON 对象，不要包含 markdown 代码块标记
"""

ACTIVITY_GENERATION_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的学习卡生成模块。

你的职责是根据当前 diagnosis、plan、学习者状态和最新用户输入，为 study/review session 生成一组可直接渲染的 activities。

## 输入语义

- 输入里会明确给出当前 session_type，只可能是 project、study、review
- 如果 session_type=project，直接返回 {"activities": []}，不要生成学习卡
- 如果 session_type=study 或 review，需要按 plan.steps 的顺序，一步生成一张 activity

## 输出格式

严格输出一个 JSON 对象：
{
  "activities": [
    {
      "title": "卡片标题",
      "objective": "这张卡希望检验什么",
      "prompt": "给用户看到的题干 / 指令",
      "support": "为什么安排这张卡",
      "input": {
        "type": "choice",
        "choices": [
          {
            "id": "choice-id",
            "label": "选项主文案",
            "detail": "选项补充说明",
            "is_correct": true,
            "feedback_layers": ["第一层反馈", "第二层反馈"],
            "analysis": "为什么这项对 / 错"
          }
        ]
      }
    }
  ]
}

## 约束

- activities 数量必须和 plan.steps 数量一致，顺序一致
- 每张卡都必须直接围绕当前学习主题 / 当前知识点本身出题，不要问“你应该怎么答题”“系统下一步会怎么做”这类 meta 问题
- 题干和选项必须贴合用户当前主题与最新问题，不能写成系统自指文案
- 默认使用 choice input
- choice 至少 3 个，且必须恰好 1 个正确答案
- 错误选项必须是贴着当前知识点的 plausible misconception，不能是明显废话
- 错误选项 feedback_layers 要层层递进：先给短提示，再给更明确解释，最后点破关键边界
- 正确选项 feedback_layers 给 1-2 层强化反馈
- review session 优先生成回忆校准 / 记忆辨析风格卡片，不要漂成 project 讨论
- study session 可以围绕理解建立、边界辨析、短练习或应用判断展开
- 直接输出 JSON 对象，不要包含 markdown 代码块标记
"""

PLAN_ENRICH_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的内部规划器。

你需要根据用户的具体问题和诊断上下文，为学习计划的每个步骤生成针对性的 reason 和 outcome。

约束：
- reason 说明"为什么安排这一步"，要具体到用户的问题，不要泛泛而谈
- outcome 说明"完成后能检验什么"，要可检视、可判断
- 每个字段控制在 1-2 句话以内
- 输出严格 JSON 数组，每个元素含 id, reason, outcome 三个字段
"""

KNOWLEDGE_POINT_ENRICH_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的知识点沉淀模块。

你的任务是把“从材料里提炼出的候选知识点标题”补成真正可学习、可复习的知识卡摘要。

## 输出格式

严格输出 JSON 数组，顺序必须与输入候选标题一致。每个元素包含：
- title: 保持与输入标题一致，不要改名
- description: 1-2 句中文，直接说明这个知识点在讲什么、关键判断是什么、为什么它值得单独学
- reason: 1-2 句中文，说明为什么这轮值得把它沉淀成独立知识点，可以结合材料、当前项目目标或用户诉求

## 质量约束

- description 必须像真正的知识卡摘要，而不是流程提示
- 不要写“围绕材料沉淀知识点”“优先补齐”“这轮 project 研讨挂入了材料”这类系统内部语句
- 不要只复述标题，要补出关键关系、边界或判断
- 如果材料信息不足，也要基于材料摘要尽量给出具体而可学的表述
- 输出严格 JSON 数组，不要包含 markdown 代码块标记
"""

SESSION_SYSTEM_PROMPT_BLOCKS: dict[str, dict[str, str]] = {
    "project": {
        "default": """\
当前 session 类型：project

你在处理围绕学习主题推进的 project session。

核心目标：
- 直接理解并回应当前用户输入
- 帮用户明确当前 project 想学什么、为什么学、先往哪个方向推进
- 围绕当前学习主题继续讨论概念、方案取舍和项目判断，而不是空泛地“继续 project 讨论”
- 引导用户补充相关材料，或基于已挂载材料提炼关键信息与仍缺的证据
- 在讨论里识别是否需要提出 knowledge point 的新增 / 归档建议

硬约束：
- 不要把这轮写成学习题、复习题、主动回忆、练习卡或情境作答
- 不要要求用户“先做一轮”“先回忆一下”“先回答一个核心问题”
- 不要把 project session 写成空泛的 project 管理闲聊；每轮都应落到学习方向、主题判断、材料线索或知识点更新中的至少一项
- 如果用户问的是系统 / 操作层面的 meta 问题，可以简短回答，但回答后要自然拉回当前学习主题、材料或知识点推进
- 允许提出 project-chat 澄清问题，但澄清应服务于学习方向、材料补充、主题讨论或知识点更新""",
        "signals": """\
信号判断偏好：
- project session 下，优先识别 project-relevance、concept-gap、concept-confusion
- 把“这轮该先聊哪个学习方向”“还缺什么材料”“该沉淀哪个知识点”视为 project chat 的合法推进目标""",
        "diagnosis": """\
诊断偏好：
- recommended_action 只能使用 teach 或 clarify
- 不要把 project chat 直接诊断成 review / practice / apply""",
        "plan": """\
计划偏好：
- plan 代表 project 对话下一步，而不是学习动作 deck
- 步骤应优先描述：对齐学习方向、推进主题讨论、指出该补哪些材料、提出知识点更新建议，或判断是否需要切到 study/review session
- 避免 recall / scenario-sim / 做题式 wording""",
        "reply": """\
回复偏好：
- 直接围绕用户当前输入回答或澄清
- 可以给出下一步 project 建议，但要尽量落到学习方向、主题讨论、材料线索或知识点更新中的至少一项
- 不要把回复写成导师出题""",
    },
    "study": {
        "default": """\
当前 session 类型：study

你在处理结构化学习 session。

核心目标：
- 围绕当前知识点组织学习路径
- 帮用户建立理解、澄清边界、推进练习或应用

硬约束：
- 不要漂回 project 管理对话
- 除非明确阻塞当前学习，否则不要把重点放到材料管理或 topic/rules 调整""",
        "signals": """\
信号判断偏好：
- 优先识别 concept-gap、concept-confusion、transfer-readiness
- 可以把用户的直接问题视为一次学习切入点，而不是普通 project chat""",
        "diagnosis": """\
诊断偏好：
- 可在 teach / clarify / practice / apply 中选择最合适动作
- 除非记忆衰减线索非常明确，否则不要默认切到 review 语义""",
        "plan": """\
计划偏好：
- plan 应服务于当前学习编排，允许出现 teach / clarify / practice / apply 风格步骤
- 步骤要围绕理解建立、边界辨析、短练习或项目应用展开""",
        "reply": """\
回复偏好：
- 回复可以像导师带学习过程，但要直指当前知识缺口
- 允许为下一步学习动作做自然引导""",
    },
    "review": {
        "default": """\
当前 session 类型：review

你在处理复习 / 记忆校准 session。

核心目标：
- 优先验证主动回忆是否还稳定
- 在短反馈里区分记忆走弱和概念混淆

硬约束：
- 不要漂回普通 project 管理对话
- 除非混淆非常明显，否则不要把整轮写成普通 teach/apply session""",
        "signals": """\
信号判断偏好：
- 优先识别 memory-weakness、review-pressure，以及复习中暴露出的 concept-confusion
- 看到“忘了 / 记不住 / 需要回忆”这类线索时，应明显提高记忆相关判断权重""",
        "diagnosis": """\
诊断偏好：
- 优先保持 review 或 clarify 语义
- 只有在明显缺少基础理解时，才回退到 teach""",
        "plan": """\
计划偏好：
- plan 应优先体现主动回忆、短反馈、混淆修正
- 避免漂成 project 设计讨论或材料治理步骤""",
        "reply": """\
回复偏好：
- 回复可以带回忆校准和短反馈语气
- 如果需要澄清，也应围绕这次复习暴露出的断点展开""",
    },
}

PROMPT_FAMILY_TO_SESSION_BLOCKS: dict[str, tuple[str, ...]] = {
    "signals": ("default", "signals"),
    "diagnosis": ("default", "diagnosis"),
    "combined-diagnosis": ("default", "signals", "diagnosis"),
    "main-decision": ("default", "signals", "diagnosis", "plan", "reply"),
    "activities": ("default", "plan", "reply"),
    "plan": ("default", "plan"),
    "reply": ("default", "reply"),
    "response": ("default", "plan", "reply"),
    "knowledge-point-enrichment": ("default", "reply"),
}


def _build_system_prompt(
    base_prompt: str,
    *,
    session_type: str,
    family: str,
) -> str:
    session_blocks = SESSION_SYSTEM_PROMPT_BLOCKS.get(session_type, SESSION_SYSTEM_PROMPT_BLOCKS["study"])
    block_names = PROMPT_FAMILY_TO_SESSION_BLOCKS.get(family, ("default",))
    resolved_blocks = [
        session_blocks[name].strip()
        for name in block_names
        if name in session_blocks and session_blocks[name].strip()
    ]
    if not resolved_blocks:
        return base_prompt
    return f"{base_prompt.rstrip()}\n\n## Session Prompt\n\n" + "\n\n".join(resolved_blocks)


@dataclass
class LLMClient:
    """Minimal wrapper holding an OpenAI-compatible client and model name."""

    client: object  # openai.OpenAI instance
    model: str
    provider: str = "openai-compatible"
    base_url: str | None = None


def _is_zhipu_base_url(base_url: str | None) -> bool:
    return bool(base_url and "bigmodel.cn" in base_url.lower())


def _read_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _build_http_client() -> httpx.Client:
    # Default to direct outbound requests for local demo runs. This avoids
    # accidental proxy interception causing custom-CA verification failures.
    trust_env = _read_bool_env("XIDEA_LLM_TRUST_ENV", False)
    verify: bool | str = True
    for env_name in ("XIDEA_LLM_CA_BUNDLE", "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"):
        bundle = os.getenv(env_name, "").strip()
        if bundle:
            verify = bundle
            break

    return httpx.Client(trust_env=trust_env, verify=verify)


def _resolve_zhipu_thinking_mode() -> str:
    raw = os.getenv("XIDEA_LLM_ZHIPU_THINKING", "").strip().lower()
    if raw in {"enabled", "disabled"}:
        return raw
    return "disabled"


def _resolve_llm_config() -> tuple[str, str | None, str, str]:
    configured_api_key = os.getenv("XIDEA_LLM_API_KEY", "").strip()
    configured_base_url = os.getenv("XIDEA_LLM_BASE_URL", "").strip() or None
    zhipu_api_key = os.getenv("ZHIPU_API_KEY", "").strip()
    zai_api_key = os.getenv("ZAI_API_KEY", "").strip()
    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()

    if configured_api_key:
        api_key = configured_api_key
        base_url = configured_base_url
    elif zhipu_api_key:
        api_key = zhipu_api_key
        base_url = configured_base_url or ZHIPU_OPENAI_BASE_URL
    elif zai_api_key:
        api_key = zai_api_key
        base_url = configured_base_url or ZHIPU_OPENAI_BASE_URL
    elif openai_api_key:
        api_key = openai_api_key
        base_url = configured_base_url
    else:
        raise RuntimeError(
            "LLM API key is required. "
            "Set XIDEA_LLM_API_KEY to configure the runtime. "
            "Legacy fallbacks ZHIPU_API_KEY, ZAI_API_KEY, and OPENAI_API_KEY are still supported."
        )

    if _is_zhipu_base_url(base_url):
        default_model = "glm-5"
        provider = "zhipu"
    elif base_url:
        default_model = "gpt-4o-mini"
        provider = "openai-compatible"
    else:
        default_model = "gpt-4o-mini"
        provider = "openai"

    model = os.getenv("XIDEA_LLM_MODEL", "").strip() or default_model
    return api_key, base_url, model, provider


def build_llm_client() -> LLMClient:
    """Create an LLM client from environment variables.

    Raises RuntimeError if no supported LLM API key is set — the LLM is the
    core decision-maker and the system cannot operate without it.
    """
    api_key, base_url, model, provider = _resolve_llm_config()

    from openai import OpenAI

    client_kwargs: dict[str, object] = {
        "api_key": api_key,
        "http_client": _build_http_client(),
    }
    if base_url:
        client_kwargs["base_url"] = base_url

    client = OpenAI(**client_kwargs)
    return LLMClient(client=client, model=model, provider=provider, base_url=base_url)


def _strip_code_fence(raw: str) -> str:
    """Remove optional markdown code fences from LLM output."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
    return raw


def _strip_think_tags(raw: str) -> str:
    """Remove provider-added thinking blocks from visible content."""
    cleaned = re.sub(r"<think\b[^>]*>.*?</think>", "", raw, flags=re.IGNORECASE | re.DOTALL)
    return cleaned.strip()


def _strip_structured_wrappers(raw: str) -> str:
    """Remove common XML-ish wrappers that surround JSON answers."""
    cleaned = raw.strip()

    wrapper_names = ("answer", "output", "response", "result", "json")
    for name in wrapper_names:
        cleaned = re.sub(rf"^\s*<{name}\b[^>]*>\s*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
        cleaned = re.sub(rf"\s*</{name}>\s*$", "", cleaned, flags=re.IGNORECASE | re.DOTALL)

    return cleaned.strip()


def _extract_balanced_json_block(raw: str, *, prefer: str | None = None) -> str | None:
    open_chars = [prefer] if prefer in {"{", "["} else ["{", "["]

    for open_char in open_chars:
        close_char = "}" if open_char == "{" else "]"
        start = raw.find(open_char)
        while start != -1:
            depth = 0
            in_string = False
            escaped = False
            for index in range(start, len(raw)):
                char = raw[index]
                if in_string:
                    if escaped:
                        escaped = False
                    elif char == "\\":
                        escaped = True
                    elif char == '"':
                        in_string = False
                    continue

                if char == '"':
                    in_string = True
                    continue

                if char == open_char:
                    depth += 1
                elif char == close_char:
                    depth -= 1
                    if depth == 0:
                        return raw[start : index + 1]

            start = raw.find(open_char, start + 1)

    return None


def _prepare_structured_output(raw: str, *, prefer: str | None = None) -> str:
    cleaned = _strip_structured_wrappers(_strip_think_tags(_strip_code_fence(raw)))
    extracted = _extract_balanced_json_block(cleaned, prefer=prefer)
    return (extracted or cleaned).strip()


def _repair_jsonish_text(raw: str) -> str:
    repaired = raw.strip()
    repaired = re.sub(r"/\*.*?\*/", "", repaired, flags=re.DOTALL)
    repaired = re.sub(r"(^|[\n\r])\s*//.*?(?=$|[\n\r])", r"\1", repaired)
    repaired = re.sub(r"(^|[\n\r])\s*#.*?(?=$|[\n\r])", r"\1", repaired)
    repaired = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)", r'\1"\2"\3', repaired)
    repaired = re.sub(r",(\s*[}\]])", r"\1", repaired)
    repaired = re.sub(r"\bTrue\b", "true", repaired)
    repaired = re.sub(r"\bFalse\b", "false", repaired)
    repaired = re.sub(r"\bNone\b", "null", repaired)
    repaired = re.sub(
        r"'([^'\\]*(?:\\.[^'\\]*)*)'",
        lambda match: json.dumps(bytes(match.group(1), "utf-8").decode("unicode_escape")),
        repaired,
    )
    repaired = _repair_unterminated_double_quoted_strings(repaired)
    return repaired.strip()


def _repair_unterminated_double_quoted_strings(raw: str) -> str:
    output: list[str] = []
    in_string = False
    escaped = False
    index = 0
    length = len(raw)

    while index < length:
        char = raw[index]

        if in_string:
            if escaped:
                output.append(char)
                escaped = False
                index += 1
                continue

            if char == "\\":
                output.append(char)
                escaped = True
                index += 1
                continue

            if char == '"':
                output.append(char)
                in_string = False
                index += 1
                continue

            if char in "\r\n":
                remaining = raw[index + 1 :]
                next_key_match = re.match(r"\s*\"[A-Za-z_][A-Za-z0-9_-]*\"\s*:", remaining)
                if next_key_match:
                    last_non_space = len(output) - 1
                    while last_non_space >= 0 and output[last_non_space].isspace():
                        last_non_space -= 1
                    if last_non_space >= 0 and output[last_non_space] == ",":
                        output.insert(last_non_space, '"')
                    else:
                        output.append('"')
                    in_string = False
                    output.append(char)
                    index += 1
                    continue

            output.append(char)
            index += 1
            continue

        output.append(char)
        if char == '"':
            in_string = True
        index += 1

    if in_string:
        last_non_space = len(output) - 1
        while last_non_space >= 0 and output[last_non_space].isspace():
            last_non_space -= 1
        if last_non_space >= 0 and output[last_non_space] == ",":
            output.insert(last_non_space, '"')
        else:
            output.append('"')

    return "".join(output)


def _load_structured_json(raw: str) -> object:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    repaired = _repair_jsonish_text(raw)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    pythonish = re.sub(r"\btrue\b", "True", repaired)
    pythonish = re.sub(r"\bfalse\b", "False", pythonish)
    pythonish = re.sub(r"\bnull\b", "None", pythonish)
    return literal_eval(pythonish)


def _parse_signal_list(
    parsed: object,
    observations: list[Observation],
) -> list[Signal] | None:
    if not isinstance(parsed, list):
        return None

    signals: list[Signal] = []
    observation_ids = [o.observation_id for o in observations]
    for item in parsed:
        if not isinstance(item, dict):
            continue
        kind = item.get("kind", "")
        if kind not in VALID_SIGNAL_KINDS:
            continue
        signals.append(
            Signal(
                kind=kind,  # type: ignore[arg-type]
                score=max(0.0, min(1.0, float(item.get("score", 0.5)))),
                confidence=max(0.0, min(1.0, float(item.get("confidence", 0.5)))),
                summary=str(item.get("summary", "LLM 检测到的信号")),
                based_on=observation_ids[:2],
            )
        )

    return signals or None


def _parse_diagnosis_payload(
    parsed: object,
    learner_state: LearnerUnitState,
    entry_mode: str,
    target_unit_id: str | None,
) -> Diagnosis | None:
    if not isinstance(parsed, dict):
        return None

    action = parsed.get("recommended_action", "")
    if action not in VALID_ACTIONS:
        return None

    primary_issue = parsed.get("primary_issue", "")
    if primary_issue not in VALID_PRIMARY_ISSUES:
        primary_issue = _infer_issue_from_action(action)

    reason = str(parsed.get("reason", "")).strip()
    if not reason:
        return None

    confidence = max(0.0, min(1.0, float(parsed.get("confidence", 0.7))))
    needs_tool = bool(parsed.get("needs_tool", False))

    return Diagnosis(
        recommended_action=action,  # type: ignore[arg-type]
        reason=reason,
        confidence=confidence,
        focus_unit_id=target_unit_id or learner_state.unit_id,
        primary_issue=primary_issue,  # type: ignore[arg-type]
        needs_tool=needs_tool,
        explanation=Explanation(
            summary=reason,
            evidence=[
                f"understanding={learner_state.understanding_level}",
                f"memory={learner_state.memory_strength}",
                f"confusion={learner_state.confusion_level}",
                f"transfer={learner_state.transfer_readiness}",
                "source=LLM",
            ],
            confidence=confidence,
        ),
    )


def _parse_study_plan_payload(
    parsed: object,
    candidate_modes: list[str],
) -> StudyPlan | None:
    if not isinstance(parsed, dict):
        return None

    steps_raw = parsed.get("steps", [])
    if not isinstance(steps_raw, list) or not steps_raw or len(steps_raw) > 3:
        return None

    candidates = set(candidate_modes) if candidate_modes else None
    steps: list[StudyPlanStep] = []
    for item in steps_raw:
        if not isinstance(item, dict):
            continue
        mode = item.get("mode", "")
        if mode not in VALID_MODES:
            continue
        if candidates and mode not in candidates:
            continue
        step_id = str(item.get("id", f"step-{len(steps)+1}")).strip()
        title = str(item.get("title", "")).strip()
        reason = str(item.get("reason", "")).strip()
        outcome = str(item.get("outcome", "")).strip()
        if not step_id or not title or not reason or not outcome:
            continue
        steps.append(
            StudyPlanStep(
                id=step_id,
                title=title,
                mode=mode,
                reason=reason,
                outcome=outcome,
            )
        )

    if not steps:
        return None

    headline = str(parsed.get("headline", "")).strip()
    summary = str(parsed.get("summary", "")).strip()
    expected_outcome = str(parsed.get("expected_outcome", "")).strip()
    if not headline or not summary or not expected_outcome:
        return None

    return StudyPlan(
        headline=headline,
        summary=summary,
        selected_mode=steps[0].mode,
        expected_outcome=expected_outcome,
        steps=steps,
    )


def _activity_kind_for_mode(mode: str, action: str) -> str:
    if mode == "contrast-drill":
        return "quiz"
    if action == "review" or mode in {"image-recall", "audio-recall"}:
        return "recall"
    return "coach-followup"


def _submit_label_for_kind(kind: str) -> str:
    if kind == "quiz":
        return "提交判断"
    if kind == "recall":
        return "提交回忆"
    return "提交作答"


def _parse_activity_choice_payload(choice: object, fallback_id: str) -> ActivityChoice | None:
    if not isinstance(choice, dict):
        return None

    label = str(choice.get("label", "")).strip()
    detail = str(choice.get("detail", "")).strip()
    if not label or not detail:
        return None

    choice_id = str(choice.get("id", "")).strip() or fallback_id
    feedback_layers_raw = choice.get("feedback_layers", [])
    feedback_layers = [
        str(item).strip()
        for item in feedback_layers_raw
        if str(item).strip()
    ] if isinstance(feedback_layers_raw, list) else []
    analysis = str(choice.get("analysis", "")).strip() or detail

    return ActivityChoice(
        id=choice_id,
        label=label,
        detail=detail,
        is_correct=bool(choice.get("is_correct", False)),
        feedback_layers=feedback_layers,
        analysis=analysis,
    )


def _parse_activity_input_payload(input_payload: object) -> ActivityChoiceInput | ActivityTextInput | None:
    if not isinstance(input_payload, dict):
        return None

    input_type = str(input_payload.get("type", "")).strip()
    if input_type == "" and isinstance(input_payload.get("choices"), list):
        input_type = "choice"
    if input_type == "" and isinstance(input_payload.get("placeholder"), str):
        input_type = "text"

    if input_type == "choice":
        raw_choices = input_payload.get("choices", [])
        if not isinstance(raw_choices, list) or len(raw_choices) < 3:
            return None

        choices = [
            _parse_activity_choice_payload(choice, f"choice-{index + 1}")
            for index, choice in enumerate(raw_choices)
        ]
        if any(choice is None for choice in choices):
            return None

        normalized_choices = [choice for choice in choices if choice is not None]
        if sum(1 for choice in normalized_choices if choice.is_correct) != 1:
            return None

        return ActivityChoiceInput(type="choice", choices=normalized_choices)

    if input_type == "text":
        placeholder = str(input_payload.get("placeholder", "")).strip()
        min_length = int(input_payload.get("min_length", 1))
        if not placeholder:
            return None
        return ActivityTextInput(
            type="text",
            placeholder=placeholder,
            min_length=max(1, min_length),
        )

    return None


def _parse_activity_list_payload(
    parsed: object,
    *,
    plan: StudyPlan,
    diagnosis: Diagnosis,
    learner_state: LearnerUnitState,
    knowledge_point_id: str | None,
    evidence: list[str],
) -> list[Activity] | None:
    raw_activities = parsed.get("activities") if isinstance(parsed, dict) else parsed
    if not isinstance(raw_activities, list):
        return None
    if not raw_activities:
        return []
    if len(raw_activities) != len(plan.steps):
        return None

    activities: list[Activity] = []
    for index, step in enumerate(plan.steps):
        item = raw_activities[index]
        if not isinstance(item, dict):
            return None

        title = str(item.get("title", "")).strip()
        prompt = str(item.get("prompt", "")).strip()
        if not title or not prompt:
            return None

        objective = str(item.get("objective", "")).strip() or step.outcome
        support = str(item.get("support", "")).strip() or step.reason
        input_payload = _parse_activity_input_payload(item.get("input"))
        if input_payload is None:
            return None

        kind = _activity_kind_for_mode(step.mode, diagnosis.recommended_action)
        activities.append(
            Activity(
                id=f"activity-{knowledge_point_id or learner_state.unit_id}-{step.mode}-{index + 1}",
                kind=kind,  # type: ignore[arg-type]
                knowledge_point_id=knowledge_point_id,
                title=title,
                objective=objective,
                prompt=prompt,
                support=support,
                mode=step.mode,
                evidence=evidence,
                submit_label=_submit_label_for_kind(kind),
                input=input_payload,
            )
        )

    return activities


def _chat_completion(
    llm: LLMClient,
    *,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
    expect_json_object: bool = False,
    _caller: str = "",
):
    kwargs: dict[str, object] = {
        "model": llm.model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if expect_json_object:
        kwargs["response_format"] = {"type": "json_object"}
    if llm.provider == "zhipu":
        kwargs["extra_body"] = {
            "thinking": {
                "type": _resolve_zhipu_thinking_mode(),
            }
        }

    label = _caller or "chat_completion"
    t0 = time.time()
    logger.info("[LLM:%s] calling model=%s provider=%s", label, llm.model, llm.provider)

    if _read_bool_env("XIDEA_LLM_FORCE_STREAM", False):
        kwargs["stream"] = True
        stream = llm.client.chat.completions.create(**kwargs)
        result = _collect_stream_as_response(stream)
        elapsed = time.time() - t0
        content_len = len(getattr(result.choices[0].message, "content", "") or "")
        logger.info("[LLM:%s] done in %.2fs (stream-collected, %d chars)", label, elapsed, content_len)
        return result

    result = llm.client.chat.completions.create(**kwargs)
    elapsed = time.time() - t0
    content_len = len(getattr(result.choices[0].message, "content", "") or "")
    logger.info("[LLM:%s] done in %.2fs (%d chars)", label, elapsed, content_len)
    return result


def _collect_stream_as_response(stream):
    """Consume a streaming response and reassemble it into a non-streaming shape."""
    content_parts: list[str] = []
    for chunk in stream:
        text = _extract_stream_chunk_text(chunk)
        if text:
            content_parts.append(text)
    full_content = "".join(content_parts)
    message = SimpleNamespace(content=full_content)
    choice = SimpleNamespace(message=message)
    return SimpleNamespace(choices=[choice])


def _chat_completion_stream(
    llm: LLMClient,
    *,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
    _caller: str = "",
):
    kwargs: dict[str, object] = {
        "model": llm.model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    if llm.provider == "zhipu":
        kwargs["extra_body"] = {
            "thinking": {
                "type": _resolve_zhipu_thinking_mode(),
            }
        }

    label = _caller or "chat_completion_stream"
    logger.info("[LLM:%s] streaming model=%s provider=%s", label, llm.model, llm.provider)
    result = llm.client.chat.completions.create(**kwargs)
    if hasattr(result, "__iter__"):
        return _TimedStreamWrapper(result, label)
    return result


class _TimedStreamWrapper:
    """Wraps a streaming response to log total elapsed time and character count."""

    def __init__(self, stream, label: str):
        self._stream = stream
        self._label = label
        self._t0 = time.time()
        self._char_count = 0

    def __iter__(self):
        return self

    def __next__(self):
        try:
            chunk = next(self._stream)
            text = _extract_stream_chunk_text(chunk)
            self._char_count += len(text)
            return chunk
        except StopIteration:
            elapsed = time.time() - self._t0
            logger.info(
                "[LLM:%s] stream done in %.2fs (%d chars)",
                self._label, elapsed, self._char_count,
            )
            raise


def _extract_message_text(response: object) -> str:
    message = response.choices[0].message
    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text_value = item.get("text")
                if isinstance(text_value, str):
                    text_parts.append(text_value)
            else:
                text_value = getattr(item, "text", None)
                if isinstance(text_value, str):
                    text_parts.append(text_value)
        if text_parts:
            return "".join(text_parts)

    reasoning_content = getattr(message, "reasoning_content", None)
    if isinstance(reasoning_content, str):
        return reasoning_content
    return ""


def _extract_stream_chunk_text(chunk: object) -> str:
    choices = getattr(chunk, "choices", None)
    if not choices:
        return ""

    delta = getattr(choices[0], "delta", None)
    if delta is None:
        return ""

    content = getattr(delta, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text_value = item.get("text")
                if isinstance(text_value, str):
                    text_parts.append(text_value)
            else:
                text_value = getattr(item, "text", None)
                if isinstance(text_value, str):
                    text_parts.append(text_value)
        return "".join(text_parts)
    return ""


def _extract_provider_error_details(error: Exception) -> tuple[str, str]:
    body = getattr(error, "body", None)
    code = ""
    message = str(error)

    if isinstance(body, dict):
        error_body = body.get("error")
        if isinstance(error_body, dict):
            code = str(error_body.get("code", "")).strip()
            body_message = error_body.get("message")
            if isinstance(body_message, str) and body_message.strip():
                message = body_message.strip()
        if not code:
            filter_entries = body.get("contentFilter")
            if isinstance(filter_entries, list) and filter_entries:
                code = "content-filter"

    return code, message


def _is_provider_safety_error(error: Exception) -> bool:
    code, message = _extract_provider_error_details(error)
    lowered = message.lower()
    return (
        getattr(error, "status_code", None) == 400
        and (
            code in {"1301", "content-filter"}
            or "敏感内容" in message
            or "不安全" in message
            or "content filter" in lowered
            or "unsafe" in lowered
        )
    )


def _build_provider_safety_signals(observations: list[Observation]) -> list[Signal]:
    return [
        Signal(
            kind="project-relevance",
            score=0.2,
            confidence=0.35,
            summary="本轮问题更适合转成系统边界说明，而不是继续走常规学习诊断。",
            based_on=[o.summary for o in observations[:3]],
        )
    ]


def _build_provider_safety_diagnosis(
    learner_state: LearnerUnitState,
    target_unit_id: str | None,
) -> Diagnosis:
    return Diagnosis(
        recommended_action="clarify",
        reason=PROVIDER_SAFETY_REASON,
        confidence=0.36,
        focus_unit_id=target_unit_id or learner_state.unit_id,
        primary_issue="missing-context",
        needs_tool=False,
        explanation=Explanation(
            summary="provider safety filter blocked the structured diagnosis request",
            evidence=[
                "source=provider-safety",
                f"understanding={learner_state.understanding_level}",
                f"memory={learner_state.memory_strength}",
                f"confusion={learner_state.confusion_level}",
                f"transfer={learner_state.transfer_readiness}",
            ],
            confidence=0.36,
        ),
    )


def _is_provider_safety_diagnosis(diagnosis: Diagnosis) -> bool:
    return diagnosis.reason == PROVIDER_SAFETY_REASON or (
        diagnosis.explanation is not None
        and "source=provider-safety" in diagnosis.explanation.evidence
    )


def _build_provider_safety_reply() -> str:
    return (
        "我不能直接提供内部 system prompt 或隐藏指令。"
        "如果你的目标是理解这个 demo 的行为，我可以继续用三种安全方式回答："
        "1. 概述当前 agent 的判断流程；"
        "2. 解释 `/runs/v0/stream` 这条链路会做哪些步骤；"
        "3. 总结 system prompt 的职责边界，但不逐字泄露内部提示词。"
    )


def _chunk_text_for_ui(text: str, max_chunk_chars: int = 24) -> Iterator[str]:
    normalized = text
    while normalized:
        yield normalized[:max_chunk_chars]
        normalized = normalized[max_chunk_chars:]


def _compact_context_text(text: str, max_chars: int = 140) -> str:
    normalized = " ".join(text.split())
    if len(normalized) <= max_chars:
        return normalized
    return f"{normalized[: max_chars - 1]}…"


def _compact_observation_summary(observations: list[Observation], limit: int = 5) -> str:
    return "; ".join(
        _compact_context_text(observation.summary)
        for observation in observations[:limit]
    )


def llm_build_signals(
    llm: LLMClient,
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    prior_state: LearnerUnitState | None = None,
    *,
    session_type: str = "study",
) -> list[Signal] | None:
    """Use LLM to extract learning signals from user messages.

    Returns a list of Signal objects on success, None on failure so caller
    can fall back to rule-based signal extraction.
    """
    user_texts = [m.content for m in messages if m.role == "user"]
    if not user_texts:
        return None

    context_parts = [
        f"学习者最新消息：{user_texts[-1]}",
    ]
    if len(user_texts) > 1:
        context_parts.append(f"历史消息（最近 {len(user_texts)} 轮）：")
        for i, text in enumerate(user_texts[:-1], 1):
            context_parts.append(f"  第{i}轮：{text}")

    context_parts.append(f"当前 session 类型：{session_type}")
    context_parts.append(f"入口方式：{entry_mode}")

    if prior_state is not None:
        context_parts.append(
            f"上轮学习状态：理解={prior_state.understanding_level}, "
            f"记忆={prior_state.memory_strength}, "
            f"混淆={prior_state.confusion_level}, "
            f"迁移={prior_state.transfer_readiness}"
        )
        if prior_state.recommended_action:
            context_parts.append(f"上轮推荐动作：{prior_state.recommended_action}")

    if observations:
        context_parts.append(f"观测摘要：{_compact_observation_summary(observations)}")

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        SIGNAL_EXTRACTION_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="signals",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=600,
            _caller="signal_extraction",
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="[")

        parsed = _load_structured_json(raw)
        return _parse_signal_list(parsed, observations)

    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning("LLM signal extraction hit provider safety filter; using safety signals.")
            return _build_provider_safety_signals(observations)
        logger.warning(
            "LLM signal extraction failed, falling back to rules. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def llm_diagnose(
    llm: LLMClient,
    learner_state: LearnerUnitState,
    signals: list[Signal],
    entry_mode: str,
    target_unit_id: str | None,
    prior_state: LearnerUnitState | None = None,
    review_should: bool = False,
    review_priority: float = 0.0,
    review_reason: str = "",
    *,
    session_type: str = "study",
) -> Diagnosis | None:
    """Use LLM to make a diagnosis decision.

    Returns a Diagnosis on success, None on failure so caller can fall back
    to rule-based diagnosis.
    """
    context_parts = [
        f"学习者当前状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}, "
        f"掌握={learner_state.mastery}",
    ]

    if learner_state.weak_signals:
        context_parts.append(f"薄弱信号：{', '.join(learner_state.weak_signals)}")

    context_parts.append(f"当前 session 类型：{session_type}")
    context_parts.append(f"入口方式：{entry_mode}")
    context_parts.append(f"是否有明确学习单元：{'是' if target_unit_id else '否'}")

    signal_desc = "; ".join(f"{s.kind}(score={s.score:.2f}, conf={s.confidence:.2f}): {s.summary}" for s in signals)
    context_parts.append(f"检测到的信号：{signal_desc}")

    if review_should:
        context_parts.append(f"复习引擎建议：应复习 (priority={review_priority:.2f}, reason={review_reason})")
    else:
        context_parts.append("复习引擎建议：暂不需要复习")

    if prior_state is not None:
        context_parts.append(
            f"上轮状态：理解={prior_state.understanding_level}, "
            f"记忆={prior_state.memory_strength}, "
            f"混淆={prior_state.confusion_level}"
        )
        if prior_state.recommended_action:
            context_parts.append(f"上轮推荐动作：{prior_state.recommended_action}")

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        DIAGNOSIS_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="diagnosis",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=300,
            expect_json_object=True,
            _caller="diagnosis",
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="{")

        parsed = _load_structured_json(raw)
        return _parse_diagnosis_payload(parsed, learner_state, entry_mode, target_unit_id)

    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning("LLM diagnosis hit provider safety filter; using safety diagnosis.")
            return _build_provider_safety_diagnosis(learner_state, target_unit_id)
        logger.warning(
            "LLM diagnosis failed, falling back to rules. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def _infer_issue_from_action(action: str) -> str:
    mapping = {
        "clarify": "concept-confusion",
        "teach": "insufficient-understanding",
        "review": "weak-recall",
        "apply": "poor-transfer",
        "practice": "poor-transfer",
    }
    return mapping.get(action, "missing-context")


def llm_build_signals_and_diagnosis(
    llm: LLMClient,
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    learner_state: LearnerUnitState,
    target_unit_id: str | None,
    prior_state: LearnerUnitState | None = None,
    review_should: bool = False,
    review_priority: float = 0.0,
    review_reason: str = "",
    *,
    session_type: str = "study",
) -> tuple[list[Signal], Diagnosis] | None:
    user_texts = [m.content for m in messages if m.role == "user"]
    if not user_texts:
        return None

    context_parts = [
        f"学习者最新消息：{user_texts[-1]}",
    ]
    if len(user_texts) > 1:
        context_parts.append(f"历史消息（最近 {len(user_texts)} 轮）：")
        for i, text in enumerate(user_texts[:-1], 1):
            context_parts.append(f"  第{i}轮：{text}")

    context_parts.extend([
        f"当前 session 类型：{session_type}",
        f"入口方式：{entry_mode}",
        f"学习者当前状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}, "
        f"掌握={learner_state.mastery}",
        f"是否有明确学习单元：{'是' if target_unit_id else '否'}",
    ])

    if learner_state.weak_signals:
        context_parts.append(f"薄弱信号：{', '.join(learner_state.weak_signals)}")

    if observations:
        context_parts.append(f"观测摘要：{_compact_observation_summary(observations)}")

    if review_should:
        context_parts.append(f"复习引擎建议：应复习 (priority={review_priority:.2f}, reason={review_reason})")
    else:
        context_parts.append("复习引擎建议：暂不需要复习")

    if prior_state is not None:
        context_parts.append(
            f"上轮状态：理解={prior_state.understanding_level}, "
            f"记忆={prior_state.memory_strength}, "
            f"混淆={prior_state.confusion_level}, "
            f"迁移={prior_state.transfer_readiness}"
        )
        if prior_state.recommended_action:
            context_parts.append(f"上轮推荐动作：{prior_state.recommended_action}")

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        COMBINED_DIAGNOSIS_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="combined-diagnosis",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=900,
            expect_json_object=True,
            _caller="bundled_diagnose",
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="{")
        parsed = _load_structured_json(raw)
        if not isinstance(parsed, dict):
            return None

        signals = _parse_signal_list(parsed.get("signals"), observations)
        diagnosis = _parse_diagnosis_payload(
            parsed.get("diagnosis"),
            learner_state,
            entry_mode,
            target_unit_id,
        )
        if signals is None or diagnosis is None:
            return None
        return signals, diagnosis
    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning(
                "LLM combined signals+diagnosis hit provider safety filter; using safety fallback."
            )
            return (
                _build_provider_safety_signals(observations),
                _build_provider_safety_diagnosis(learner_state, target_unit_id),
            )
        logger.warning(
            "LLM combined signals+diagnosis failed, falling back to split calls. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def llm_build_main_decision(
    llm: LLMClient,
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    learner_state: LearnerUnitState,
    target_unit_id: str | None,
    topic: str,
    unit_title: str,
    candidate_modes: list[str],
    prior_state: LearnerUnitState | None = None,
    review_should: bool = False,
    review_priority: float = 0.0,
    review_reason: str = "",
    tool_result: ToolResult | None = None,
    *,
    session_type: str = "study",
) -> tuple[list[Signal], Diagnosis, str | None, StudyPlan | None, list[Activity] | None] | None:
    user_texts = [message.content for message in messages if message.role == "user"]
    if not user_texts:
        return None

    context_parts = [
        f"学习者最新消息：{user_texts[-1]}",
    ]
    if len(user_texts) > 1:
        context_parts.append(f"历史消息（最近 {len(user_texts)} 轮）：")
        for index, text in enumerate(user_texts[:-1], 1):
            context_parts.append(f"  第{index}轮：{text}")

    context_parts.extend([
        f"当前 session 类型：{session_type}",
        f"入口方式：{entry_mode}",
        f"学习主题：{topic}",
        f"学习单元：{unit_title}",
        f"学习者当前状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}, "
        f"掌握={learner_state.mastery}",
        f"是否有明确学习单元：{'是' if target_unit_id else '否'}",
    ])
    if candidate_modes:
        context_parts.append(f"候选训练模式（plan.steps 的 mode 必须从中选）：{', '.join(candidate_modes)}")

    if learner_state.weak_signals:
        context_parts.append(f"薄弱信号：{', '.join(learner_state.weak_signals)}")

    if observations:
        context_parts.append(f"观测摘要：{_compact_observation_summary(observations)}")

    if tool_result is not None:
        context_parts.extend(_build_tool_context_parts(tool_result))

    if review_should:
        context_parts.append(f"复习引擎建议：应复习 (priority={review_priority:.2f}, reason={review_reason})")
    else:
        context_parts.append("复习引擎建议：暂不需要复习")

    if prior_state is not None:
        context_parts.append(
            f"上轮状态：理解={prior_state.understanding_level}, "
            f"记忆={prior_state.memory_strength}, "
            f"混淆={prior_state.confusion_level}, "
            f"迁移={prior_state.transfer_readiness}"
        )
        if prior_state.recommended_action:
            context_parts.append(f"上轮推荐动作：{prior_state.recommended_action}")

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        COMBINED_MAIN_DECISION_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="main-decision",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=1200,
            expect_json_object=True,
            _caller="main_decision",
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="{")
        parsed = _load_structured_json(raw)
        if not isinstance(parsed, dict):
            return None

        signals = _parse_signal_list(parsed.get("signals"), observations)
        diagnosis = _parse_diagnosis_payload(
            parsed.get("diagnosis"),
            learner_state,
            entry_mode,
            target_unit_id,
        )
        if signals is None or diagnosis is None:
            return None

        reply = str(parsed.get("reply", "")).strip() or None
        plan = _parse_study_plan_payload(parsed.get("plan"), candidate_modes)
        activities = (
            _parse_activity_list_payload(
                parsed.get("activities"),
                plan=plan,
                diagnosis=diagnosis,
                learner_state=learner_state,
                knowledge_point_id=target_unit_id or learner_state.unit_id,
                evidence=learner_state.weak_signals[:3]
                or (diagnosis.explanation.evidence[:3] if diagnosis.explanation is not None else []),
            )
            if plan is not None and session_type != "project"
            else []
            if session_type == "project"
            else None
        )
        if diagnosis.needs_tool:
            return signals, diagnosis, None, None, None
        return signals, diagnosis, reply, plan, activities
    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning(
                "LLM main decision hit provider safety filter; using safety diagnosis fallback."
            )
            return (
                _build_provider_safety_signals(observations),
                _build_provider_safety_diagnosis(learner_state, target_unit_id),
                None,
                None,
                None,
            )
        logger.warning(
            "LLM main decision failed, falling back to staged path. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


VALID_MODES: set[str] = {
    "socratic", "guided-qa", "contrast-drill",
    "image-recall", "audio-recall", "scenario-sim",
}


def _build_plan_context_parts(
    topic: str,
    unit_title: str,
    candidate_modes: list[str],
    diagnosis: Diagnosis,
    learner_state: LearnerUnitState,
    user_message: str,
    *,
    session_type: str = "study",
) -> list[str]:
    context_parts = [
        f"用户问题：{user_message}",
        f"当前 session 类型：{session_type}",
        f"学习主题：{topic}",
        f"学习单元：{unit_title}",
        f"诊断结果：recommended_action={diagnosis.recommended_action}, "
        f"primary_issue={diagnosis.primary_issue}, reason={diagnosis.reason}",
        f"学习者状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}",
    ]
    if candidate_modes:
        context_parts.append(f"候选训练模式（steps 的 mode 必须从中选）：{', '.join(candidate_modes)}")
    return context_parts


def _build_activity_context_parts(
    topic: str,
    unit_title: str,
    diagnosis: Diagnosis,
    learner_state: LearnerUnitState,
    user_message: str,
    plan: StudyPlan,
    *,
    session_type: str = "study",
) -> list[str]:
    context_parts = [
        f"用户最新消息：{user_message}",
        f"当前 session 类型：{session_type}",
        f"学习主题：{topic}",
        f"学习单元：{unit_title}",
        f"诊断结果：recommended_action={diagnosis.recommended_action}, "
        f"primary_issue={diagnosis.primary_issue}, reason={diagnosis.reason}",
        f"学习者状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}",
        "学习计划步骤："
        + json.dumps(
            [
                {
                    "id": step.id,
                    "title": step.title,
                    "mode": step.mode,
                    "reason": step.reason,
                    "outcome": step.outcome,
                }
                for step in plan.steps
            ],
            ensure_ascii=False,
        ),
    ]
    if learner_state.weak_signals:
        context_parts.append(f"薄弱信号：{', '.join(learner_state.weak_signals)}")
    return context_parts


def _join_prompt_items(items: object, limit: int = 3) -> str | None:
    if not isinstance(items, list):
        return None
    normalized = [str(item).strip() for item in items if str(item).strip()]
    if not normalized:
        return None
    return "；".join(normalized[:limit])


def _build_tool_context_parts(tool_result: ToolResult) -> list[str]:
    payload = tool_result.payload
    context_parts = [f"已预取补充上下文类型：{tool_result.kind}"]

    summary = payload.get("summary")
    if isinstance(summary, str) and summary.strip():
        context_parts.append(f"补充上下文摘要：{summary.strip()}")

    if tool_result.kind == "asset-summary":
        assets = payload.get("assets")
        if isinstance(assets, list) and assets:
            titles = [
                str(asset.get("title", "")).strip()
                for asset in assets[:2]
                if isinstance(asset, dict) and str(asset.get("title", "")).strip()
            ]
            if titles:
                context_parts.append(f"材料标题：{'；'.join(titles)}")
            excerpts = [
                str(asset.get("contentExcerpt", "")).strip()
                for asset in assets[:2]
                if isinstance(asset, dict) and str(asset.get("contentExcerpt", "")).strip()
            ]
            if excerpts:
                context_parts.append(f"材料摘录：{'；'.join(excerpts)}")
        concepts = _join_prompt_items(payload.get("keyConcepts"))
        if concepts is not None:
            context_parts.append(f"材料核心概念：{concepts}")
    elif tool_result.kind == "unit-detail":
        prerequisites = _join_prompt_items(payload.get("prerequisites"))
        misconceptions = _join_prompt_items(payload.get("commonMisconceptions"))
        core_questions = _join_prompt_items(payload.get("coreQuestions"))
        if prerequisites is not None:
            context_parts.append(f"前置条件：{prerequisites}")
        if misconceptions is not None:
            context_parts.append(f"常见误区：{misconceptions}")
        if core_questions is not None:
            context_parts.append(f"核心追问：{core_questions}")
    elif tool_result.kind == "thread-memory":
        learning_progress = payload.get("learningProgress")
        if isinstance(learning_progress, dict):
            context_parts.append(
                "thread 进度："
                f"mastery={learning_progress.get('mastery')}，"
                f"理解={learning_progress.get('understandingLevel')}，"
                f"记忆={learning_progress.get('memoryStrength')}"
            )
        last_diagnosis = payload.get("lastDiagnosis")
        if isinstance(last_diagnosis, dict) and last_diagnosis.get("action"):
            context_parts.append(f"上轮建议动作：{last_diagnosis['action']}")
    elif tool_result.kind == "review-context":
        decay_risk = payload.get("decayRisk")
        if isinstance(decay_risk, str) and decay_risk.strip():
            context_parts.append(f"记忆衰减风险：{decay_risk.strip()}")
        due_units = payload.get("dueUnitIds")
        if isinstance(due_units, list) and due_units:
            context_parts.append(f"待复盘单元：{', '.join(str(item) for item in due_units[:3])}")

    return context_parts


def llm_build_reply_and_plan(
    llm: LLMClient,
    topic: str,
    unit_title: str,
    candidate_modes: list[str],
    diagnosis: Diagnosis,
    learner_state: LearnerUnitState,
    user_message: str,
    tool_result: ToolResult | None = None,
    *,
    session_type: str = "study",
) -> tuple[str, StudyPlan, list[Activity] | None] | None:
    if _is_provider_safety_diagnosis(diagnosis):
        return None

    context_parts = _build_plan_context_parts(
        topic,
        unit_title,
        candidate_modes,
        diagnosis,
        learner_state,
        user_message,
        session_type=session_type,
    )
    if tool_result is not None:
        context_parts.extend(_build_tool_context_parts(tool_result))
    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        COMBINED_RESPONSE_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="response",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=800,
            expect_json_object=True,
            _caller="build_response_bundle",
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="{")
        parsed = _load_structured_json(raw)
        if not isinstance(parsed, dict):
            return None

        reply = str(parsed.get("reply", "")).strip()
        plan = _parse_study_plan_payload(parsed.get("plan"), candidate_modes)
        if not reply or plan is None:
            return None
        activities = (
            _parse_activity_list_payload(
                parsed.get("activities"),
                plan=plan,
                diagnosis=diagnosis,
                learner_state=learner_state,
                knowledge_point_id=learner_state.unit_id,
                evidence=learner_state.weak_signals[:3]
                or (diagnosis.explanation.evidence[:3] if diagnosis.explanation is not None else []),
            )
            if session_type != "project"
            else []
        )
        return reply, plan, activities
    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning(
                "LLM bundled reply+plan hit provider safety filter; falling back to split path."
            )
            return None
        logger.warning(
            "LLM bundled reply+plan failed, falling back to split path. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def llm_build_activities(
    llm: LLMClient,
    topic: str,
    unit_title: str,
    diagnosis: Diagnosis,
    plan: StudyPlan,
    learner_state: LearnerUnitState,
    user_message: str,
    tool_result: ToolResult | None = None,
    *,
    session_type: str = "study",
) -> list[Activity] | None:
    if session_type == "project":
        return []
    if _is_provider_safety_diagnosis(diagnosis):
        return None

    context_parts = _build_activity_context_parts(
        topic,
        unit_title,
        diagnosis,
        learner_state,
        user_message,
        plan,
        session_type=session_type,
    )
    if tool_result is not None:
        context_parts.extend(_build_tool_context_parts(tool_result))
    user_prompt = "\n".join(context_parts)

    evidence = learner_state.weak_signals[:3] or (
        diagnosis.explanation.evidence[:3] if diagnosis.explanation is not None else []
    )

    try:
        response = _chat_completion(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        ACTIVITY_GENERATION_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="activities",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=1400,
            expect_json_object=True,
            _caller="build_activities",
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="{")
        parsed = _load_structured_json(raw)
        return _parse_activity_list_payload(
            parsed,
            plan=plan,
            diagnosis=diagnosis,
            learner_state=learner_state,
            knowledge_point_id=learner_state.unit_id,
            evidence=evidence,
        )
    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning(
                "LLM activity generation hit provider safety filter; falling back to template activities."
            )
            return None
        logger.warning(
            "LLM activity generation failed, falling back to template activities. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def llm_enrich_material_knowledge_points(
    llm: LLMClient,
    *,
    topic: str,
    user_message: str,
    assistant_reply: str,
    asset_summary: dict[str, object],
    candidate_titles: list[str],
    session_type: str = "project",
) -> list[dict[str, str]] | None:
    if not candidate_titles:
        return None

    assets_payload: list[dict[str, object]] = []
    assets = asset_summary.get("assets")
    if isinstance(assets, list):
        for asset in assets[:3]:
            if not isinstance(asset, dict):
                continue
            assets_payload.append({
                "title": str(asset.get("title") or "").strip(),
                "topic": str(asset.get("topic") or "").strip(),
                "excerpt": _compact_context_text(str(asset.get("contentExcerpt") or ""), max_chars=220),
                "keyConcepts": [
                    str(item).strip()
                    for item in (asset.get("keyConcepts") or [])
                    if str(item).strip()
                ][:4],
            })

    user_prompt = "\n".join([
        f"当前 session 类型：{session_type}",
        f"当前项目主题：{topic}",
        f"用户这轮输入：{user_message}",
        f"当前 assistant 已初步回复：{assistant_reply}",
        f"材料摘要：{str(asset_summary.get('summary') or '').strip()}",
        f"材料详情：{json.dumps(assets_payload, ensure_ascii=False)}",
        f"候选知识点标题：{json.dumps(candidate_titles, ensure_ascii=False)}",
        "请输出严格 JSON 数组，为每个候选标题补全 description 和 reason。",
    ])

    try:
        response = _chat_completion(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        KNOWLEDGE_POINT_ENRICH_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="knowledge-point-enrichment",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=900,
            _caller="enrich_material_knowledge_points",
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="[")
        parsed = _load_structured_json(raw)
        if not isinstance(parsed, list):
            return None

        enrichments: list[dict[str, str]] = []
        for candidate_title, payload in zip(candidate_titles, parsed):
            if not isinstance(payload, dict):
                return None
            normalized_title = str(payload.get("title") or "").strip() or candidate_title
            if normalized_title != candidate_title:
                normalized_title = candidate_title
            description = str(payload.get("description") or "").strip()
            reason = str(payload.get("reason") or "").strip()
            if not description or not reason:
                return None
            enrichments.append({
                "title": normalized_title,
                "description": description,
                "reason": reason,
            })
        if len(enrichments) != len(candidate_titles):
            return None
        return enrichments
    except Exception:
        logger.warning(
            "LLM knowledge point enrichment failed, falling back to template copy. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def llm_build_plan(
    llm: LLMClient,
    topic: str,
    unit_title: str,
    candidate_modes: list[str],
    diagnosis: Diagnosis,
    learner_state: LearnerUnitState,
    user_message: str,
    *,
    session_type: str = "study",
) -> StudyPlan | None:
    """Use LLM to generate a complete StudyPlan.

    Returns a StudyPlan on success, None on failure so caller can fall back
    to rule-based plan generation.
    """
    user_prompt = "\n".join(
        _build_plan_context_parts(
            topic,
            unit_title,
            candidate_modes,
            diagnosis,
            learner_state,
            user_message,
            session_type=session_type,
        )
    )

    try:
        response = _chat_completion(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        PLAN_GENERATION_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="plan",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=600,
            expect_json_object=True,
            _caller="build_plan",
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="{")

        parsed = _load_structured_json(raw)
        return _parse_study_plan_payload(parsed, candidate_modes)

    except Exception:
        logger.warning(
            "LLM plan generation failed, falling back to template. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def generate_assistant_reply(
    llm: LLMClient,
    diagnosis: Diagnosis,
    plan: StudyPlan | None,
    learner_state: LearnerUnitState,
    user_message: str,
    tool_result: ToolResult | None = None,
    *,
    session_type: str = "study",
) -> str | None:
    """Generate a natural-language teaching reply using LLM. Returns None on failure."""
    if _is_provider_safety_diagnosis(diagnosis):
        return _build_provider_safety_reply()

    context_parts = [
        f"用户问题：{user_message}",
        f"当前 session 类型：{session_type}",
        f"诊断结果：recommended_action={diagnosis.recommended_action}, "
        f"primary_issue={diagnosis.primary_issue}, reason={diagnosis.reason}",
        f"学习者状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}",
    ]
    if plan is not None:
        context_parts.append(f"学习计划第一步：{plan.steps[0].title}（{plan.steps[0].mode}）")
    if tool_result is not None:
        context_parts.extend(_build_tool_context_parts(tool_result))

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        REPLY_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="reply",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=300,
            _caller="generate_reply",
        )
        content = _extract_message_text(response)
        if content and content.strip():
            return content.strip()
    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning("LLM reply generation hit provider safety filter; using local refusal reply.")
            return _build_provider_safety_reply()
        logger.warning("LLM reply generation failed, falling back to template.", exc_info=True)

    return None


def stream_assistant_reply(
    llm: LLMClient,
    diagnosis: Diagnosis,
    plan: StudyPlan | None,
    learner_state: LearnerUnitState,
    user_message: str,
    tool_result: ToolResult | None = None,
    *,
    session_type: str = "study",
) -> Iterator[str]:
    """Generate a streaming natural-language teaching reply.

    Falls back to chunking a non-streaming response when the provider or mock
    returns a full response object instead of a streaming iterator.
    """
    if _is_provider_safety_diagnosis(diagnosis):
        yield from _chunk_text_for_ui(_build_provider_safety_reply())
        return

    context_parts = [
        f"用户问题：{user_message}",
        f"当前 session 类型：{session_type}",
        f"诊断结果：recommended_action={diagnosis.recommended_action}, "
        f"primary_issue={diagnosis.primary_issue}, reason={diagnosis.reason}",
        f"学习者状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}",
    ]
    if plan is not None:
        context_parts.append(f"学习计划第一步：{plan.steps[0].title}（{plan.steps[0].mode}）")
    if tool_result is not None:
        context_parts.extend(_build_tool_context_parts(tool_result))

    user_prompt = "\n".join(context_parts)

    try:
        stream_or_response = _chat_completion_stream(
            llm,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        REPLY_SYSTEM_PROMPT,
                        session_type=session_type,
                        family="reply",
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=300,
            _caller="stream_reply",
        )

        if hasattr(stream_or_response, "choices"):
            text = _extract_message_text(stream_or_response).strip()
            if text:
                yield from _chunk_text_for_ui(text)
            return

        for chunk in stream_or_response:
            text = _extract_stream_chunk_text(chunk)
            if not text:
                continue
            yield from _chunk_text_for_ui(text)
        return
    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning("LLM reply streaming hit provider safety filter; using local refusal reply.")
            yield from _chunk_text_for_ui(_build_provider_safety_reply())
            return
        logger.warning("LLM reply streaming failed, falling back to sync reply.", exc_info=True)

    fallback = generate_assistant_reply(
        llm,
        diagnosis,
        plan,
        learner_state,
        user_message,
        tool_result=tool_result,
        session_type=session_type,
    )
    if fallback is not None:
        yield from _chunk_text_for_ui(fallback)


def enrich_plan_steps(
    llm: LLMClient,
    steps: list[StudyPlanStep],
    diagnosis: Diagnosis,
    user_message: str,
    unit_title: str,
) -> list[StudyPlanStep] | None:
    """Use LLM to generate context-specific reason/outcome for each plan step.

    Returns enriched steps on success, None on failure so caller can use originals.
    """
    skeleton = [{"id": s.id, "title": s.title, "mode": s.mode} for s in steps]

    user_prompt = (
        f"用户问题：{user_message}\n"
        f"学习单元：{unit_title}\n"
        f"诊断动作：{diagnosis.recommended_action}（{diagnosis.reason}）\n"
        f"步骤骨架：{json.dumps(skeleton, ensure_ascii=False)}\n\n"
        f"请为每个步骤生成 reason 和 outcome，输出 JSON 数组。"
    )

    try:
        response = _chat_completion(
            llm,
            messages=[
                {"role": "system", "content": PLAN_ENRICH_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=500,
            _caller="enrich_plan",
        )
        raw = _extract_message_text(response)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        raw = _prepare_structured_output(raw, prefer="[")

        enrichments = _load_structured_json(raw)
        if not isinstance(enrichments, list) or len(enrichments) != len(steps):
            return None

        enriched: list[StudyPlanStep] = []
        for original, patch in zip(steps, enrichments):
            reason = patch.get("reason", "").strip() or original.reason
            outcome = patch.get("outcome", "").strip() or original.outcome
            enriched.append(
                StudyPlanStep(
                    id=original.id,
                    title=original.title,
                    mode=original.mode,
                    reason=reason,
                    outcome=outcome,
                )
            )
        return enriched

    except Exception:
        logger.warning(
            "LLM plan enrichment failed, falling back to template. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None
