from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
import re
from typing import TYPE_CHECKING

from xidea_agent.activity_results import apply_activity_result_writeback
from xidea_agent.guardrails import get_violations, validate_diagnosis
from xidea_agent.knowledge_points import (
    COMPARISON_PATTERN,
    build_boundary_title,
    build_suggestion_id,
    knowledge_point_identity_key,
)
from xidea_agent.repository import SQLiteRepository
from xidea_agent.review_engine import ReviewDecision, should_enter_review, schedule_next_review
from xidea_agent.state import (
    Activity,
    ActivityChoice,
    ActivityChoiceInput,
    ActivitiesEvent,
    AgentRequest,
    AgentRunResult,
    Diagnosis,
    DiagnosisEvent,
    DoneEvent,
    Explanation,
    GraphState,
    KnowledgePoint,
    KnowledgePointSuggestion,
    KnowledgePointSuggestionEvent,
    LearnerStatePatch,
    LearnerUnitState,
    LearningMode,
    LearningUnit,
    Message,
    Observation,
    PedagogicalAction,
    PlanEvent,
    PrimaryIssue,
    ReviewPatch,
    Signal,
    StatePatch,
    StatePatchEvent,
    StatusEvent,
    StudyPlan,
    StudyPlanStep,
    StreamEvent,
    TextDeltaEvent,
    KnowledgePointState,
    ToolIntent,
    ToolResult,
    build_initial_graph_state,
)
from xidea_agent.tools import (
    build_project_context,
    resolve_tool_result,
    retrieve_learning_unit,
    retrieve_source_assets,
)

if TYPE_CHECKING:
    from xidea_agent.llm import LLMClient


UTC = timezone.utc

CONFUSION_KEYWORDS = ("分不清", "混淆", "区别", "差别", "搞不清", "边界")
UNDERSTANDING_KEYWORDS = ("为什么", "原理", "什么意思", "怎么理解", "不懂", "没懂", "解释")
RECALL_KEYWORDS = ("复习", "忘", "记不住", "回忆", "巩固")
TRANSFER_KEYWORDS = ("项目", "方案", "设计", "落地", "评审", "答辩", "bad case", "场景")
PRACTICE_KEYWORDS = ("练习", "试试", "演练", "模拟")
SUGGESTION_HINTS = CONFUSION_KEYWORDS + ("同一回事", "怎么选", "什么时候用")
OFF_TOPIC_CUE_GROUPS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("天气", ("今天天气", "明天天气", "天气怎么样", "会下雨吗", "气温多少")),
    ("餐饮", ("吃什么", "餐厅推荐", "外卖推荐", "奶茶推荐", "咖啡店推荐")),
    ("娱乐", ("讲个笑话", "写首诗", "推荐电影", "推荐歌曲", "歌词是什么")),
    ("生活服务", ("旅游攻略", "酒店推荐", "机票", "星座运势", "彩票开奖")),
)
PROJECT_CHAT_RELEVANCE_HINTS = (
    "学习",
    "复习",
    "知识点",
    "概念",
    "原理",
    "材料",
    "项目",
    "答辩",
    "架构",
    "检索",
    "rag",
    "retrieval",
    "reranking",
    "embedding",
    "agent",
    "workflow",
)
PROJECT_CHAT_LOW_INFO_MESSAGES = {
    "hi",
    "hello",
    "hey",
    "你好",
    "您好",
    "在吗",
    "在么",
    "继续",
    "继续吧",
    "继续聊",
    "开始",
    "下一步",
    "go",
    "ok",
    "okay",
    "好的",
}
SESSION_CAPABILITY_CUES = (
    "你可以做什么",
    "你能做什么",
    "你会什么",
    "怎么帮我",
    "能帮我什么",
    "你是谁",
)
PROJECT_SESSION_PEDAGOGICAL_CUES = (
    "回忆",
    "复习",
    "作答",
    "练习",
    "做一轮",
    "主动回忆",
    "先问你一个核心问题",
    "不要看材料",
    "情境模拟",
    "提交",
    "先完成这一轮动作",
)
PROJECT_SESSION_UNSAFE_MODES = {"scenario-sim", "image-recall", "audio-recall"}
ARCHIVE_READY_LEARNING_STATUSES = {"stable", "complete", "learned"}
ARCHIVE_READY_REVIEW_STATUSES = {"stable", "mastered"}
ARCHIVE_READY_MIN_MASTERY = 90
ARCHIVE_READY_MIN_REVIEW_GAP = timedelta(days=14)

MODE_LABELS: dict[LearningMode, str] = {
    "socratic": "苏格拉底追问",
    "guided-qa": "1v1 导师问答",
    "contrast-drill": "对比辨析训练",
    "image-recall": "看图回忆",
    "audio-recall": "听音作答",
    "scenario-sim": "情境模拟",
}

ACTION_ISSUE: dict[PedagogicalAction, PrimaryIssue] = {
    "clarify": "concept-confusion",
    "teach": "insufficient-understanding",
    "review": "weak-recall",
    "apply": "poor-transfer",
    "practice": "poor-transfer",
}

ACTION_REASON: dict[PedagogicalAction, str] = {
    "clarify": "当前最大问题是概念边界混淆，先把区别拉清楚比继续讲知识点更重要。",
    "teach": "用户还没有形成稳定理解框架，先补建模再安排练习更稳。",
    "apply": "概念基础已基本具备，但还需要在项目场景里验证是否真的会用。",
    "practice": "当前适合通过练习把已有理解转成更稳定的应用能力。",
}
SESSION_STATUS_MESSAGES = {
    "loading-context": "正在读取当前 project、材料和历史状态",
    "making-decision": "正在判断这一轮更适合先学什么",
    "retrieving-context": "正在补充这轮需要的上下文证据",
    "composing-response": "正在组织本轮回复和学习动作",
}
TOOL_STATUS_MESSAGES: dict[ToolIntent, str] = {
    "none": SESSION_STATUS_MESSAGES["composing-response"],
    "asset-summary": "正在提炼这批材料里的关键信息",
    "unit-detail": "正在补充当前知识点的结构化细节",
    "thread-memory": "正在回看这条 session 的上下文轨迹",
    "review-context": "正在拉取复习记录和记忆衰减线索",
}


def _build_choice(
    *,
    choice_id: str,
    label: str,
    detail: str,
    is_correct: bool,
    feedback_layers: list[str],
    analysis: str,
) -> ActivityChoice:
    return ActivityChoice(
        id=choice_id,
        label=label,
        detail=detail,
        is_correct=is_correct,
        feedback_layers=feedback_layers,
        analysis=analysis,
    )


def _build_choice_input(*choice_specs: dict[str, object]) -> ActivityChoiceInput:
    return ActivityChoiceInput(
        type="choice",
        choices=[_build_choice(**choice_spec) for choice_spec in choice_specs],
    )


def _build_activity_choice_set(
    mode: LearningMode,
    learning_unit: LearningUnit | None,
    action: PedagogicalAction,
):
    unit_id = learning_unit.id if learning_unit is not None else None

    if unit_id == "unit-rag-retrieval":
        if mode == "contrast-drill":
            return _build_choice_input(
                {
                    "choice_id": "rerank-when-candidates-exist",
                    "label": "top-k 里已经有相关文档，但排在前面的常是语义相近却答非所问的片段。",
                    "detail": "候选基本找到了，问题更像排序没把真正对口的证据顶到前面。",
                    "is_correct": True,
                    "feedback_layers": [
                        "对，这更像“候选已在集合里，但顺序没把最该看的证据排前面”，所以该补重排。",
                        "关键不是继续扩大召回，而是让已有候选按任务相关性重新排序，把真正回答问题的片段顶上来。",
                    ],
                    "analysis": "这条回答准确抓住了“召回基本够、但前排排序不对”的信号，最符合这轮要辨析的边界。",
                },
                {
                    "choice_id": "recall-not-enough",
                    "label": "top-k 里经常根本找不到答案对应文档，所以优先加一个重排层。",
                    "detail": "这更像召回覆盖不足，先该补召回或索引，而不是指望重排把不存在的候选排出来。",
                    "is_correct": False,
                    "feedback_layers": [
                        "先别急着加重排。正确文档如果还没进候选集，重排也无从发挥。",
                        "这类现象更像召回覆盖不足：该先看索引、召回策略或查询表达，而不是把问题直接归到排序。",
                        "重排解决的是“候选已有但排序不够对口”，不是“正确文档根本没被召回进来”。这里先补重排会把问题诊断偏掉。",
                    ],
                    "analysis": "这条选择把“召回覆盖不足”和“排序相关性不足”混为一谈，是这轮最需要纠正的误判。",
                },
                {
                    "choice_id": "stuff-more-context",
                    "label": "把 top-k 调大、多塞一些上下文给模型，就可以替代重排。",
                    "detail": "会把排序问题伪装成堆料问题，常常同时放大噪音和上下文污染。",
                    "is_correct": False,
                    "feedback_layers": [
                        "多塞内容不等于解决排序问题，反而可能把噪音一起抬进上下文。",
                        "如果最该看的证据没有被排到前面，单纯加大 top-k 只会让模型更难聚焦。",
                        "这里缺的不是“更多内容”，而是“把真正对口的内容排到前面”。用堆上下文代替重排，通常会同时损失稳定性和可解释性。",
                    ],
                    "analysis": "这条选择把“需要更好排序”误写成“需要更多上下文”，会让系统设计继续跑偏。",
                },
            )

        if mode in ("guided-qa", "socratic"):
            return _build_choice_input(
                {
                    "choice_id": "rerank-explains-ordering-gap",
                    "label": "重排是在“候选已经召回进来”的前提下，把最回答问题的证据排到前面。",
                    "detail": "它补的是任务相关性排序，不是替代召回把漏掉的文档找回来。",
                    "is_correct": True,
                    "feedback_layers": [
                        "对，这句解释把重排真正补的缺口说清楚了：不是补召回，而是补排序。",
                        "只要这层边界讲清楚，后面再谈什么时候该加重排就有了稳定判断标准。",
                    ],
                    "analysis": "这条表述直接命中“重排补排序、不补召回”的核心边界，是当前知识点最该先说清的一句。",
                },
                {
                    "choice_id": "rerank-recovers-missed-docs",
                    "label": "重排的主要作用是把本来没召回到的正确文档重新找回来。",
                    "detail": "这会把重排误说成召回补丁，混掉两阶段架构里的职责边界。",
                    "is_correct": False,
                    "feedback_layers": [
                        "这句最大的问题是把重排说成了“补召回”。",
                        "如果正确文档根本不在候选集里，重排没有素材可排；它能做的是在已有候选里重排相关性。",
                        "一旦把重排误写成“找回漏召文档”，后面对系统问题的诊断就会全线偏掉：你会错把召回缺口当成排序缺口。",
                    ],
                    "analysis": "这条说法直接混淆了召回和重排的职责，是这轮必须排掉的典型误解。",
                },
                {
                    "choice_id": "strong-embedding-removes-rerank",
                    "label": "只要 embedding 足够强，重排基本就没有实际价值。",
                    "detail": "embedding 决定召回语义能力，但不自动等于任务级的前排排序足够稳。",
                    "is_correct": False,
                    "feedback_layers": [
                        "embedding 更强不等于前排结果已经足够对口。",
                        "很多场景里，问题不是“能不能把相关候选找进来”，而是“前几条到底是不是最该给模型看的证据”。",
                        "重排存在的原因正是：即使召回足够强，前排顺序仍可能把语义相近但不真正回答问题的片段放在前面。",
                    ],
                    "analysis": "这条选择把召回语义能力和任务相关性排序混成一层，容易让系统设计判断失焦。",
                },
            )

        if mode == "scenario-sim" or action == "apply":
            return _build_choice_input(
                {
                    "choice_id": "review-explain-relevance-order",
                    "label": "我们先保证候选能进来，再用重排把最回答问题的证据排前面，不然生成很容易抓错上下文。",
                    "detail": "这句先讲判断链路，再讲为什么不能偷成“只召回就行”。",
                    "is_correct": True,
                    "feedback_layers": [
                        "对，这种解释先把两层职责拆开，再把“为什么需要重排”说清楚了。",
                        "评审或同事真正需要听到的就是这层取舍：不是多做一步，而是为了减少前排证据错位。",
                    ],
                    "analysis": "这条回答把“候选进入”和“前排排序”拆成两层，是项目语境下最有说服力的解释方式。",
                },
                {
                    "choice_id": "review-blame-model-size",
                    "label": "加重排主要是因为模型还不够强，等模型更强就不需要这些结构了。",
                    "detail": "会把方案取舍偷换成模型强弱问题，答不到设计边界本身。",
                    "is_correct": False,
                    "feedback_layers": [
                        "这句把方案取舍偷换成了模型强弱，解释焦点跑偏了。",
                        "别人真正要问的是“为什么当前链路需要这一步”，不是“模型什么时候会更强”。",
                        "如果只把原因归结为模型不够强，你就没有解释清楚：即使模型更强，候选排序和证据对口性为什么仍然重要。",
                    ],
                    "analysis": "这条回答把结构化设计问题错误归因成模型能力问题，不利于答辩或方案讨论。",
                },
                {
                    "choice_id": "review-just-stuff-more",
                    "label": "只要把更多召回结果直接拼给模型，通常就能替代重排。",
                    "detail": "会把“前排排序不对”的问题继续伪装成“内容还不够多”。",
                    "is_correct": False,
                    "feedback_layers": [
                        "这类回答最大的问题是默认“多给内容”能替代排序判断。",
                        "但如果前几条证据本来就不对口，多塞内容只会让模型更难聚焦，甚至把错证据一起放大。",
                        "评审想听的是：为什么不能偷成“只召回 + 多塞上下文”。真正原因是候选进入和前排排序是两层不同的质量控制点。",
                    ],
                    "analysis": "这条说法会把排序缺口继续伪装成堆料问题，无法真正说明为什么需要重排。",
                },
            )

    if unit_id == "unit-rag-core":
        if mode in ("contrast-drill", "guided-qa", "socratic"):
            return _build_choice_input(
                {
                    "choice_id": "rag-needs-context-construction",
                    "label": "检索命中只是拿到候选；排序、截断和上下文组织决定模型最终会不会抓对证据。",
                    "detail": "这才是“RAG 不是简单检索 + 拼接”的核心原因。",
                    "is_correct": True,
                    "feedback_layers": [
                        "对，这句把“检索命中”和“上下文可用”拆开了。",
                        "只要这层关系讲清楚，就不会再把 RAG 理解成机械地把检索结果全文塞进 prompt。",
                    ],
                    "analysis": "这条回答直接指出了 RAG 多出来的关键层：上下文构造，而不是单纯检索命中。",
                },
                {
                    "choice_id": "rag-just-concat",
                    "label": "只要能检索到相关文档，把全文直接拼进 prompt 就够了。",
                    "detail": "会忽略排序、截断和噪音控制，把可用上下文误写成原始拼接。",
                    "is_correct": False,
                    "feedback_layers": [
                        "问题不在“有没有文档”，而在“给模型的上下文是不是被组织成了可用证据”。",
                        "直接全文拼接通常会把噪音、重复和无关段落一起塞进去，命中了也不代表模型能用好。",
                        "这句把 RAG 误简化成“检索完就拼接”，正好漏掉了真正决定回答质量的那一层：上下文构造。",
                    ],
                    "analysis": "这条说法忽略了上下文构造这层关键决策，会把 RAG 错看成机械拼接流程。",
                },
                {
                    "choice_id": "rag-more-is-better",
                    "label": "RAG 的核心只是让模型看到更多内容，所以内容越多越好。",
                    "detail": "会把质量控制偷换成覆盖率直觉，忽略上下文窗口和证据优先级。",
                    "is_correct": False,
                    "feedback_layers": [
                        "“更多内容”不是目标，给出“更对口的证据”才是目标。",
                        "一旦内容过多、顺序不对或噪音过高，模型反而更容易抓错线索。",
                        "RAG 不只是扩上下文，而是在有限窗口里做证据选择和组织。把它说成“越多越好”，会直接丢掉这层设计判断。",
                    ],
                    "analysis": "这条选择把 RAG 错写成纯覆盖率问题，忽视了上下文构造和噪音控制。",
                },
            )

        if mode == "scenario-sim" or action == "apply":
            return _build_choice_input(
                {
                    "choice_id": "rag-explain-context-layer",
                    "label": "检索到只是第一步，我们还要把最相关、最可回答问题的证据组织成可用上下文，RAG 才稳定。",
                    "detail": "这句先讲链路，再讲为什么不能偷成“检索 + 拼接”。",
                    "is_correct": True,
                    "feedback_layers": [
                        "对，这种解释先把“找到候选”和“组织上下文”拆开了，听起来就不是黑盒堆料。",
                        "只要把这层讲清楚，别人就能理解为什么 RAG 不是做完检索就结束。",
                    ],
                    "analysis": "这条回答直指 RAG 相比“检索 + 拼接”多出的关键控制层，最适合对外解释。",
                },
                {
                    "choice_id": "rag-explain-only-retrieval",
                    "label": "RAG 的关键就是把更多相关文档检索出来，后面拼接是细节。",
                    "detail": "会把上下文构造降成细节，解释不到最终回答质量为什么会分化。",
                    "is_correct": False,
                    "feedback_layers": [
                        "这句把真正影响回答质量的一层降成了“细节”。",
                        "别人想知道的是：为什么检索到了还可能答不好；如果不谈上下文构造，这个问题就没被回答。",
                        "把“拼接/组织/筛选”都当成细节，会让方案听起来像只是多检索一点文档，而不是在做证据质量控制。",
                    ],
                    "analysis": "这条说法仍把 RAG 讲成“检索主导”，解释力不够，容易被追问打穿。",
                },
                {
                    "choice_id": "rag-explain-model-magic",
                    "label": "只要模型足够强，RAG 本质上就只是把检索结果交给模型自己消化。",
                    "detail": "会把系统设计责任偷交给模型，绕开链路取舍。",
                    "is_correct": False,
                    "feedback_layers": [
                        "这句把问题再次推回模型强弱，没解释为什么系统还要设计上下文构造。",
                        "即使模型更强，证据顺序、噪音和窗口限制也不会自动消失。",
                        "如果对方问“那为什么不直接全交给模型自己处理”，你还是需要回到证据组织和质量控制这层，而不是用模型能力兜底。",
                    ],
                    "analysis": "这条回答会把系统设计判断偷换成模型能力崇拜，不利于讲清真实取舍。",
                },
            )

    if unit_id == "unit-rag-explain":
        return _build_choice_input(
            {
                "choice_id": "explain-risk-and-tradeoff",
                "label": "先讲业务风险和稳定性：这些步骤是在减少答非所问、证据错位和不可解释性。",
                "detail": "先让非技术对象听懂为什么要这样设计，再展开技术实现。",
                "is_correct": True,
                "feedback_layers": [
                    "对，先讲风险控制和业务影响，非技术对象才能听懂为什么这套结构有必要。",
                    "这条开场能先建立“为什么这样设计”的心智，再往下接技术细节才不会散。",
                ],
                "analysis": "这条说法先把评审真正关心的取舍讲清楚，是最适合作为解释开场的一句。",
            },
            {
                "choice_id": "explain-implementation-first",
                "label": "先按顺序罗列 embedding、reranker、chunking、prompt 的实现步骤。",
                "detail": "实现细节会让技术人点头，但不足以让评审先理解为什么需要这套方案。",
                "is_correct": False,
                "feedback_layers": [
                    "实现步骤不是不能讲，但它不该是开场第一句。",
                    "如果先列技术栈，评审或产品还没建立“为什么需要这套结构”的心智，很容易觉得你只是在堆术语。",
                    "更有效的顺序是：先讲它解决什么风险和业务问题，再解释这些技术步骤各自承担哪层控制作用。",
                ],
                "analysis": "这条开场把解释重心放在实现过程，忽略了“为什么这样设计”的答辩主线。",
            },
            {
                "choice_id": "explain-model-only",
                "label": "先说如果模型再强一点，这些设计大多都可以省掉。",
                "detail": "会把方案取舍偷换成模型强弱判断，显得整套设计只是权宜之计。",
                "is_correct": False,
                "feedback_layers": [
                    "这会让整套方案听起来像“模型不够强时的临时补丁”，说服力会立刻下降。",
                    "评审真正要听到的是：为什么这些结构本身就在控制质量和风险，而不是等更强模型来替代。",
                    "如果开场就把原因归给模型不够强，你后面会越来越难解释：那为什么当前还值得做这些设计、ROI 又在哪里。",
                ],
                "analysis": "这条回答会把系统设计价值削弱成模型短板补丁，不利于评审沟通。",
            },
        )

    if mode == "contrast-drill":
        return _build_choice_input(
            {
                "choice_id": "trace-boundary",
                "label": "先把这条知识点里最关键的边界拉开，再决定下一步该补哪条证据。",
                "detail": "先定位真正的判断对象，而不是继续泛泛补信息。",
                "is_correct": True,
                "feedback_layers": [
                    "对，先把边界拉开，后面补证据才不会越补越乱。",
                    "这轮先确认“到底哪两层最容易混”，比立刻堆更多信息更重要。",
                ],
                "analysis": "这条回答先处理边界，再决定补证据方向，更符合辨析题的目标。",
            },
            {
                "choice_id": "increase-context",
                "label": "先继续加更多信息，看看能不能把当前问题一起覆盖掉。",
                "detail": "会把边界没拉开的缺口继续藏在信息噪音里。",
                "is_correct": False,
                "feedback_layers": [
                    "先别急着加信息。现在更缺的是问题定位，不是覆盖率。",
                    "如果边界还没拉开，继续加材料通常只会把噪音一起放大。",
                    "真正要先回答的是：你现在混的是哪两层、哪一个判断标准还不稳。没定位前继续加料，后面会更难纠偏。",
                ],
                "analysis": "这条选择把边界问题误写成信息不足，容易继续跑偏。",
            },
            {
                "choice_id": "skip-diagnosis",
                "label": "先给一个大概结论，判断依据先不展开。",
                "detail": "会让真正的混淆点继续藏着，系统也更难给出下一步。",
                "is_correct": False,
                "feedback_layers": [
                    "只给结论还不够，这轮更关键的是把判断依据露出来。",
                    "如果不展开依据，系统就看不见你到底是概念边界没稳，还是证据选择没稳。",
                    "辨析题的价值就在于暴露“你靠什么区分它们”。如果把依据省掉，后面的学习编排就只能走更保守的路径。",
                ],
                "analysis": "这条选择回避了判断依据，系统难以定位真实缺口。",
            },
        )

    if mode == "scenario-sim":
        return _build_choice_input(
            {
                "choice_id": "explain-judgment-chain",
                "label": "先把关键步骤分别控制什么风险讲清楚，再解释为什么不能偷成更省事的做法。",
                "detail": "项目讨论里，别人真正要听到的是判断链路，而不是只背最终结论。",
                "is_correct": True,
                "feedback_layers": [
                    "对，项目解释最重要的是把判断链路和风险控制说出来。",
                    "只要把“为什么不能偷简化”讲清楚，这轮就不只是背答案，而是真的能解释方案。",
                ],
                "analysis": "这条选择把方案拆回判断链路，最能验证项目场景里的解释能力。",
            },
            {
                "choice_id": "stack-more-context",
                "label": "重点强调信息越多越安全，先把更多内容塞进去再说。",
                "detail": "会把系统设计问题继续伪装成覆盖率问题。",
                "is_correct": False,
                "feedback_layers": [
                    "光强调“多放信息更安全”不够，因为它没有解释每一步为什么存在。",
                    "项目讨论里，别人更想知道的是：哪些步骤在控制风险、为什么不能直接偷简化。",
                    "如果不拆出关键判断链路，这个回答会把设计问题伪装成“多塞内容就行”的覆盖率问题，说服力会很弱。",
                ],
                "analysis": "这条选择仍把重点放在堆信息，而不是解释关键判断链路。",
            },
            {
                "choice_id": "focus-model-only",
                "label": "先把问题归因成模型或工具不够强，判断链路后面再说。",
                "detail": "会跳过系统设计层的取舍标准，很难真的说服别人。",
                "is_correct": False,
                "feedback_layers": [
                    "这会把责任全推给模型强弱，但没有回答系统为什么要这样设计。",
                    "别人真正想知道的是：哪些步骤在控制风险、提高稳定性，而不是一句“模型还不够强”。",
                    "如果不解释判断链路，模型再强也只是黑盒结论；你仍然没说明为什么当前方案需要这些结构。",
                ],
                "analysis": "这条选择跳过了系统设计层的判断标准，解释焦点会跑偏。",
            },
        )

    if mode in ("guided-qa", "socratic"):
        return _build_choice_input(
            {
                "choice_id": "explain-boundary",
                "label": "先给出和当前知识点直接相关的判断边界，再补一句为什么。",
                "detail": "先让答案落在这条知识点本身，而不是只绕着答题方式打转。",
                "is_correct": True,
                "feedback_layers": [
                    "对，先把当前知识点里的判断边界说清楚，后面的解释才有落点。",
                    "这能更快看出你是否真的理解，而不是只会复述表面定义。",
                ],
                "analysis": "这条回答先落在知识点本身，再补原因，更容易验证理解是否稳定。",
            },
            {
                "choice_id": "repeat-definition",
                "label": "先复述概念定义，边界和应用后面再说。",
                "detail": "只停在定义层，往往会把真正的判断缺口继续盖住。",
                "is_correct": False,
                "feedback_layers": [
                    "先别退回纯定义。当前更重要的是把边界和判断标准拉开。",
                    "只复述定义常常会让人“看起来懂了”，但一到实际判断还是会混。",
                    "这轮要验证的是你能不能把知识点用在判断上，而不是能不能背出教材式表述。只停在定义层，真实缺口会继续被盖住。",
                ],
                "analysis": "这条选择把任务退回成复述定义，绕开了当前真正要验证的内容。",
            },
            {
                "choice_id": "jump-to-solution",
                "label": "先直接给一个结论，判断依据之后再补。",
                "detail": "会让系统看不见你是怎么区分、怎么推到这个答案的。",
                "is_correct": False,
                "feedback_layers": [
                    "先给结论还不够，因为这轮还要看到你的判断过程。",
                    "如果不解释为什么这样判断，后面就很难区分你是真的理解，还是碰巧押中了答案。",
                    "这轮最有价值的信息是：你靠什么证据、什么标准得出这个判断。如果直接跳到结论，这层学习信号会直接丢掉。",
                ],
                "analysis": "这条选择省掉了判断过程，系统难以确认理解是否真的稳固。",
            },
        )

    if mode in ("image-recall", "audio-recall"):
        return _build_choice_input(
            {
                "choice_id": "recall-key-criterion",
                "label": "先回忆关键判断标准，再看自己哪里记不稳。",
                "detail": "优先验证可回忆性，而不是继续看材料。",
                "is_correct": True,
                "feedback_layers": [
                    "对，复习时先看自己能不能直接回忆出判断标准。",
                    "这能区分出是真记住了，还是只是刚看过材料还留着余温。",
                ],
                "analysis": "这条回答优先验证主动回忆能力，最符合复习轮的目标。",
            },
            {
                "choice_id": "peek-material",
                "label": "先回材料确认一遍，再回答。",
                "detail": "会绕开主动回忆，系统没法判断记忆是否真的可用。",
                "is_correct": False,
                "feedback_layers": [
                    "这会先把答案补回来，但复习轮想看的正是你此刻能不能自己想起。",
                    "一旦先看材料，系统就分不清是你真的记住了，还是刚刚被提示起来的。",
                    "复习轮的核心不是把题做对一次，而是测出记忆是不是已经能脱离材料独立调用；先回看材料会直接损失这层信息。",
                ],
                "analysis": "这条选择绕开了主动回忆，系统无法判断记忆是否真正稳定可用。",
            },
            {
                "choice_id": "guess-roughly",
                "label": "先模糊说个大概，细节以后再补。",
                "detail": "会把记忆断点藏起来，降低复习判断质量。",
                "is_correct": False,
                "feedback_layers": [
                    "模糊带过会让真正的记忆断点被藏起来。",
                    "如果你只说个大概，系统很难判断你是差一点就想起来，还是核心标准已经丢了。",
                    "复习轮需要的是清晰暴露断点：到底是哪条标准想不起来、哪一步顺序记混了。含糊作答会让后续编排失真。",
                ],
                "analysis": "这条选择用含糊回答掩盖了真实断点，降低了复习信号质量。",
            },
        )

    return _build_choice_input(
        {
            "choice_id": "state-core-judgment",
            "label": "先说出这一轮最关键的判断，再解释原因。",
            "detail": "这样最容易暴露当前真正稳不稳。",
            "is_correct": True,
            "feedback_layers": [
                "对，先说关键判断，系统才能看见你最核心的理解是否稳。",
                "这条回答能先暴露真正的判断标准，再展开原因，信息密度最高。",
            ],
            "analysis": "这条回答先给关键判断，再补原因，最有利于系统读取真实学习状态。",
        },
        {
            "choice_id": "repeat-material",
            "label": "先把材料里的原话重述一遍，确保信息没漏。",
            "detail": "会削弱系统对真实理解和迁移能力的判断。",
            "is_correct": False,
            "feedback_layers": [
                "重述材料不等于完成判断，这会把作答变成摘抄。",
                "系统现在要看的不是你能不能复述，而是你能不能抓住这轮最关键的判断点。",
                "如果只是把材料原话搬回来，系统无法判断你是否真的理解、能否迁移，也就很难决定下一步该 teach、clarify 还是 review。",
            ],
            "analysis": "这条选择把任务退化成复述材料，弱化了对真实理解和迁移能力的判断。",
        },
        {
            "choice_id": "skip-judgment",
            "label": "先不给判断，等系统直接告诉我答案。",
            "detail": "会让这一轮失去可检视表现，下一步更难编排。",
            "is_correct": False,
            "feedback_layers": [
                "这会直接失去这轮最重要的信号：你现在到底会不会判断。",
                "如果把判断完全交给系统，后面就无法区分你是没理解、记不牢，还是只是暂时没组织好表达。",
                "学习编排依赖的是你的实际表现，而不是系统替你回答。跳过判断会让下一步只能做保守安排，精度会明显变差。",
            ],
            "analysis": "这条选择放弃了当前作答机会，系统拿不到足够表现信号继续做高精度编排。",
        },
    )


def _build_activity_title(
    mode: LearningMode,
    action: PedagogicalAction,
    learning_unit: LearningUnit | None,
) -> str:
    unit_id = learning_unit.id if learning_unit is not None else None

    if unit_id == "unit-rag-retrieval":
        if mode == "contrast-drill":
            return "先判断问题出在召回还是排序"
        if mode in ("guided-qa", "socratic"):
            return "先讲清楚重排到底在补什么"
        if mode == "scenario-sim" or action == "apply":
            return "先练一次向评审解释为什么需要重排"

    if unit_id == "unit-rag-core":
        if mode in ("contrast-drill", "guided-qa", "socratic"):
            return "先判断问题出在检索命中还是上下文构造"
        if mode == "scenario-sim" or action == "apply":
            return "先练一次解释为什么 RAG 不只是检索加拼接"

    if unit_id == "unit-rag-explain":
        return "先练一次对评审解释方案"

    if mode == "contrast-drill":
        return "先做一个边界辨析"

    if mode == "scenario-sim" or action == "apply":
        return "先做一轮项目情境作答"

    if action == "review" or mode in ("image-recall", "audio-recall"):
        return "先做一次主动回忆"

    return "先接住导师追问"


def _build_activity_prompt(
    action: PedagogicalAction,
    mode: LearningMode,
    learning_unit: LearningUnit | None,
) -> str:
    unit_id = learning_unit.id if learning_unit is not None else None
    unit_title = learning_unit.title if learning_unit is not None else "当前知识点"

    if unit_id == "unit-rag-retrieval":
        if mode == "contrast-drill":
            return (
                "围绕「什么时候需要重排，而不是只做向量召回」，选出最合理的判断："
                "下面哪种情况最说明“候选基本找到了，但前排排序不对”，因此该补的是重排？"
            )
        if mode in ("guided-qa", "socratic"):
            return (
                "围绕「什么时候需要重排，而不是只做向量召回」，选出更准确的一句解释："
                "重排到底是在补哪一类缺口？"
            )
        if mode == "scenario-sim" or action == "apply":
            return (
                "如果你要向同事或评审解释「什么时候需要重排，而不是只做向量召回」，"
                "下面哪种说法最能讲清楚为什么不能偷成“只召回就行”？"
            )

    if unit_id == "unit-rag-core":
        if mode in ("contrast-drill", "guided-qa", "socratic"):
            return (
                "围绕「RAG 为什么不是简单检索 + 拼接」，选出更准确的一句判断："
                "真正多出来、而且决定回答质量的那一层是什么？"
            )
        if mode == "scenario-sim" or action == "apply":
            return (
                "如果你要向产品或评审解释「RAG 为什么不是简单检索 + 拼接」，"
                "下面哪种说法最能先把设计取舍讲清楚？"
            )

    if unit_id == "unit-rag-explain":
        return (
            "如果你要把「如何把 RAG 方案解释给产品和评审」讲给非技术同事，"
            "下面哪种开场最合适？"
        )

    if mode == "contrast-drill":
        return (
            f"围绕「{unit_title}」，选出更合理的一句判断："
            "哪种说法真正抓住了当前最该先分清的边界？"
        )

    if mode == "scenario-sim" or action == "apply":
        return (
            f"如果你要把「{unit_title}」解释给同事或评审，"
            "下面哪种说法最能先讲清楚这条方案为什么这样设计？"
        )

    if action == "review" or mode in ("image-recall", "audio-recall"):
        return (
            f"不要看材料，回忆一下「{unit_title}」里你最该记住的判断标准："
            "先用一句话说核心边界，再补一句为什么。"
        )

    return (
        f"围绕「{unit_title}」，选出更准确的一句解释："
        "哪种说法最能代表你已经抓住这条知识点的核心判断？"
    )


def build_activities(
    diagnosis: Diagnosis,
    plan: StudyPlan,
    learner_state: LearnerUnitState,
    learning_unit: LearningUnit | None,
    session_type: str = "study",
) -> list[Activity]:
    if session_type == "project":
        return []

    unit_id = learning_unit.id if learning_unit is not None else diagnosis.focus_unit_id
    evidence = learner_state.weak_signals[:3] or (
        diagnosis.explanation.evidence[:3] if diagnosis.explanation is not None else []
    )
    activities: list[Activity] = []

    for index, step in enumerate(plan.steps):
        mode = step.mode
        kind = (
            "quiz"
            if mode == "contrast-drill"
            else "recall"
            if diagnosis.recommended_action == "review" or mode in ("image-recall", "audio-recall")
            else "coach-followup"
        )
        activities.append(
            Activity(
                id=f"activity-{unit_id or 'current'}-{mode}-{index + 1}",
                kind=kind,
                knowledge_point_id=unit_id,
                title=(
                    "先做一轮回忆校准"
                    if index == 0 and session_type == "review" and kind == "recall"
                    else _build_activity_title(
                        mode,
                        diagnosis.recommended_action,
                        learning_unit,
                    )
                    if index == 0
                    else f"第 {index + 1} 步：{step.title}"
                ),
                objective=step.outcome,
                prompt=_build_activity_prompt(
                    diagnosis.recommended_action,
                    mode,
                    learning_unit,
                ),
                support=step.reason if index > 0 else diagnosis.reason,
                mode=mode,
                evidence=evidence,
                submit_label=(
                    "提交判断"
                    if kind == "quiz"
                    else "提交回忆"
                    if kind == "recall"
                    else "提交作答"
                ),
                input=_build_activity_choice_set(
                    mode,
                    learning_unit,
                    diagnosis.recommended_action,
                ),
            )
        )

    return activities


def build_activity(
    diagnosis: Diagnosis,
    plan: StudyPlan,
    learner_state: LearnerUnitState,
    learning_unit: LearningUnit | None,
    session_type: str = "study",
) -> Activity | None:
    activities = build_activities(
        diagnosis,
        plan,
        learner_state,
        learning_unit,
        session_type,
    )
    return activities[0] if activities else None


def resolve_activities(
    diagnosis: Diagnosis,
    plan: StudyPlan,
    learner_state: LearnerUnitState,
    learning_unit: LearningUnit | None,
    llm: "LLMClient",
    *,
    topic: str,
    user_message: str,
    tool_result: ToolResult | None = None,
    session_type: str = "study",
    bundled_activities: list[Activity] | None = None,
) -> tuple[list[Activity], str]:
    if session_type == "project":
        return [], "project"

    if bundled_activities:
        return bundled_activities, "LLM-bundled"

    from xidea_agent.llm import llm_build_activities

    llm_activities = llm_build_activities(
        llm,
        topic,
        learning_unit.title if learning_unit is not None else topic,
        diagnosis,
        plan,
        learner_state,
        user_message,
        tool_result=tool_result,
        session_type=session_type,
    )
    if llm_activities:
        return llm_activities, "LLM"

    return (
        build_activities(
            diagnosis,
            plan,
            learner_state,
            learning_unit,
            session_type,
        ),
        "template",
    )


def _build_project_context_observations(project_context) -> list[Observation]:
    observations = [
        Observation(
            observation_id="project-context-topic",
            kind="project-note",
            source=f"{project_context.source}-project-context",
            summary=f"当前 project 主题：{project_context.topic}",
            detail={"projectId": project_context.project_id},
        )
    ]

    if project_context.source_asset_summary:
        observations.append(
            Observation(
                observation_id="project-context-assets",
                kind="project-note",
                source="project-assets",
                summary=project_context.source_asset_summary,
            )
        )

    if project_context.thread_memory_summary:
        observations.append(
            Observation(
                observation_id="project-context-thread-memory",
                kind="project-note",
                source="thread-memory",
                summary=project_context.thread_memory_summary,
            )
        )

    if project_context.review_summary:
        observations.append(
            Observation(
                observation_id="project-context-review",
                kind="project-note",
                source="review-context",
                summary=project_context.review_summary,
            )
        )

    if project_context.project_memory_summary:
        observations.append(
            Observation(
                observation_id="project-context-memory",
                kind="project-note",
                source="project-memory",
                summary=project_context.project_memory_summary,
            )
        )

    if project_context.project_learning_profile_summary:
        observations.append(
            Observation(
                observation_id="project-context-learning-profile",
                kind="project-note",
                source="project-learning-profile",
                summary=project_context.project_learning_profile_summary,
            )
        )

    return observations


def latest_user_message(messages: list[Message]) -> str:
    for message in reversed(messages):
        if message.role == "user":
            return message.content

    return messages[-1].content


def _multi_turn_frequency(
    messages: list[Message], keywords: tuple[str, ...], lowercase: bool = False
) -> int:
    """Count user messages in recent history that mention at least one keyword."""
    count = 0
    for msg in messages:
        if msg.role != "user":
            continue
        text = msg.content.lower() if lowercase else msg.content
        if any(kw in text for kw in keywords):
            count += 1
    return count


def _boost(base: float, turn_count: int, per_turn: float = 0.06) -> float:
    """Boost a value when multiple turns mention the same signal."""
    if turn_count <= 1:
        return base
    return min(1.0, base + per_turn * (turn_count - 1))


def _score_actions(
    learner_state: LearnerUnitState,
    review_decision: ReviewDecision,
    prior_state: LearnerUnitState | None = None,
) -> dict[PedagogicalAction, float]:
    """Score each pedagogical action; highest score wins."""
    scores: dict[PedagogicalAction, float] = {
        "clarify": 0.0,
        "teach": 0.0,
        "review": 0.0,
        "apply": 0.0,
        "practice": 0.12,
    }

    confusion = learner_state.confusion_level
    understanding = learner_state.understanding_level
    transfer = learner_state.transfer_readiness

    if confusion > 40:
        scores["clarify"] = min(1.0, (confusion - 40) / 25)

    if review_decision.should_review:
        scores["review"] = review_decision.priority

    if understanding < 60:
        scores["teach"] = min(1.0, (60 - understanding) / 60) * 0.7

    if transfer < 50:
        scores["apply"] = min(1.0, (50 - transfer) / 50) * 0.6

    if prior_state and prior_state.recommended_action:
        pa = prior_state.recommended_action
        if pa == "clarify" and prior_state.confusion_level >= 55:
            scores["clarify"] *= 0.75
        elif pa == "teach" and prior_state.understanding_level <= 55:
            scores["teach"] *= 0.75
        elif pa == "review" and prior_state.memory_strength <= 45:
            scores["review"] *= 0.75
        elif pa == "apply" and prior_state.transfer_readiness <= 45:
            scores["apply"] *= 0.75

    return scores


def build_signals(
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    prior_state: LearnerUnitState | None = None,
) -> list[Signal]:
    message = latest_user_message(messages)
    lowered = message.lower()
    observation_ids = [item.observation_id for item in observations]

    confusion_turns = _multi_turn_frequency(messages, CONFUSION_KEYWORDS)
    understanding_turns = _multi_turn_frequency(messages, UNDERSTANDING_KEYWORDS)
    recall_turns = _multi_turn_frequency(messages, RECALL_KEYWORDS)
    transfer_turns = _multi_turn_frequency(messages, TRANSFER_KEYWORDS)
    practice_turns = _multi_turn_frequency(messages, PRACTICE_KEYWORDS, lowercase=True)

    signals: list[Signal] = [
        Signal(
            kind="project-relevance",
            score=0.8,
            confidence=0.8,
            summary="当前问题带有明确项目上下文，适合围绕真实任务编排学习动作。",
            based_on=observation_ids[:1],
        )
    ]

    if any(keyword in message for keyword in CONFUSION_KEYWORDS):
        signals.append(
            Signal(
                kind="concept-confusion",
                score=_boost(0.82, confusion_turns),
                confidence=_boost(0.86, confusion_turns, per_turn=0.04),
                summary=f"用户明确表达概念边界混淆（{confusion_turns}轮提及），优先澄清区别而不是继续泛讲。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in message for keyword in UNDERSTANDING_KEYWORDS):
        signals.append(
            Signal(
                kind="concept-gap",
                score=_boost(0.76, understanding_turns),
                confidence=_boost(0.8, understanding_turns, per_turn=0.04),
                summary=f"用户当前更像在补理解框架（{understanding_turns}轮提及），还没有形成稳定解释。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in message for keyword in RECALL_KEYWORDS):
        signals.append(
            Signal(
                kind="memory-weakness",
                score=_boost(0.8, recall_turns),
                confidence=_boost(0.78, recall_turns, per_turn=0.04),
                summary=f"用户显式提到复习或遗忘（{recall_turns}轮提及），当前存在记忆稳定性风险。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in message for keyword in TRANSFER_KEYWORDS):
        signals.append(
            Signal(
                kind="transfer-readiness",
                score=_boost(0.42, transfer_turns),
                confidence=_boost(0.72, transfer_turns, per_turn=0.04),
                summary=f"问题已经落到项目设计或答辩场景（{transfer_turns}轮提及），需要验证是否会迁移应用。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in lowered for keyword in PRACTICE_KEYWORDS):
        signals.append(
            Signal(
                kind="transfer-readiness",
                score=_boost(0.38, practice_turns),
                confidence=_boost(0.75, practice_turns, per_turn=0.04),
                summary=f"用户有主动演练意图（{practice_turns}轮提及），适合进入练习或情境验证。",
                based_on=observation_ids[:1],
            )
        )

    if entry_mode == "material-import":
        signals.append(
            Signal(
                kind="project-relevance",
                score=0.9,
                confidence=0.9,
                summary="当前入口包含材料导入，说明补材料上下文本身是主链路的一部分。",
                based_on=observation_ids,
            )
        )

    if prior_state is not None:
        if prior_state.confusion_level >= 45 and confusion_turns > 0:
            signals.append(
                Signal(
                    kind="concept-confusion",
                    score=0.65,
                    confidence=0.72,
                    summary=f"混淆度持续偏高（prior={prior_state.confusion_level}），趋势信号。",
                    based_on=["prior-state-trend"],
                )
            )

        if prior_state.memory_strength <= 50 and recall_turns == 0:
            signals.append(
                Signal(
                    kind="memory-weakness",
                    score=0.55,
                    confidence=0.6,
                    summary=f"记忆强度偏低（prior={prior_state.memory_strength}）但用户未主动提及，可能存在隐性遗忘风险。",
                    based_on=["prior-state-trend"],
                )
            )

    return signals


def estimate_learner_state(
    target_unit_id: str | None,
    signals: list[Signal],
    prior_state: LearnerUnitState | None = None,
) -> LearnerUnitState:
    mastery = prior_state.mastery if prior_state else 58
    understanding = prior_state.understanding_level if prior_state else 60
    memory_strength = prior_state.memory_strength if prior_state else 58
    confusion = prior_state.confusion_level if prior_state else 30
    transfer_readiness = prior_state.transfer_readiness if prior_state else 55
    weak_signals: list[str] = list(prior_state.weak_signals) if prior_state else []

    signal_kinds_seen: set[str] = set()
    kind_count: dict[str, int] = {}
    for signal in signals:
        w = signal.confidence
        kind_count[signal.kind] = kind_count.get(signal.kind, 0) + 1
        repeat_damping = 1.0 / kind_count[signal.kind]

        if signal.kind == "concept-confusion":
            confusion += int(22 * w * repeat_damping)
            understanding -= int(8 * w * repeat_damping)
            mastery -= int(5 * w * repeat_damping)
            weak_signals.append("概念边界混淆")
        elif signal.kind == "concept-gap":
            understanding -= int(16 * w * repeat_damping)
            mastery -= int(7 * w * repeat_damping)
            weak_signals.append("理解框架不稳")
        elif signal.kind == "memory-weakness":
            memory_strength -= int(18 * w * repeat_damping)
            weak_signals.append("关键概念记忆不稳")
        elif signal.kind == "transfer-readiness":
            transfer_readiness -= int(12 * w * repeat_damping)
            mastery -= int(4 * w * repeat_damping)
            weak_signals.append("还不能稳定迁移到真实场景")
        signal_kinds_seen.add(signal.kind)

    active_signal_count = sum(1 for s in signals if s.kind != "project-relevance")
    source_diversity = len(signal_kinds_seen - {"project-relevance"})
    confidence = min(0.95, 0.55 + 0.06 * active_signal_count + 0.05 * source_diversity)

    return LearnerUnitState(
        unit_id=target_unit_id or "rag-core-unit",
        mastery=max(0, min(100, mastery)),
        understanding_level=max(0, min(100, understanding)),
        memory_strength=max(0, min(100, memory_strength)),
        confusion_level=max(0, min(100, confusion)),
        transfer_readiness=max(0, min(100, transfer_readiness)),
        weak_signals=list(dict.fromkeys(weak_signals)),
        confidence=round(confidence, 2),
        based_on=[signal.summary for signal in signals],
        updated_at=datetime.now(UTC),
    )


def diagnose_state(
    entry_mode: str,
    target_unit_id: str | None,
    learner_state: LearnerUnitState,
    prior_state: LearnerUnitState | None = None,
    next_review_at: datetime | None = None,
) -> Diagnosis:
    needs_tool = entry_mode == "material-import"

    if not target_unit_id and entry_mode != "material-import":
        return Diagnosis(
            recommended_action="clarify",
            reason="当前线程还缺少明确学习单元，先补齐上下文再做更稳的判断。",
            confidence=learner_state.confidence,
            focus_unit_id=learner_state.unit_id,
            primary_issue="missing-context",
            needs_tool=True,
            explanation=build_explanation(
                learner_state,
                "当前线程还缺少明确学习单元，先补齐上下文再做更稳的判断。",
            ),
        )

    review_decision = should_enter_review(
        understanding_level=learner_state.understanding_level,
        confusion_level=learner_state.confusion_level,
        memory_strength=learner_state.memory_strength,
        next_review_at=next_review_at,
    )

    scores = _score_actions(learner_state, review_decision, prior_state=prior_state)
    action: PedagogicalAction = max(scores, key=lambda k: scores[k])

    issue = ACTION_ISSUE[action]
    if action == "review":
        reason = review_decision.reason
    else:
        reason = ACTION_REASON.get(action, "当前适合通过练习把已有理解转成更稳定的应用能力。")

    return Diagnosis(
        recommended_action=action,
        reason=reason,
        confidence=learner_state.confidence,
        focus_unit_id=learner_state.unit_id,
        primary_issue=issue,
        needs_tool=needs_tool,
        explanation=build_explanation(learner_state, reason, action_scores=scores),
    )


def build_explanation(
    learner_state: LearnerUnitState,
    summary: str,
    action_scores: dict[PedagogicalAction, float] | None = None,
) -> Explanation:
    evidence = [
        f"understanding={learner_state.understanding_level}",
        f"memory={learner_state.memory_strength}",
        f"confusion={learner_state.confusion_level}",
        f"transfer={learner_state.transfer_readiness}",
    ]
    if action_scores:
        ranked = sorted(action_scores.items(), key=lambda x: x[1], reverse=True)
        evidence.append("action-scores: " + ", ".join(f"{k}={v:.2f}" for k, v in ranked))
    return Explanation(
        summary=summary,
        evidence=evidence,
        confidence=learner_state.confidence,
    )


def choose_tool_intent(entry_mode: str, diagnosis: Diagnosis) -> ToolIntent:
    if not diagnosis.needs_tool:
        return "none"

    if entry_mode == "material-import":
        return "asset-summary"
    if diagnosis.recommended_action == "review":
        return "review-context"
    if entry_mode == "coach-followup":
        return "thread-memory"

    return "unit-detail"


def selected_mode_for_action(action: PedagogicalAction) -> LearningMode:
    if action == "clarify":
        return "contrast-drill"
    if action == "teach":
        return "guided-qa"
    if action == "review":
        return "guided-qa"
    if action == "apply":
        return "scenario-sim"
    return "socratic"


def build_plan(
    topic: str,
    learning_unit_title: str,
    candidate_modes: list[LearningMode],
    diagnosis: Diagnosis,
    learner_state: LearnerUnitState,
    session_type: str = "study",
) -> StudyPlan:
    if session_type == "project":
        effective_title = learning_unit_title or topic
        step_title = "先对齐这轮学习方向" if diagnosis.recommended_action == "clarify" else "先围绕当前主题推进判断"
        step_reason = (
            "当前 project session 更需要先明确想学什么、先讨论哪个主题、是否还缺材料，"
            "再决定知识点怎么更新。"
            if diagnosis.recommended_action == "clarify"
            else "当前 project session 先围绕用户的问题给出主题判断，"
            "再决定是否需要补材料、提出知识点更新建议或切到 study/review session。"
        )
        step_outcome = "得到一个可继续推进的学习方向判断，并明确材料缺口或知识点更新建议。"
        return StudyPlan(
            headline=f"围绕「{effective_title}」推进当前 project 学习讨论",
            summary="当前是 project session，这轮先围绕学习方向、主题讨论、材料线索和知识点更新推进，不直接进入学习/复习作答。",
            selected_mode="guided-qa",
            expected_outcome="明确当前 project 要先推进的学习方向，并决定是否需要补材料、更新知识点或单独开启 study/review session。",
            steps=[
                StudyPlanStep(
                    id="project-chat-next-step",
                    title=step_title,
                    mode="guided-qa",
                    reason=step_reason,
                    outcome=step_outcome,
                )
            ],
        )

    steps: list[StudyPlanStep] = []
    candidates = set(candidate_modes)

    def allow(mode: LearningMode) -> bool:
        return not candidates or mode in candidates

    if diagnosis.recommended_action == "clarify":
        if allow("contrast-drill"):
            steps.append(
                StudyPlanStep(
                    id="contrast-boundary",
                    title=MODE_LABELS["contrast-drill"],
                    mode="contrast-drill",
                    reason="先比较相近概念的边界，避免继续带着错误模型推进项目。",
                    outcome="用户能说清两个概念分别解决什么问题。",
                )
            )
        if allow("guided-qa"):
            steps.append(
                StudyPlanStep(
                    id="guided-check",
                    title=MODE_LABELS["guided-qa"],
                    mode="guided-qa",
                    reason="在澄清边界后立即追问，确认不是表面上听懂。",
                    outcome="系统能判断理解是否真正稳定下来。",
                )
            )
    elif diagnosis.recommended_action == "teach":
        if allow("guided-qa"):
            steps.append(
                StudyPlanStep(
                    id="guided-model",
                    title=MODE_LABELS["guided-qa"],
                    mode="guided-qa",
                    reason="先补关键设计框架，建立能解释问题的骨架。",
                    outcome="用户能用自己的话复述当前主题的核心判断逻辑。",
                )
            )
        if allow("scenario-sim"):
            steps.append(
                StudyPlanStep(
                    id="scenario-check",
                    title=MODE_LABELS["scenario-sim"],
                    mode="scenario-sim",
                    reason="补完框架后立刻放回项目场景，防止理解停留在抽象层。",
                    outcome="确认知识能否映射到真实项目取舍。",
                )
            )
    elif diagnosis.recommended_action == "review":
        if allow("guided-qa"):
            steps.append(
                StudyPlanStep(
                    id="recall-core",
                    title=MODE_LABELS["guided-qa"],
                    mode="guided-qa",
                    reason="先做主动回忆，判断记忆断点到底在哪里。",
                    outcome="确认哪些概念已掉出可用工作记忆。",
                )
            )
        if allow("contrast-drill"):
            steps.append(
                StudyPlanStep(
                    id="contrast-fix",
                    title=MODE_LABELS["contrast-drill"],
                    mode="contrast-drill",
                    reason="对混淆点做一次快速辨析，减少下一次再次出错的概率。",
                    outcome="把高风险混淆重新压回稳定区间。",
                )
            )
    else:
        primary_mode: LearningMode = "scenario-sim" if diagnosis.recommended_action == "apply" else "socratic"
        if allow(primary_mode):
            steps.append(
                StudyPlanStep(
                    id="project-sim",
                    title=MODE_LABELS[primary_mode],
                    mode=primary_mode,
                    reason="当前最有价值的是把知识放回项目语境，看能否解释设计取舍。",
                    outcome="用户能把当前主题映射到自己项目里的判断动作。",
                )
            )
        if allow("guided-qa"):
            steps.append(
                StudyPlanStep(
                    id="gap-check",
                    title=MODE_LABELS["guided-qa"],
                    mode="guided-qa",
                    reason="在应用之后回头追问，确认迁移过程中暴露出的新缺口。",
                    outcome="为下一轮诊断留下更清晰的状态依据。",
                )
            )

    if not steps:
        steps.append(
            StudyPlanStep(
                id="fallback-guided",
                title=MODE_LABELS["guided-qa"],
                mode="guided-qa",
                reason="当前候选模式不足，先回到最稳的导师问答继续推进。",
                outcome="先保留编排闭环，再在下一轮补更多上下文。",
            )
        )

    effective_title = learning_unit_title or topic
    return StudyPlan(
        headline=f"围绕「{effective_title}」的动态学习路径",
        summary=(
            f"系统综合理解水平 {learner_state.understanding_level}、记忆强度 "
            f"{learner_state.memory_strength} 和混淆风险 {learner_state.confusion_level}，"
            f"决定先执行 {MODE_LABELS[steps[0].mode]}。"
        ),
        selected_mode=steps[0].mode,
        expected_outcome="让下一轮判断不只基于口头回答，而基于更可检视的学习表现。",
        steps=steps[:3],
    )


def compose_assistant_message(
    diagnosis: Diagnosis,
    plan: StudyPlan | None,
    tool_result: ToolResult | None,
    session_type: str = "study",
) -> str:
    if session_type == "project":
        message = (
            "当前是 project session，这轮我会先围绕你现在的学习方向和主题问题继续推进，"
            "再决定是否需要补材料、提出知识点更新建议或切到 study/review session。"
        )
        if tool_result is not None:
            message += f" 在开始前，我会先补一层 {tool_result.kind} 上下文，避免主题判断建立在信息缺口上。"
        return message

    if plan is not None:
        message = (
            f"{diagnosis.reason} 这轮我会先用「{plan.steps[0].title}」推进，"
            f"目标是{plan.steps[0].outcome}"
        )
    else:
        message = f"{diagnosis.reason} 这轮我先直接把最关键的判断讲清楚，再补上后续学习路径。"
    if tool_result is not None:
        message += f"。在开始前，我会先补一层 {tool_result.kind} 上下文，避免判断建立在信息缺口上。"
    else:
        message += "。"
    return message


def build_state_patch(
    diagnosis: Diagnosis,
    learner_state: LearnerUnitState,
    plan: StudyPlan,
    session_type: str = "study",
) -> StatePatch:
    if session_type == "project":
        return StatePatch()

    learner_patch = LearnerStatePatch(
        mastery=learner_state.mastery,
        understanding_level=learner_state.understanding_level,
        memory_strength=learner_state.memory_strength,
        confusion_level=learner_state.confusion_level,
        transfer_readiness=learner_state.transfer_readiness,
        weak_signals=learner_state.weak_signals,
        recommended_action=diagnosis.recommended_action,
    )

    review_patch: ReviewPatch | None = None
    if diagnosis.recommended_action == "review":
        now = datetime.now(UTC)
        next_review = schedule_next_review(review_count=0, recall_success=True, now=now)
        review_patch = ReviewPatch(
            due_unit_ids=[learner_state.unit_id],
            scheduled_at=next_review,
            review_reason="当前暴露出记忆稳定性不足，需要安排下一次定向复盘。",
            review_count=1,
            lapse_count=0,
        )
        learner_patch.last_reviewed_at = now
        learner_patch.next_review_at = next_review

    return StatePatch(
        learner_state_patch=learner_patch,
        last_action={
            "action": diagnosis.recommended_action,
            "mode": plan.selected_mode,
            "unit_id": learner_state.unit_id,
        },
        review_patch=review_patch,
    )


def _build_project_relevance_keywords(topic: str) -> set[str]:
    keywords = {keyword.lower() for keyword in PROJECT_CHAT_RELEVANCE_HINTS}
    keywords.update(match.group(0).lower() for match in re.finditer(r"[A-Za-z0-9_-]{2,}", topic))
    keywords.update(match.group(0) for match in re.finditer(r"[\u4e00-\u9fff]{2,8}", topic))
    return keywords


def _detect_off_topic_reason(state: GraphState) -> str | None:
    if state.request.entry_mode != "chat-question":
        return None
    if state.request.target_unit_id is not None:
        return None

    message = latest_user_message(state.request.messages).strip()
    if not message:
        return None

    project_topic = state.project_context.topic if state.project_context is not None else state.request.topic
    lowered_message = message.lower()
    if any(keyword in lowered_message for keyword in _build_project_relevance_keywords(project_topic)):
        return None

    for category, cues in OFF_TOPIC_CUE_GROUPS:
        if any(cue in lowered_message for cue in cues):
            return (
                f"这条消息已经偏离当前 project「{project_topic}」了，"
                f"现在更像是在问{category}类问题。"
            )
    return None


def _build_off_topic_plan(project_topic: str) -> StudyPlan:
    return StudyPlan(
        headline=f"先回到「{project_topic}」这个 project",
        summary="当前消息明显偏离 project 范围，这轮不会推进学习编排或知识点治理。",
        selected_mode="guided-qa",
        expected_outcome="下一条消息重新落到当前 project 的主题、材料、知识点或答辩场景里。",
        steps=[
            StudyPlanStep(
                id="return-to-project",
                title="回到当前 project",
                mode="guided-qa",
                reason="继续按 off-topic 消息做学习编排会污染 project memory 和知识点池。",
                outcome="把问题拉回当前 project 的主题、材料、知识点或答辩场景。",
            )
        ],
    )


def _apply_off_topic_guardrail(state: GraphState, reason: str) -> GraphState:
    project_topic = state.project_context.topic if state.project_context is not None else state.request.topic
    assistant_message = (
        f"{reason} 这轮我不会把它写入学习状态、knowledge point 或 review 轨迹。"
        "如果继续当前 project，请直接回到主题、材料、知识点或答辩场景。"
    )
    state.is_off_topic = True
    state.off_topic_reason = reason
    state.diagnosis = Diagnosis(
        recommended_action="teach",
        reason=reason,
        confidence=0.95,
        focus_unit_id=None,
        primary_issue="off-topic",
        needs_tool=False,
        explanation=Explanation(
            summary="当前消息明显偏离 project 范围，先阻断写回并提醒用户回到主线。",
            evidence=[
                f"project_topic={project_topic}",
                f"latest_message={latest_user_message(state.request.messages)}",
            ],
            confidence=0.95,
        ),
    )
    state.plan = _build_off_topic_plan(project_topic)
    state.assistant_message = assistant_message
    state.activity = None
    state.activities = []
    state.knowledge_point_suggestions = []
    state.state_patch = StatePatch()
    state.rationale.append("off_topic guardrail short-circuited the learning path before LLM diagnosis.")
    return state


def guard_off_topic_step(state: GraphState) -> GraphState:
    reason = _detect_off_topic_reason(state)
    if reason is None:
        return state
    return _apply_off_topic_guardrail(state, reason)


def _is_session_capability_message(message: str) -> bool:
    normalized = " ".join(message.strip().lower().split())
    if not normalized:
        return False
    return any(cue in normalized for cue in SESSION_CAPABILITY_CUES)


def _build_session_capability_plan(
    session_type: str,
    project_topic: str,
    unit_title: str,
) -> StudyPlan:
    if session_type == "project":
        return StudyPlan(
            headline=f"先对齐「{project_topic}」这轮 project 想怎么推进",
            summary="用户当前在确认当前 session 能做什么，这轮先说明 project session 的职责边界。",
            selected_mode="guided-qa",
            expected_outcome="用户知道可以先从学习方向、主题讨论、材料或知识点更新中的哪一项开始。",
            steps=[
                StudyPlanStep(
                    id="project-session-capability",
                    title="先说明当前 session 的推进方式",
                    mode="guided-qa",
                    reason="先把当前 session 能承接什么说清楚，后续对话才不会漂成泛化闲聊。",
                    outcome="把下一条消息收成明确的学习方向、主题问题、材料或知识点诉求。",
                )
            ],
        )

    if session_type == "review":
        return StudyPlan(
            headline=f"先对齐「{unit_title}」这轮复习要怎么开始",
            summary="用户当前在确认 review session 能做什么，这轮先说明复习 session 的职责边界，不直接出卡。",
            selected_mode="guided-qa",
            expected_outcome="用户知道这轮会围绕主动回忆和短反馈推进，并给出一个明确的复习切入点。",
            steps=[
                StudyPlanStep(
                    id="review-session-capability",
                    title="先说明当前复习 session 的推进方式",
                    mode="guided-qa",
                    reason="先把复习 session 的能力边界说清楚，再进入回忆校准，能避免把 meta 提问误当成作答。",
                    outcome="把下一条消息收成具体要回忆的判断标准、薄弱点或开始指令。",
                )
            ],
        )

    return StudyPlan(
        headline=f"先对齐「{unit_title}」这轮学习要怎么开始",
        summary="用户当前在确认 study session 能做什么，这轮先说明学习 session 的职责边界，不直接出卡。",
        selected_mode="guided-qa",
        expected_outcome="用户知道这轮会围绕知识点理解和边界澄清推进，并给出一个明确的学习切入点。",
        steps=[
            StudyPlanStep(
                id="study-session-capability",
                title="先说明当前学习 session 的推进方式",
                mode="guided-qa",
                reason="先把学习 session 的能力边界说清楚，再进入卡组，能避免把 meta 提问误当成学习作答。",
                outcome="把下一条消息收成具体没想通的点、想验证的判断，或开始指令。",
            )
        ],
    )


def _build_session_capability_message(
    session_type: str,
    project_topic: str,
    unit_title: str,
) -> str:
    if session_type == "project":
        return (
            f"当前是围绕「{project_topic}」的 project session。"
            "我可以帮你对齐学习方向、围绕主题继续讨论、补相关材料，并在过程中提出知识点更新建议。"
            "你可以直接告诉我现在最想推进的问题、材料或知识点。"
        )

    if session_type == "review":
        return (
            f"当前是围绕「{unit_title}」的 review session。"
            "我会优先帮你做主动回忆和短反馈，判断现在更像是记忆走弱还是概念边界还没稳。"
            "你可以直接说想先回忆哪个判断标准，或者告诉我“开始这轮复习”。"
        )

    return (
        f"当前是围绕「{unit_title}」的 study session。"
        "我可以帮你讲清这个知识点、拉开关键边界、安排一组受约束学习动作，并根据你的表现继续调整下一步。"
        "你可以直接说哪里没想通，或者告诉我“开始这轮学习”。"
    )


def _apply_session_capability_guardrail(state: GraphState) -> GraphState:
    project_topic = state.project_context.topic if state.project_context is not None else state.request.topic
    unit_title = state.learning_unit.title if state.learning_unit is not None else project_topic
    state.diagnosis = Diagnosis(
        recommended_action="clarify",
        reason=(
            "用户这轮主要是在确认当前 session 能做什么，"
            "先说明能力边界和进入方式，不直接进入学习/复习动作。"
        ),
        confidence=0.95,
        focus_unit_id=state.request.target_unit_id,
        primary_issue="missing-context",
        needs_tool=False,
        explanation=Explanation(
            summary="session capability guard 检测到 meta/capability 提问，先返回 session 说明而不是学习动作。",
            evidence=[
                f"session_type={state.request.session_type}",
                f"latest_message={latest_user_message(state.request.messages)}",
            ],
            confidence=0.95,
        ),
    )
    state.plan = _build_session_capability_plan(state.request.session_type, project_topic, unit_title)
    state.assistant_message = _build_session_capability_message(
        state.request.session_type,
        project_topic,
        unit_title,
    )
    state.activity = None
    state.activities = []
    state.knowledge_point_suggestions = []
    state.state_patch = StatePatch()
    state.rationale.append(
        "session_capability guard short-circuited the learning path before LLM diagnosis."
    )
    return state


def guard_session_capability_step(state: GraphState) -> GraphState:
    message = latest_user_message(state.request.messages).strip()
    if not _is_session_capability_message(message):
        return state
    return _apply_session_capability_guardrail(state)


def _is_low_information_project_message(message: str, project_topic: str) -> bool:
    normalized = " ".join(message.strip().lower().split())
    if not normalized:
        return True

    if normalized in PROJECT_CHAT_LOW_INFO_MESSAGES:
        return True

    if any(keyword in normalized for keyword in _build_project_relevance_keywords(project_topic)):
        return False

    ascii_tokens = re.findall(r"[a-z0-9_-]+", normalized)
    chinese_chunks = re.findall(r"[\u4e00-\u9fff]+", normalized)

    if len(normalized) <= 6:
        return True
    if ascii_tokens and len(ascii_tokens) <= 2 and len(normalized) <= 12:
        return True
    if chinese_chunks and all(len(chunk) <= 3 for chunk in chinese_chunks) and len(normalized) <= 8:
        return True
    return False


def _build_project_chat_clarification_plan(project_topic: str) -> StudyPlan:
    return StudyPlan(
        headline=f"先对齐「{project_topic}」这轮想推进的学习方向",
        summary="当前输入信息不足，这轮先按 project 对话澄清目标，不直接进入学习或复习编排。",
        selected_mode="guided-qa",
        expected_outcome="明确这轮是先对齐学习方向、围绕主题讨论、补相关材料、更新知识点，还是切到 study/review session。",
        steps=[
            StudyPlanStep(
                id="project-chat-clarify",
                title="继续推进当前学习讨论",
                mode="guided-qa",
                reason="先把这轮想推进的学习方向、主题判断或材料缺口说清楚，才能决定是否需要知识点更新或单独开学习 session。",
                outcome="得到一个明确的 project 学习目标，而不是把低信息输入误判成学习动作。",
            )
        ],
    )


def _apply_project_chat_low_info_guardrail(state: GraphState) -> GraphState:
    project_topic = state.project_context.topic if state.project_context is not None else state.request.topic
    state.diagnosis = Diagnosis(
        recommended_action="clarify",
        reason=(
            "当前是 project session，但这条输入还不足以支撑知识点判断或学习/复习编排，"
            "先把这轮想推进的学习方向、主题问题或材料需求说具体。"
        ),
        confidence=0.95,
        focus_unit_id=state.request.target_unit_id,
        primary_issue="missing-context",
        needs_tool=False,
        explanation=Explanation(
            summary="project session 遇到低信息输入时先做 project-chat 澄清，避免误触学习动作。",
            evidence=[
                f"session_type={state.request.session_type}",
                f"latest_message={latest_user_message(state.request.messages)}",
            ],
            confidence=0.95,
        ),
    )
    state.plan = _build_project_chat_clarification_plan(project_topic)
    state.assistant_message = (
        f"当前是围绕「{project_topic}」的 project session，"
        "我会先围绕学习方向、主题问题和材料线索继续推进，不会直接进入学习或复习作答。"
        "你现在更想继续哪一类：对齐学习方向、围绕主题讨论、补充相关材料、更新知识点，还是切到 study/review session？"
    )
    state.activity = None
    state.activities = []
    state.knowledge_point_suggestions = []
    state.state_patch = StatePatch()
    state.rationale.append(
        "project_chat low-info guardrail short-circuited the learning path before LLM diagnosis."
    )
    return state


def guard_project_chat_low_info_step(state: GraphState) -> GraphState:
    if state.request.session_type != "project":
        return state
    if state.request.entry_mode != "chat-question":
        return state

    message = latest_user_message(state.request.messages).strip()
    project_topic = state.project_context.topic if state.project_context is not None else state.request.topic
    if not _is_low_information_project_message(message, project_topic):
        return state
    return _apply_project_chat_low_info_guardrail(state)


def _project_session_response_looks_pedagogical(reply: str, plan: StudyPlan | None) -> bool:
    text_parts = [reply]
    if plan is not None:
        text_parts.extend([
            plan.headline,
            plan.summary,
            plan.expected_outcome,
            *(step.title for step in plan.steps),
            *(step.reason for step in plan.steps),
            *(step.outcome for step in plan.steps),
        ])
        if plan.selected_mode in PROJECT_SESSION_UNSAFE_MODES:
            return True

    combined = "\n".join(part for part in text_parts if part).lower()
    return any(cue.lower() in combined for cue in PROJECT_SESSION_PEDAGOGICAL_CUES)


def _should_accept_project_session_response(
    state: GraphState,
    reply: str,
    plan: StudyPlan | None,
) -> bool:
    if state.request.session_type != "project":
        return True
    return not _project_session_response_looks_pedagogical(reply, plan)


def _infer_knowledge_point_candidate(message: str) -> tuple[str, str, str] | None:
    compact_message = " ".join(message.strip().split())
    if not compact_message or not any(hint in compact_message for hint in SUGGESTION_HINTS):
        return None

    pair = COMPARISON_PATTERN.search(compact_message)
    if pair is None:
        return None

    left = pair.group("left").strip()
    right = pair.group("right").strip()
    title = build_boundary_title(left, right)
    canonical_left, canonical_right = title.removesuffix(" 的边界").split(" 与 ", maxsplit=1)
    description = (
        f"沉淀「{canonical_left} 与 {canonical_right}」这组概念边界，"
        "避免 project chat 里反复出现同类混淆。"
    )
    reason = (
        f"当前 project chat 直接暴露出「{canonical_left}」与「{canonical_right}」的概念边界混淆，"
        "建议把它收成独立知识点，后续学习和复习都围绕这条边界组织。"
    )
    return title, description, reason


def _build_create_knowledge_point_suggestion(
    state: GraphState,
    repository: SQLiteRepository | None,
    timestamp: datetime,
) -> KnowledgePointSuggestion | None:
    if state.diagnosis is None or state.diagnosis.primary_issue != "concept-confusion":
        return None

    latest_message_text = next(
        (message.content for message in reversed(state.request.messages) if message.role == "user"),
        "",
    )
    candidate = _infer_knowledge_point_candidate(latest_message_text)
    if candidate is None:
        return None

    title, description, reason = candidate
    candidate_key = knowledge_point_identity_key(title)
    existing_keys: set[str] = set()
    if repository is not None:
        existing_keys.update(
            knowledge_point_identity_key(point.title)
            for point in repository.list_project_knowledge_points(state.request.project_id)
        )
        existing_keys.update(
            knowledge_point_identity_key(suggestion.title)
            for suggestion in repository.list_knowledge_point_suggestions(
                state.request.project_id,
                statuses=["pending", "accepted"],
            )
            if suggestion.kind == "create"
        )
    if candidate_key in existing_keys:
        return None

    return KnowledgePointSuggestion(
        id=build_suggestion_id(
            state.request.project_id,
            state.request.thread_id,
            title,
        ),
        kind="create",
        project_id=state.request.project_id,
        session_id=state.request.thread_id,
        title=title,
        description=description,
        reason=reason,
        source_material_refs=list(
            state.project_context.source_asset_ids if state.project_context is not None else []
        ),
        status="pending",
        created_at=timestamp,
        updated_at=timestamp,
    )


def _is_archive_ready(now: datetime, point: KnowledgePoint, point_state: KnowledgePointState) -> bool:
    if point.status != "active":
        return False
    if point_state.archive_suggested:
        return False
    if point_state.mastery < ARCHIVE_READY_MIN_MASTERY:
        return False

    learning_ready = point_state.learning_status.lower() in ARCHIVE_READY_LEARNING_STATUSES
    review_ready = point_state.review_status.lower() in ARCHIVE_READY_REVIEW_STATUSES
    if not (learning_ready or review_ready):
        return False
    if point_state.next_review_at is None:
        return True
    return point_state.next_review_at >= now + ARCHIVE_READY_MIN_REVIEW_GAP


def _build_archive_knowledge_point_suggestion(
    state: GraphState,
    repository: SQLiteRepository | None,
    timestamp: datetime,
) -> KnowledgePointSuggestion | None:
    if repository is None:
        return None

    existing_archive_ids = {
        suggestion.knowledge_point_id
        for suggestion in repository.list_knowledge_point_suggestions(
            state.request.project_id,
            statuses=["pending", "accepted"],
        )
        if suggestion.kind == "archive" and suggestion.knowledge_point_id is not None
    }
    for point in repository.list_project_knowledge_points(state.request.project_id):
        if point.id in existing_archive_ids:
            continue
        point_state = repository.get_knowledge_point_state(point.id)
        if point_state is None or not _is_archive_ready(timestamp, point, point_state):
            continue
        return KnowledgePointSuggestion(
            id=build_suggestion_id(
                state.request.project_id,
                state.request.thread_id,
                point.title,
            ),
            kind="archive",
            project_id=state.request.project_id,
            session_id=state.request.thread_id,
            knowledge_point_id=point.id,
            title=point.title,
            description=point.description,
            reason=(
                f"「{point.title}」已经连续处在稳定区间，短期内没有新的复习压力，"
                "继续留在 active 知识点池只会增加噪声，建议归档。"
            ),
            source_material_refs=list(point.source_material_refs),
            status="pending",
            created_at=timestamp,
            updated_at=timestamp,
        )
    return None


def build_knowledge_point_suggestions(
    state: GraphState,
    repository: SQLiteRepository | None = None,
) -> list[KnowledgePointSuggestion]:
    if state.diagnosis is None or state.is_off_topic:
        return []
    if state.request.session_type != "project":
        return []
    if state.request.entry_mode != "chat-question":
        return []
    if state.request.target_unit_id is not None:
        return []

    timestamp = datetime.now(UTC)
    create_suggestion = _build_create_knowledge_point_suggestion(state, repository, timestamp)
    if create_suggestion is not None:
        return [create_suggestion]

    archive_suggestion = _build_archive_knowledge_point_suggestion(state, repository, timestamp)
    if archive_suggestion is not None:
        return [archive_suggestion]

    return []


def build_events(
    message: str,
    diagnosis: Diagnosis,
    plan: StudyPlan,
    state_patch: StatePatch,
    activity: Activity | None = None,
    activities: list[Activity] | None = None,
    knowledge_point_suggestions: list[KnowledgePointSuggestion] | None = None,
):
    events = [
        DiagnosisEvent(event="diagnosis", diagnosis=diagnosis),
        TextDeltaEvent(event="text-delta", delta=message),
        PlanEvent(event="plan", plan=plan),
    ]
    normalized_activities = activities or ([activity] if activity is not None else [])
    if normalized_activities:
        events.append(ActivitiesEvent(event="activities", activities=normalized_activities))
    if knowledge_point_suggestions:
        events.append(
            KnowledgePointSuggestionEvent(
                event="knowledge-point-suggestion",
                suggestions=knowledge_point_suggestions,
            )
        )
    events.extend([
        StatePatchEvent(event="state-patch", state_patch=state_patch),
        DoneEvent(event="done", final_message=message),
    ])
    return events


def _build_status_event(phase: str, message: str | None = None) -> StatusEvent:
    return StatusEvent(
        event="status",
        phase=phase,
        message=message or SESSION_STATUS_MESSAGES[phase],
    )


def _candidate_modes_for_session(
    learning_unit: LearningUnit | None,
    session_type: str,
) -> list[LearningMode]:
    if learning_unit is None:
        return []

    base = list(learning_unit.candidate_modes)
    if not base:
        return []

    if session_type == "project":
        ordered = [mode for mode in ("guided-qa", "contrast-drill") if mode in base]
        ordered.extend(
            mode for mode in base if mode not in ordered and mode not in PROJECT_SESSION_UNSAFE_MODES
        )
        return ordered

    preferred_orders: dict[str, tuple[LearningMode, ...]] = {
        "study": ("guided-qa", "contrast-drill", "scenario-sim"),
        "review": ("guided-qa", "contrast-drill", "scenario-sim"),
    }
    preferred = preferred_orders.get(session_type, preferred_orders["study"])
    ordered = [mode for mode in preferred if mode in base]
    ordered.extend(mode for mode in base if mode not in ordered)
    return ordered


def _run_agent_v0_state(
    request: AgentRequest,
    repository: SQLiteRepository | None = None,
    *,
    llm: LLMClient,
) -> GraphState:
    state = build_initial_graph_state(request)
    state = load_context_step(state, repository=repository)
    state = guard_off_topic_step(state)
    if state.is_off_topic:
        return state
    state = guard_session_capability_step(state)
    if state.assistant_message is not None:
        return state
    state = guard_project_chat_low_info_step(state)
    if state.assistant_message is not None:
        return state

    for step in (
        lambda current: main_decision_step(current, llm=llm, repository=repository),
        decide_action_step,
        lambda current: maybe_tool_step(current, repository=repository),
        lambda current: compose_response_step(current, llm=llm, repository=repository),
        writeback_step,
    ):
        state = step(state)
    return state


def _build_run_result(state: GraphState) -> AgentRunResult:
    if (
        state.assistant_message is None
        or state.diagnosis is None
        or state.plan is None
        or state.state_patch is None
    ):
        raise RuntimeError("Agent v0 graph did not produce a complete response payload.")

    return AgentRunResult(
        graph_state=state,
        events=build_events(
            state.assistant_message,
            state.diagnosis,
            state.plan,
            state.state_patch,
            state.activity,
            state.activities,
            state.knowledge_point_suggestions,
        ),
    )


def iter_agent_v0_events(
    request: AgentRequest,
    repository: SQLiteRepository | None = None,
    *,
    llm: LLMClient,
) -> Iterator[StreamEvent]:
    state = build_initial_graph_state(request)
    events: list[StreamEvent] = []
    loading_status = _build_status_event("loading-context")
    events.append(loading_status)
    yield loading_status

    state = load_context_step(state, repository=repository)
    state = guard_off_topic_step(state)
    if state.is_off_topic:
        if state.diagnosis is None or state.plan is None or state.state_patch is None:
            raise RuntimeError("off-topic guardrail did not produce a complete response payload.")
        diagnosis_event = DiagnosisEvent(event="diagnosis", diagnosis=state.diagnosis)
        events.append(diagnosis_event)
        yield diagnosis_event
        for chunk in _chunk_text_for_ui_local(state.assistant_message or state.off_topic_reason or ""):
            text_event = TextDeltaEvent(event="text-delta", delta=chunk)
            events.append(text_event)
            yield text_event
        plan_event = PlanEvent(event="plan", plan=state.plan)
        events.append(plan_event)
        yield plan_event
        state_patch_event = StatePatchEvent(event="state-patch", state_patch=state.state_patch)
        events.append(state_patch_event)
        yield state_patch_event
        done_event = DoneEvent(event="done", final_message=state.assistant_message)
        events.append(done_event)
        yield done_event
        if repository is not None:
            repository.save_run(request, AgentRunResult(graph_state=state, events=events))
        return
    state = guard_session_capability_step(state)
    if state.assistant_message is not None:
        if state.diagnosis is None or state.plan is None or state.state_patch is None:
            raise RuntimeError("session capability guardrail did not produce a complete response payload.")
        diagnosis_event = DiagnosisEvent(event="diagnosis", diagnosis=state.diagnosis)
        events.append(diagnosis_event)
        yield diagnosis_event
        for chunk in _chunk_text_for_ui_local(state.assistant_message):
            text_event = TextDeltaEvent(event="text-delta", delta=chunk)
            events.append(text_event)
            yield text_event
        plan_event = PlanEvent(event="plan", plan=state.plan)
        events.append(plan_event)
        yield plan_event
        state_patch_event = StatePatchEvent(event="state-patch", state_patch=state.state_patch)
        events.append(state_patch_event)
        yield state_patch_event
        done_event = DoneEvent(event="done", final_message=state.assistant_message)
        events.append(done_event)
        yield done_event
        if repository is not None:
            repository.save_run(request, AgentRunResult(graph_state=state, events=events))
        return
    state = guard_project_chat_low_info_step(state)
    if state.assistant_message is not None:
        if state.diagnosis is None or state.plan is None or state.state_patch is None:
            raise RuntimeError("project-chat low-info guardrail did not produce a complete response payload.")
        diagnosis_event = DiagnosisEvent(event="diagnosis", diagnosis=state.diagnosis)
        events.append(diagnosis_event)
        yield diagnosis_event
        for chunk in _chunk_text_for_ui_local(state.assistant_message):
            text_event = TextDeltaEvent(event="text-delta", delta=chunk)
            events.append(text_event)
            yield text_event
        plan_event = PlanEvent(event="plan", plan=state.plan)
        events.append(plan_event)
        yield plan_event
        state_patch_event = StatePatchEvent(event="state-patch", state_patch=state.state_patch)
        events.append(state_patch_event)
        yield state_patch_event
        done_event = DoneEvent(event="done", final_message=state.assistant_message)
        events.append(done_event)
        yield done_event
        if repository is not None:
            repository.save_run(request, AgentRunResult(graph_state=state, events=events))
        return

    decision_status = _build_status_event("making-decision")
    events.append(decision_status)
    yield decision_status

    state = main_decision_step(state, llm=llm, repository=repository)
    if state.diagnosis is None:
        raise RuntimeError("diagnose_step completed without diagnosis.")
    diagnosis_event = DiagnosisEvent(event="diagnosis", diagnosis=state.diagnosis)
    events.append(diagnosis_event)
    yield diagnosis_event

    state = decide_action_step(state)
    if state.tool_intent != "none":
        retrieving_status = _build_status_event(
            "retrieving-context",
            TOOL_STATUS_MESSAGES[state.tool_intent],
        )
        events.append(retrieving_status)
        yield retrieving_status
    state = maybe_tool_step(state, repository=repository)
    if state.diagnosis is None or state.learner_unit_state is None:
        raise RuntimeError("stream response requires diagnosis and learner state.")

    from xidea_agent.llm import llm_build_plan, stream_assistant_reply
    composing_status = _build_status_event("composing-response")
    events.append(composing_status)
    yield composing_status

    project_topic = state.project_context.topic if state.project_context is not None else state.request.topic
    unit_title = state.learning_unit.title if state.learning_unit else project_topic
    candidate_modes = _candidate_modes_for_session(
        state.learning_unit,
        state.request.session_type,
    )
    user_msg = state.request.messages[-1].content if state.request.messages else project_topic

    bundled_reply_fallback = state.assistant_message
    if state.plan is not None:
        plan_source = "LLM-main-decision"
    else:
        plan_source = ""

    reply_parts: list[str] = []
    for chunk in stream_assistant_reply(
        llm,
        state.diagnosis,
        state.plan,
        state.learner_unit_state,
        user_msg,
        state.tool_result,
        session_type=state.request.session_type,
    ):
        reply_parts.append(chunk)
        text_event = TextDeltaEvent(event="text-delta", delta=chunk)
        events.append(text_event)
        yield text_event

    streamed_reply = "".join(reply_parts)
    if reply_parts and _should_accept_project_session_response(state, streamed_reply, state.plan):
        state.assistant_message = streamed_reply
        reply_source = "LLM-stream"
    else:
        had_stream_reply = bool(reply_parts)
        if (
            bundled_reply_fallback is not None
            and _should_accept_project_session_response(state, bundled_reply_fallback, state.plan)
        ):
            state.assistant_message = bundled_reply_fallback
            reply_source = "LLM-main-decision-fallback"
            for chunk in _chunk_text_for_ui_local(state.assistant_message):
                text_event = TextDeltaEvent(event="text-delta", delta=chunk)
                events.append(text_event)
                yield text_event
            state.rationale.append(
                "LLM reply streaming returned no visible content, falling back to bundled main-decision reply."
            )
        else:
            state.assistant_message = compose_assistant_message(
                state.diagnosis,
                state.plan,
                state.tool_result,
                state.request.session_type,
            )
            reply_source = "template"
            for chunk in _chunk_text_for_ui_local(state.assistant_message):
                text_event = TextDeltaEvent(event="text-delta", delta=chunk)
                events.append(text_event)
                yield text_event
            if had_stream_reply:
                state.rationale.append(
                    "LLM reply streaming looked too pedagogical for project session, using template reply."
                )
            else:
                state.rationale.append("LLM reply streaming returned no content, using template reply.")

    if state.plan is None:
        llm_plan = llm_build_plan(
            llm,
            project_topic,
            unit_title,
            candidate_modes,
            state.diagnosis,
            state.learner_unit_state,
            user_msg,
            session_type=state.request.session_type,
        )
        if llm_plan is not None and _should_accept_project_session_response(
            state,
            state.assistant_message or "",
            llm_plan,
        ):
            state.plan = llm_plan
            plan_source = "LLM"
        else:
            state.plan = build_plan(
                project_topic,
                unit_title,
                candidate_modes,
                state.diagnosis,
                state.learner_unit_state,
                state.request.session_type,
            )
            plan_source = "template"
            if llm_plan is None:
                state.rationale.append("LLM plan generation returned None, using template plan.")
            else:
                state.rationale.append(
                    "LLM plan generation looked too pedagogical for project session, using template plan."
                )

    if state.plan is None:
        raise RuntimeError("stream response could not build plan.")

    plan_event = PlanEvent(event="plan", plan=state.plan)
    events.append(plan_event)
    yield plan_event

    state.activities, activity_source = resolve_activities(
        state.diagnosis,
        state.plan,
        state.learner_unit_state,
        state.learning_unit,
        llm,
        topic=project_topic,
        user_message=user_msg,
        tool_result=state.tool_result,
        session_type=state.request.session_type,
        bundled_activities=state.activities,
    )
    state.activity = state.activities[0] if state.activities else None
    if state.activities:
        activities_event = ActivitiesEvent(event="activities", activities=state.activities)
        events.append(activities_event)
        yield activities_event
    state.knowledge_point_suggestions = build_knowledge_point_suggestions(state, repository=repository)
    if state.knowledge_point_suggestions:
        suggestion_event = KnowledgePointSuggestionEvent(
            event="knowledge-point-suggestion",
            suggestions=state.knowledge_point_suggestions,
        )
        events.append(suggestion_event)
        yield suggestion_event

    state.rationale.append(
        f"compose_response built a {len(state.plan.steps)}-step plan "
        f"with mode {state.plan.selected_mode} "
        f"(plan={plan_source}, reply={reply_source}, activities={activity_source})."
    )
    if state.activities:
        state.rationale.append(
            f"stream emitted activity deck with {len(state.activities)} card(s)."
        )
    elif state.request.session_type == "project":
        state.rationale.append(
            "stream skipped activity because project session only supports project-level orchestration."
        )
    if state.knowledge_point_suggestions:
        state.rationale.append(
            f"stream emitted {len(state.knowledge_point_suggestions)} knowledge point suggestion(s)."
        )

    state = writeback_step(state)
    if state.state_patch is None:
        raise RuntimeError("writeback_step completed without state patch.")

    state_patch_event = StatePatchEvent(event="state-patch", state_patch=state.state_patch)
    events.append(state_patch_event)
    yield state_patch_event

    done_event = DoneEvent(event="done", final_message=state.assistant_message)
    events.append(done_event)
    yield done_event

    if repository is not None:
        repository.save_run(request, AgentRunResult(graph_state=state, events=events))


def load_context_step(
    state: GraphState, repository: SQLiteRepository | None = None, message_limit: int = 5
) -> GraphState:
    if repository is not None:
        repository.initialize()
    state.project_context = build_project_context(state.request, repository=repository)

    if repository is not None:
        prior_messages = state.project_context.recent_messages[-message_limit:]
        if prior_messages:
            merged_messages = [*prior_messages, *state.request.messages]
            state.recent_messages = merged_messages[-8:]
            state.rationale.append("load_context pulled recent thread messages from SQLite repository.")
        else:
            state.rationale.append("load_context found no prior thread messages in SQLite repository.")

        if state.request.target_unit_id:
            state.prior_learner_unit_state = repository.get_learner_unit_state(
                state.request.thread_id, state.request.target_unit_id
            )
            if state.prior_learner_unit_state is not None:
                state.rationale.append(
                    "load_context reused the latest learner unit state snapshot as the estimation baseline."
                )

            review_patch = repository.get_review_state(
                state.request.thread_id, state.request.target_unit_id
            )
            state.prior_review_state = review_patch
            if review_patch is not None and review_patch.scheduled_at is not None:
                state.prior_next_review_at = review_patch.scheduled_at
                state.rationale.append("load_context loaded prior review schedule from repository.")

        activity_result = state.request.activity_result
        if activity_result is not None:
            state.prior_knowledge_point_state = repository.get_knowledge_point_state(
                activity_result.knowledge_point_id
            )
            if state.prior_knowledge_point_state is not None:
                state.rationale.append(
                    "load_context loaded prior knowledge point state for activity result writeback."
                )

    if state.project_context is not None:
        state.observations = [
            *_build_project_context_observations(state.project_context),
            *state.observations,
        ]
        state.rationale.append(
            f"load_context preloaded project context from {state.project_context.source}."
        )

    source_asset_ids = (
        state.project_context.source_asset_ids
        if state.project_context is not None
        else state.request.source_asset_ids
    )
    if source_asset_ids:
        state.source_assets = retrieve_source_assets(
            source_asset_ids,
            repository=repository,
            project_id=state.request.project_id,
        )
        state.rationale.append(f"load_context attached {len(state.source_assets)} source assets.")

    topic = state.project_context.topic if state.project_context is not None else state.request.topic
    state.learning_unit = retrieve_learning_unit(state.request.target_unit_id, topic)
    state.rationale.append(f"load_context selected learning unit {state.learning_unit.id}.")
    return state


def _commit_llm_diagnosis(
    state: GraphState,
    llm_diag: Diagnosis | None,
    *,
    signal_source: str,
    diag_source: str,
) -> GraphState:
    if llm_diag is not None:
        violations = validate_diagnosis(llm_diag, state.learner_unit_state)
        if violations:
            names = ", ".join(f"{violation.rule_id}({violation.rule_name})" for violation in violations)
            state.rationale.append(
                f"LLM diagnosis rejected by guardrails: {names}. "
                "Applying guardrail corrections."
            )
            _apply_diagnosis_guardrail_corrections(llm_diag, state, violations)
        if _apply_session_type_diagnosis_corrections(llm_diag, state):
            state.rationale.append(
                f"session_type corrected diagnosis to {llm_diag.recommended_action} "
                f"for {state.request.session_type} session."
            )
        state.diagnosis = llm_diag
    else:
        raise RuntimeError(
            "LLM diagnosis returned None. The LLM is the core decision-maker "
            "and cannot be bypassed."
        )

    state.learner_unit_state.recommended_action = state.diagnosis.recommended_action
    state.rationale.append(
        f"diagnose selected {state.diagnosis.recommended_action} "
        f"for {state.diagnosis.primary_issue} "
        f"(signals={signal_source}, diagnosis={diag_source})."
    )
    return state


def _apply_session_type_diagnosis_corrections(diag: Diagnosis, state: GraphState) -> bool:
    if state.learner_unit_state is None:
        return False

    corrected = False

    if (
        state.request.session_type == "review"
        and diag.recommended_action not in {"review", "clarify"}
        and state.learner_unit_state.confusion_level < 70
    ):
        diag.recommended_action = "review"
        diag.primary_issue = "weak-recall"
        diag.reason = (
            "Session 修正：当前是 review session，优先先做一次主动回忆和短反馈，"
            "确认记忆断点后再决定是否转回澄清。"
        )
        corrected = True

    if state.request.session_type == "project" and diag.recommended_action in {"review", "practice", "apply"}:
        next_action: PedagogicalAction = (
            "clarify" if diag.primary_issue == "concept-confusion" or state.request.target_unit_id is None else "teach"
        )
        diag.recommended_action = next_action
        diag.primary_issue = "concept-confusion" if next_action == "clarify" else "insufficient-understanding"
        diag.needs_tool = False
        diag.reason = (
            "Session 修正：当前是 project session，不直接进入学习/复习编排；"
            "先在 project chat 里把当前学习方向、主题判断、材料线索或知识点边界讲清楚，"
            "再决定是否单独开启 study/review session。"
        )
        corrected = True

    return corrected


def _preload_tool_context_for_main_decision(
    state: GraphState,
    review_decision: ReviewDecision,
    repository: SQLiteRepository | None = None,
) -> GraphState:
    preload_intent: ToolIntent = "none"
    preload_request = state.request

    if state.request.entry_mode == "material-import":
        asset_ids = (
            state.request.source_asset_ids
            or (state.project_context.source_asset_ids if state.project_context is not None else [])
        )
        if asset_ids:
            preload_intent = "asset-summary"
            if not state.request.source_asset_ids:
                preload_request = state.request.model_copy(update={"source_asset_ids": list(asset_ids)})
    elif state.request.entry_mode == "coach-followup":
        preload_intent = "thread-memory"
    elif review_decision.should_review and state.request.target_unit_id is not None:
        preload_intent = "review-context"
    elif state.request.target_unit_id is not None:
        preload_intent = "unit-detail"

    if preload_intent == "none":
        return state

    state.tool_result = resolve_tool_result(preload_intent, preload_request, repository=repository)
    if state.tool_result is not None:
        state.rationale.append(
            f"main_decision_step preloaded {state.tool_result.kind} context before the primary LLM call."
        )
    return state


def main_decision_step(
    state: GraphState,
    llm: LLMClient,
    repository: SQLiteRepository | None = None,
) -> GraphState:
    from xidea_agent.llm import llm_build_main_decision

    provisional_signals = build_signals(
        state.recent_messages,
        state.observations,
        state.request.entry_mode,
        prior_state=state.prior_learner_unit_state,
    )
    state.signals = provisional_signals
    state.rationale.append(
        "main_decision_step built provisional rule-based signals before attempting single-call decision."
    )

    state.learner_unit_state = estimate_learner_state(
        state.request.target_unit_id,
        state.signals,
        prior_state=state.prior_learner_unit_state,
    )

    review_decision = should_enter_review(
        understanding_level=state.learner_unit_state.understanding_level,
        confusion_level=state.learner_unit_state.confusion_level,
        memory_strength=state.learner_unit_state.memory_strength,
        next_review_at=state.prior_next_review_at,
    )

    project_topic = state.project_context.topic if state.project_context is not None else state.request.topic
    unit_title = state.learning_unit.title if state.learning_unit is not None else project_topic
    candidate_modes = _candidate_modes_for_session(
        state.learning_unit,
        state.request.session_type,
    )
    state = _preload_tool_context_for_main_decision(
        state,
        review_decision,
        repository=repository,
    )

    bundled_main = llm_build_main_decision(
        llm,
        state.recent_messages,
        state.observations,
        state.request.entry_mode,
        state.learner_unit_state,
        state.request.target_unit_id,
        project_topic,
        unit_title,
        candidate_modes,
        prior_state=state.prior_learner_unit_state,
        review_should=review_decision.should_review,
        review_priority=review_decision.priority,
        review_reason=review_decision.reason,
        tool_result=state.tool_result,
        session_type=state.request.session_type,
    )
    if bundled_main is None:
        state.rationale.append(
            "main_decision_step fell back to staged diagnosis path because single-call decision was unavailable."
        )
        return diagnose_step(state, llm=llm)

    state.signals, llm_diag, bundled_reply, bundled_plan, bundled_activities = bundled_main
    llm_recommended_action = llm_diag.recommended_action
    state.learner_unit_state = estimate_learner_state(
        state.request.target_unit_id,
        state.signals,
        prior_state=state.prior_learner_unit_state,
    )
    state = _commit_llm_diagnosis(
        state,
        llm_diag,
        signal_source="LLM-main-decision",
        diag_source="LLM-main-decision",
    )
    if (
        bundled_reply is not None
        and bundled_plan is not None
        and not state.diagnosis.needs_tool
        and _should_accept_project_session_response(state, bundled_reply, bundled_plan)
    ):
        state.assistant_message = bundled_reply
        state.plan = bundled_plan
        state.activities = (
            bundled_activities or []
            if state.diagnosis.recommended_action == llm_recommended_action
            else []
        )
        state.activity = state.activities[0] if state.activities else None
        if state.activities:
            state.rationale.append(
                "main_decision_step bundled reply, plan, and activity deck into the same primary LLM call."
            )
        else:
            if bundled_activities:
                state.rationale.append(
                    "main_decision_step discarded bundled activities because session correction changed the action."
                )
            state.rationale.append("main_decision_step bundled reply and plan into the same primary LLM call.")
    else:
        if bundled_reply is not None and bundled_plan is not None and state.request.session_type == "project":
            state.rationale.append(
                "main_decision_step discarded bundled project-session reply because it still looked pedagogical."
            )
        state.rationale.append("main_decision_step bundled diagnosis only; response remains staged.")
    return state


def diagnose_step(state: GraphState, llm: LLMClient) -> GraphState:
    from xidea_agent.llm import llm_build_signals, llm_diagnose, llm_build_signals_and_diagnosis

    provisional_signals = build_signals(
        state.recent_messages,
        state.observations,
        state.request.entry_mode,
        prior_state=state.prior_learner_unit_state,
    )
    state.signals = provisional_signals
    signal_source = "rules-provisional"
    state.rationale.append(
        "diagnose_step built provisional rule-based signals for state estimation before bundled LLM diagnosis."
    )

    state.learner_unit_state = estimate_learner_state(
        state.request.target_unit_id,
        state.signals,
        prior_state=state.prior_learner_unit_state,
    )

    review_decision = should_enter_review(
        understanding_level=state.learner_unit_state.understanding_level,
        confusion_level=state.learner_unit_state.confusion_level,
        memory_strength=state.learner_unit_state.memory_strength,
        next_review_at=state.prior_next_review_at,
    )

    bundled = llm_build_signals_and_diagnosis(
        llm,
        state.recent_messages,
        state.observations,
        state.request.entry_mode,
        state.learner_unit_state,
        state.request.target_unit_id,
        prior_state=state.prior_learner_unit_state,
        review_should=review_decision.should_review,
        review_priority=review_decision.priority,
        review_reason=review_decision.reason,
        session_type=state.request.session_type,
    )
    if bundled is not None:
        state.signals, llm_diag = bundled
        state.learner_unit_state = estimate_learner_state(
            state.request.target_unit_id,
            state.signals,
            prior_state=state.prior_learner_unit_state,
        )
        signal_source = "LLM-bundled"
        diag_source = "LLM-bundled"
    else:
        llm_signals = llm_build_signals(
            llm,
            state.recent_messages,
            state.observations,
            state.request.entry_mode,
            prior_state=state.prior_learner_unit_state,
            session_type=state.request.session_type,
        )
        if llm_signals is not None:
            state.signals = llm_signals
            state.learner_unit_state = estimate_learner_state(
                state.request.target_unit_id,
                state.signals,
                prior_state=state.prior_learner_unit_state,
            )
            signal_source = "LLM-split"
        else:
            state.signals = provisional_signals
            signal_source = "rules"
            state.rationale.append(
                "LLM signal extraction returned None after bundled fallback, using rule-based signals."
            )
        llm_diag = llm_diagnose(
            llm,
            state.learner_unit_state,
            state.signals,
            state.request.entry_mode,
            state.request.target_unit_id,
            prior_state=state.prior_learner_unit_state,
            review_should=review_decision.should_review,
            review_priority=review_decision.priority,
            review_reason=review_decision.reason,
            session_type=state.request.session_type,
        )
        diag_source = "LLM"

    return _commit_llm_diagnosis(
        state,
        llm_diag,
        signal_source=signal_source,
        diag_source=diag_source,
    )


def _apply_diagnosis_guardrail_corrections(
    diag: Diagnosis, state: GraphState, violations: list
) -> None:
    """Correct a guardrail-violating LLM diagnosis in-place."""
    for v in violations:
        if v.rule_id == "G2":
            diag.recommended_action = "teach"
            diag.reason = f"Guardrail 修正：{v.violation} 切换到 teach。"
            diag.primary_issue = "insufficient-understanding"
        elif v.rule_id == "G3":
            diag.recommended_action = "clarify"
            diag.reason = f"Guardrail 修正：{v.violation} 切换到 clarify。"
            diag.primary_issue = "concept-confusion"


def decide_action_step(state: GraphState) -> GraphState:
    if state.diagnosis is None:
        return state

    state.tool_intent = choose_tool_intent(state.request.entry_mode, state.diagnosis)
    state.rationale.append(f"decide_action chose tool intent {state.tool_intent}.")
    return state


def maybe_tool_step(state: GraphState, repository: SQLiteRepository | None = None) -> GraphState:
    if state.is_off_topic:
        return state

    if state.tool_intent == "none":
        if state.tool_result is not None:
            state.rationale.append(
                f"maybe_tool skipped because {state.tool_result.kind} context was already preloaded."
            )
        else:
            state.rationale.append("maybe_tool skipped because no extra context was required.")
        return state

    if state.tool_result is not None and state.tool_result.kind == state.tool_intent:
        state.rationale.append(f"maybe_tool reused preloaded {state.tool_result.kind} context.")
        return state

    state.tool_result = resolve_tool_result(state.tool_intent, state.request, repository=repository)
    if state.tool_result is not None:
        state.rationale.append(f"maybe_tool loaded {state.tool_result.kind} context.")
    else:
        state.rationale.append("maybe_tool skipped because no extra context was required.")
    return state


def compose_response_step(
    state: GraphState,
    llm: LLMClient,
    repository: SQLiteRepository | None = None,
) -> GraphState:
    if state.is_off_topic:
        return state
    if state.diagnosis is None or state.learner_unit_state is None:
        return state

    from xidea_agent.llm import generate_assistant_reply, llm_build_plan, llm_build_reply_and_plan

    project_topic = state.project_context.topic if state.project_context is not None else state.request.topic
    unit_title = state.learning_unit.title if state.learning_unit else project_topic
    candidate_modes = _candidate_modes_for_session(
        state.learning_unit,
        state.request.session_type,
    )
    user_msg = state.request.messages[-1].content if state.request.messages else project_topic

    if state.tool_intent == "none" and state.assistant_message is not None and state.plan is not None:
        state.activities, activity_source = resolve_activities(
            state.diagnosis,
            state.plan,
            state.learner_unit_state,
            state.learning_unit,
            llm,
            topic=project_topic,
            user_message=user_msg,
            tool_result=state.tool_result,
            session_type=state.request.session_type,
            bundled_activities=state.activities,
        )
        state.activity = state.activities[0] if state.activities else None
        state.knowledge_point_suggestions = build_knowledge_point_suggestions(state, repository=repository)
        state.rationale.append(
            f"compose_response built a {len(state.plan.steps)}-step plan "
            f"with mode {state.plan.selected_mode} "
            f"(plan=LLM-main-decision, reply=LLM-main-decision, activities={activity_source})."
        )
        if state.activities:
            state.rationale.append(
                f"compose_response emitted activity deck with {len(state.activities)} card(s)."
            )
        elif state.request.session_type == "project":
            state.rationale.append(
                "compose_response skipped activity because project session only supports project-level orchestration."
            )
        if state.knowledge_point_suggestions:
            state.rationale.append(
                f"compose_response emitted {len(state.knowledge_point_suggestions)} knowledge point suggestion(s)."
            )
        return state

    bundled_response = llm_build_reply_and_plan(
        llm,
        project_topic,
        unit_title,
        candidate_modes,
        state.diagnosis,
        state.learner_unit_state,
        user_msg,
        tool_result=state.tool_result,
        session_type=state.request.session_type,
    )
    bundled_activities: list[Activity] | None = None
    if bundled_response is not None and _should_accept_project_session_response(
        state, bundled_response[0], bundled_response[1]
    ):
        state.assistant_message, state.plan, bundled_activities = bundled_response
        reply_source = "LLM-bundled"
        plan_source = "LLM-bundled"
    else:
        if bundled_response is not None and state.request.session_type == "project":
            state.rationale.append(
                "compose_response discarded bundled project-session reply because it still looked pedagogical."
            )
        reply = generate_assistant_reply(
            llm,
            state.diagnosis,
            None,
            state.learner_unit_state,
            user_msg,
            state.tool_result,
            session_type=state.request.session_type,
        )
        if reply is not None and _should_accept_project_session_response(state, reply, None):
            state.assistant_message = reply
            reply_source = "LLM"
        else:
            state.assistant_message = compose_assistant_message(
                state.diagnosis,
                None,
                state.tool_result,
                state.request.session_type,
            )
            reply_source = "template"
            if reply is None:
                state.rationale.append("LLM reply generation returned None, using template reply.")
            else:
                state.rationale.append(
                    "LLM reply generation looked too pedagogical for project session, using template reply."
                )

        llm_plan = llm_build_plan(
            llm,
            project_topic,
            unit_title,
            candidate_modes,
            state.diagnosis,
            state.learner_unit_state,
            user_msg,
            session_type=state.request.session_type,
        )
        if llm_plan is not None and _should_accept_project_session_response(
            state,
            state.assistant_message or "",
            llm_plan,
        ):
            state.plan = llm_plan
            plan_source = "LLM"
        else:
            state.plan = build_plan(
                project_topic,
                unit_title,
                candidate_modes,
                state.diagnosis,
                state.learner_unit_state,
                state.request.session_type,
            )
            plan_source = "template"
            if llm_plan is None:
                state.rationale.append("LLM plan generation returned None, using template plan.")
            else:
                state.rationale.append(
                    "LLM plan generation looked too pedagogical for project session, using template plan."
                )

    state.activities, activity_source = resolve_activities(
        state.diagnosis,
        state.plan,
        state.learner_unit_state,
        state.learning_unit,
        llm,
        topic=project_topic,
        user_message=user_msg,
        tool_result=state.tool_result,
        session_type=state.request.session_type,
        bundled_activities=bundled_activities,
    )
    state.activity = state.activities[0] if state.activities else None
    state.knowledge_point_suggestions = build_knowledge_point_suggestions(state, repository=repository)
    state.rationale.append(
        f"compose_response built a {len(state.plan.steps)}-step plan "
        f"with mode {state.plan.selected_mode} "
        f"(plan={plan_source}, reply={reply_source}, activities={activity_source})."
    )
    if state.activities:
        state.rationale.append(
            f"compose_response emitted activity deck with {len(state.activities)} card(s)."
        )
    elif state.request.session_type == "project":
        state.rationale.append(
            "compose_response skipped activity because project session only supports project-level orchestration."
        )
    if state.knowledge_point_suggestions:
        state.rationale.append(
            f"compose_response emitted {len(state.knowledge_point_suggestions)} knowledge point suggestion(s)."
        )
    return state


def _apply_guardrail_corrections(state: GraphState, violations: list) -> bool:
    """Apply corrections for guardrail violations. Returns True if any correction was made."""
    corrected = False
    for v in violations:
        if v.rule_id == "G2" and state.diagnosis is not None:
            state.diagnosis = Diagnosis(
                recommended_action="teach",
                reason=f"Guardrail 修正：{v.violation} 切换到 teach。",
                confidence=state.diagnosis.confidence,
                focus_unit_id=state.diagnosis.focus_unit_id,
                primary_issue="insufficient-understanding",
                needs_tool=state.diagnosis.needs_tool,
                explanation=state.diagnosis.explanation,
            )
            if state.learner_unit_state is not None:
                state.learner_unit_state.recommended_action = "teach"
            corrected = True
        elif v.rule_id == "G3" and state.diagnosis is not None:
            state.diagnosis = Diagnosis(
                recommended_action="clarify",
                reason=f"Guardrail 修正：{v.violation} 切换到 clarify。",
                confidence=state.diagnosis.confidence,
                focus_unit_id=state.diagnosis.focus_unit_id,
                primary_issue="concept-confusion",
                needs_tool=state.diagnosis.needs_tool,
                explanation=state.diagnosis.explanation,
            )
            if state.learner_unit_state is not None:
                state.learner_unit_state.recommended_action = "clarify"
            corrected = True
    return corrected


def writeback_step(state: GraphState) -> GraphState:
    if state.is_off_topic:
        return state
    if state.diagnosis is None or state.learner_unit_state is None or state.plan is None:
        return state

    state.state_patch = build_state_patch(
        state.diagnosis,
        state.learner_unit_state,
        state.plan,
        state.request.session_type,
    )
    violations = get_violations(state)
    if violations:
        names = ", ".join(f"{item.rule_id}({item.rule_name})" for item in violations)
        state.rationale.append(f"Guardrail violations detected: {names}.")
        for item in violations:
            state.rationale.append(f"{item.rule_id}: {item.violation} -> {item.suggestion}")

        if _apply_guardrail_corrections(state, violations):
            state.state_patch = build_state_patch(
                state.diagnosis,
                state.learner_unit_state,
                state.plan,
                state.request.session_type,
            )
            state.rationale.append("Guardrail corrections applied, state_patch rebuilt.")
    else:
        state.rationale.append("Guardrail checks passed.")

    if state.request.activity_result is not None:
        state = apply_activity_result_writeback(state)
    return state


def run_agent_v0(
    request: AgentRequest,
    repository: SQLiteRepository | None = None,
    *,
    llm: LLMClient,
) -> AgentRunResult:
    return _build_run_result(_run_agent_v0_state(request, repository=repository, llm=llm))


def _chunk_text_for_ui_local(text: str, max_chunk_chars: int = 24) -> Iterator[str]:
    remaining = text
    while remaining:
        yield remaining[:max_chunk_chars]
        remaining = remaining[max_chunk_chars:]
