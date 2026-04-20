"""Shared test fixtures for the xidea-agent test suite."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from xidea_agent.llm import LLMClient


def _mock_openai_response(content: str):
    message = SimpleNamespace(content=content)
    choice = SimpleNamespace(message=message)
    return SimpleNamespace(choices=[choice])


def _mock_openai_stream(chunks: list[str]):
    stream_chunks = [
        SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=chunk))])
        for chunk in chunks
    ]
    return iter(stream_chunks)


def _build_response_bundle(reply: str, plan: dict[str, object]) -> str:
    return json.dumps({
        "reply": reply,
        "plan": plan,
    })


def _build_main_decision_response(
    *,
    signals: list[dict[str, object]],
    diagnosis: dict[str, object],
    reply: str | None = None,
    plan: dict[str, object] | None = None,
    activities: list[dict[str, object]] | None = None,
) -> str:
    payload: dict[str, object] = {
        "signals": signals,
        "diagnosis": diagnosis,
    }
    if reply is not None:
        payload["reply"] = reply
    if plan is not None:
        payload["plan"] = plan
    if activities is not None:
        payload["activities"] = activities
    return json.dumps(payload)


def _build_knowledge_point_enrichment_response(
    items: list[dict[str, str]],
) -> str:
    return json.dumps(items, ensure_ascii=False)


def _build_activity_card(
    *,
    title: str,
    objective: str,
    prompt: str,
    support: str,
    choices: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "title": title,
        "objective": objective,
        "prompt": prompt,
        "support": support,
        "input": {
            "type": "choice",
            "choices": choices,
        },
    }


def _choice(
    *,
    choice_id: str,
    label: str,
    detail: str,
    is_correct: bool,
    feedback_layers: list[str],
    analysis: str,
) -> dict[str, object]:
    return {
        "id": choice_id,
        "label": label,
        "detail": detail,
        "is_correct": is_correct,
        "feedback_layers": feedback_layers,
        "analysis": analysis,
    }


def _default_side_effect():
    """Return a side_effect list that satisfies the full LLM-first pipeline."""
    plan = {
        "headline": "围绕概念辨析的学习路径",
        "summary": "先辨析边界再追问",
        "selected_mode": "contrast-drill",
        "expected_outcome": "能清晰说出两者的职责差异",
        "steps": [
            {"id": "contrast-boundary", "title": "对比辨析训练",
             "mode": "contrast-drill",
             "reason": "先比较相近概念的边界", "outcome": "能说清各自解决什么问题"},
            {"id": "guided-check", "title": "1v1 导师问答",
             "mode": "guided-qa",
             "reason": "追问确认理解稳定", "outcome": "确认不是表面上听懂"},
        ],
    }
    reply = "这两个概念的关键区别在于：retrieval 负责从大量文档中召回候选集，reranking 则在候选集上做精排。"
    activities = [
        _build_activity_card(
            title="先判断什么时候该补重排",
            objective="能说清召回和排序分别在解决什么问题。",
            prompt="围绕 retrieval 和 reranking 的边界，哪种现象最说明该补的是重排，而不是继续补召回？",
            support="先把候选召回和前排排序拆开，后面才不会继续混淆。",
            choices=[
                _choice(
                    choice_id="rerank-when-candidates-exist",
                    label="正确文档通常已经进 top-k，但排在前面的经常是语义相近却答非所问的片段。",
                    detail="这说明候选已在集合里，主要问题落在排序相关性。",
                    is_correct=True,
                    feedback_layers=[
                        "对，这更像候选已经召回到位，但前排顺序没有把最对口的证据顶上来。",
                        "这里该补的是重排，让已有候选按任务相关性重新排序。",
                    ],
                    analysis="这条选择抓住了“候选已在集合里，但前排顺序不对”的核心信号。",
                ),
                _choice(
                    choice_id="recall-gap",
                    label="top-k 里经常完全找不到正确文档，所以应该先补重排。",
                    detail="这更像召回覆盖不足，重排不能排出根本没进集合的文档。",
                    is_correct=False,
                    feedback_layers=[
                        "先别把问题归到重排。",
                        "如果正确文档根本没进候选集，真正缺的是召回覆盖，而不是排序。",
                        "重排解决的是“候选已在集合里但顺序不对”，不是“正确文档完全没召回到”。",
                    ],
                    analysis="这条说法把召回覆盖不足误判成排序问题，是典型边界混淆。",
                ),
                _choice(
                    choice_id="more-context",
                    label="把 top-k 调大，多塞上下文给模型，就能替代重排。",
                    detail="这会把排序问题伪装成堆料问题，还可能放大噪音。",
                    is_correct=False,
                    feedback_layers=[
                        "多塞内容不等于解决排序问题。",
                        "如果前排证据不对口，单纯加大 top-k 往往只会把噪音一起推给模型。",
                        "这里真正缺的是“把最对口的证据排前面”，不是“给更多内容”。",
                    ],
                    analysis="这条说法把相关性排序问题误写成上下文覆盖问题。",
                ),
            ],
        ),
        _build_activity_card(
            title="再确认你能不能反向诊断",
            objective="确认你能把召回缺口和排序缺口反着看清。",
            prompt="如果 top-k 里根本没有正确文档，你下一步最该先检查哪一层？",
            support="第二张卡用反向情形验证你是不是只记住了结论，而是真的能诊断边界。",
            choices=[
                _choice(
                    choice_id="check-retrieval",
                    label="先看索引、召回策略或查询表达，确认正确文档为什么没进候选集。",
                    detail="这才是在查召回覆盖不足。",
                    is_correct=True,
                    feedback_layers=[
                        "对，这时先查的是召回覆盖，而不是排序。",
                        "只有先让正确文档进入候选集，后面的重排才有发挥空间。",
                    ],
                    analysis="这条选择准确反映了“文档没进候选集时先排查召回”的判断顺序。",
                ),
                _choice(
                    choice_id="check-rerank-first",
                    label="先加一层重排，看看能不能把正确文档提到前面。",
                    detail="如果文档根本没被召回，重排没有对象可排。",
                    is_correct=False,
                    feedback_layers=[
                        "重排没有办法排出不存在于候选集里的文档。",
                        "先确认正确文档为什么没被召回，才是当前更关键的检查顺序。",
                    ],
                    analysis="这条说法忽略了重排必须建立在“候选已存在”的前提上。",
                ),
                _choice(
                    choice_id="ask-bigger-model",
                    label="先换更强的模型，让模型自己在这些候选里理解问题。",
                    detail="模型再强，也没法弥补正确文档根本没进候选集的问题。",
                    is_correct=False,
                    feedback_layers=[
                        "这不是先怪模型强弱的时候。",
                        "如果正确文档根本不在候选集里，更强的模型也只能在错误上下文里做判断。",
                    ],
                    analysis="这条说法把检索链路缺口偷换成模型能力问题，诊断焦点跑偏了。",
                ),
            ],
        ),
    ]

    return [
        _mock_openai_response(
            _build_main_decision_response(
                signals=[
                    {"kind": "concept-confusion", "score": 0.85, "confidence": 0.88,
                     "summary": "用户对 retrieval 和 reranking 概念边界混淆"},
                ],
                diagnosis={
                    "recommended_action": "clarify",
                    "reason": "用户明确表达概念边界混淆",
                    "confidence": 0.88,
                    "primary_issue": "concept-confusion",
                    "needs_tool": False,
                },
                reply=reply,
                plan=plan,
                activities=activities,
            )
        ),
        _mock_openai_stream([
            "这两个概念的关键区别在于：retrieval 负责从大量文档中召回候选集，",
            "reranking 则在候选集上做精排。",
        ]),
    ]


def build_mock_llm(side_effect=None) -> LLMClient:
    """Build a mock LLMClient for tests that call the full agent pipeline."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = side_effect or _default_side_effect()
    return LLMClient(client=mock_client, model="gpt-4o-mini")


def build_mock_llm_for_review() -> LLMClient:
    """Build a mock LLMClient that recommends 'review' action."""
    plan = {
        "headline": "围绕复习巩固的学习路径",
        "summary": "先回忆再辨析",
        "selected_mode": "guided-qa",
        "expected_outcome": "确认记忆断点",
        "steps": [
            {"id": "recall-core", "title": "1v1 导师问答",
             "mode": "guided-qa",
             "reason": "先做主动回忆", "outcome": "确认记忆断点"},
        ],
    }
    reply = "来做一次主动回忆吧，看看哪些概念已经掉出工作记忆了。"
    activities = [
        _build_activity_card(
            title="先回忆核心边界",
            objective="确认 retrieval 和 reranking 的边界还能不能主动回忆出来。",
            prompt="不要看材料，下面哪一句最准确说明 reranking 在 RAG 里补的缺口？",
            support="复习轮先测你能不能自己想起关键判断标准。",
            choices=[
                _choice(
                    choice_id="review-rerank-order",
                    label="它在候选已召回的前提下，重新排序谁最回答当前问题。",
                    detail="重排补的是排序相关性，不是把漏召的文档找回来。",
                    is_correct=True,
                    feedback_layers=["对，复习轮先要能自己回忆出这条核心边界。"],
                    analysis="这条回答准确回忆了 reranking 的职责边界。",
                ),
                _choice(
                    choice_id="review-rerank-recall",
                    label="它主要负责把本来没召回到的正确文档重新找回来。",
                    detail="这把重排误说成召回补丁。",
                    is_correct=False,
                    feedback_layers=[
                        "先停一下，这里把重排和召回混成一层了。",
                        "如果文档根本没进候选集，重排没有对象可排。",
                    ],
                    analysis="这条说法把重排误当成了召回补丁。",
                ),
                _choice(
                    choice_id="review-rerank-context",
                    label="它主要是负责把更多上下文一起塞给模型。",
                    detail="这会把排序判断偷换成堆上下文。",
                    is_correct=False,
                    feedback_layers=[
                        "这不是重排的核心职责。",
                        "重排真正做的是在已有候选里调整相关性顺序，而不是单纯扩上下文。",
                    ],
                    analysis="这条说法把排序问题误写成堆上下文问题。",
                ),
            ],
        ),
    ]

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(
            _build_main_decision_response(
                signals=[
                    {"kind": "memory-weakness", "score": 0.85, "confidence": 0.88,
                     "summary": "用户记忆强度偏低，需要复习巩固"},
                ],
                diagnosis={
                    "recommended_action": "review",
                    "reason": "记忆强度不足，需要复习",
                    "confidence": 0.85,
                    "primary_issue": "weak-recall",
                    "needs_tool": False,
                },
                reply=reply,
                plan=plan,
                activities=activities,
            )
        ),
        _mock_openai_stream([
            "来做一次主动回忆吧，",
            "看看哪些概念已经掉出工作记忆了。",
        ]),
    ]
    return LLMClient(client=mock_client, model="gpt-4o-mini")


def build_mock_llm_for_teach() -> LLMClient:
    """Build a mock LLMClient that recommends 'teach' action."""
    plan = {
        "headline": "围绕理解框架的教学路径",
        "summary": "先建模再验证",
        "selected_mode": "guided-qa",
        "expected_outcome": "能用自己的话复述核心逻辑",
        "steps": [
            {"id": "guided-model", "title": "1v1 导师问答",
             "mode": "guided-qa",
             "reason": "先补关键设计框架", "outcome": "能复述核心判断逻辑"},
        ],
    }
    reply = "我们先来建立一个理解框架。"
    activities = [
        _build_activity_card(
            title="先抓住理解框架",
            objective="确认你能用一句话抓住 retrieval 和 reranking 的分工。",
            prompt="下面哪一句最准确地把 retrieval 和 reranking 的分工拆开？",
            support="先把理解框架搭起来，后面再做更细的辨析。",
            choices=[
                _choice(
                    choice_id="teach-split-roles",
                    label="retrieval 先找候选，reranking 再把最回答问题的证据排前面。",
                    detail="这句先拆职责，再说明重排补的是排序。",
                    is_correct=True,
                    feedback_layers=["对，先把这条总框架搭起来，后面具体边界就更容易落住。"],
                    analysis="这条表述把两阶段职责拆得最完整。",
                ),
                _choice(
                    choice_id="teach-rerank-recovers",
                    label="retrieval 和 reranking 都在负责把漏掉的文档重新找回来。",
                    detail="这会把两层职责混成一个“补漏”动作。",
                    is_correct=False,
                    feedback_layers=[
                        "这里把两层职责混在一起了。",
                        "retrieval 是找候选，reranking 是排候选；它们不是同一个“补漏”动作。",
                    ],
                    analysis="这条说法把候选召回和排序精排混为一谈。",
                ),
                _choice(
                    choice_id="teach-model-only",
                    label="只要模型够强，其实 retrieval 和 reranking 的区别不重要。",
                    detail="这会绕开当前要建立的系统理解框架。",
                    is_correct=False,
                    feedback_layers=[
                        "先别跳去谈模型强弱。",
                        "当前更重要的是先理解系统链路里每一层各自承担什么职责。",
                    ],
                    analysis="这条说法回避了当前要建立的两阶段理解框架。",
                ),
            ],
        ),
    ]

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(
            _build_main_decision_response(
                signals=[
                    {"kind": "concept-gap", "score": 0.82, "confidence": 0.85,
                     "summary": "用户理解框架不稳"},
                ],
                diagnosis={
                    "recommended_action": "teach",
                    "reason": "用户理解框架不稳，先补建模",
                    "confidence": 0.85,
                    "primary_issue": "insufficient-understanding",
                    "needs_tool": False,
                },
                reply=reply,
                plan=plan,
                activities=activities,
            )
        ),
        _mock_openai_stream([
            "我们先来建立一个理解框架。",
        ]),
    ]
    return LLMClient(client=mock_client, model="gpt-4o-mini")


def build_mock_llm_for_material_import() -> LLMClient:
    """Build a mock LLMClient for material-import entry mode."""
    plan = {
        "headline": "材料导入学习路径",
        "summary": "先处理材料再教学",
        "selected_mode": "guided-qa",
        "expected_outcome": "理解材料核心",
        "steps": [
            {"id": "guided-material", "title": "1v1 导师问答",
             "mode": "guided-qa",
             "reason": "基于材料教学", "outcome": "理解材料核心"},
        ],
    }
    reply = (
        "根据材料内容，我提炼出三个可沉淀的核心知识点："
        "**万物皆可Token化**——LLM、音视频、具身智能共享的底层逻辑；"
        "**DiT架构**——从U-Net到Diffusion Transformer的范式迁移；"
        "**LLM作为具身智能的“常识大脑”**——任务拆解与语义理解的统一。"
    )
    activities = [
        _build_activity_card(
            title="先基于材料抓主线",
            objective="确认你已经从材料里抓到当前主题最关键的判断。",
            prompt="基于这批材料，下面哪种总结最符合“先看清召回和重排分工”的学习主线？",
            support="材料导入后的第一张卡应该直接贴材料里的主判断，而不是用固定 demo 题。",
            choices=[
                _choice(
                    choice_id="material-mainline",
                    label="先确认候选召回和排序精排分别在控制什么，再决定问题落在哪一层。",
                    detail="这是把材料里的主判断线索先抓出来。",
                    is_correct=True,
                    feedback_layers=["对，这能先把材料里的主线抓住，后面再展开更细判断。"],
                    analysis="这条总结最贴近材料导入后的学习主线。",
                ),
                _choice(
                    choice_id="material-more-context",
                    label="先尽量把材料内容都塞给模型，后面再说边界。",
                    detail="这会把材料阅读又退回成堆信息。",
                    is_correct=False,
                    feedback_layers=[
                        "材料导入后第一步不是堆料，而是先抓主判断。",
                        "如果不先拆清分工，后面还是会把问题继续混在一起。",
                    ],
                    analysis="这条说法把材料学习退化成了信息堆叠。",
                ),
                _choice(
                    choice_id="material-model-blame",
                    label="先判断是不是模型太弱，材料细节后面再看。",
                    detail="这会绕开材料本身已经暴露出的结构判断。",
                    is_correct=False,
                    feedback_layers=[
                        "先别把焦点跳去模型强弱。",
                        "这轮材料已经给出了足够线索，当前更该先看链路分工。",
                    ],
                    analysis="这条说法把材料导入后的主判断转移成了模型能力问题。",
                ),
            ],
        ),
    ]
    enrichments = _build_knowledge_point_enrichment_response([
        {
            "title": "万物皆可Token化",
            "description": "这条知识点解释多模态与具身智能为什么能与 LLM 共用同一套建模接口：文本、图像、视频和动作都需要先被压成可计算的 token 表示，再进入统一推理链路。",
            "reason": "材料已经把 LLM、音视频和具身智能并置讨论，先收住“统一表示空间”这条判断，后续学习时才不会把多模态扩展误解成几个割裂模块。",
        },
        {
            "title": "DiT架构",
            "description": "这条知识点关注 Diffusion Transformer 为什么会取代部分 U-Net 角色，关键不在模型名字，而在 Transformer 如何接管图像/视频生成中的表示组织与长程依赖建模。",
            "reason": "材料里显式提到 DiT 与范式迁移，如果不单独沉淀这一点，后续学习容易把“模型结构变化”和“训练目标变化”混在一起。",
        },
        {
            "title": "LLM作为具身智能的“常识大脑”",
            "description": "这条知识点强调 LLM 在具身系统里更像高层常识与规划模块，负责任务拆解、语义理解和决策组织，而不是直接替代感知与低层控制。",
            "reason": "材料已经把 LLM 和具身智能并列，先收住这条分工边界，后面编排学习时才能判断哪些问题属于规划层，哪些属于感知执行层。",
        },
    ])

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(
            _build_main_decision_response(
                signals=[
                    {"kind": "project-relevance", "score": 0.9, "confidence": 0.9,
                     "summary": "材料导入场景"},
                ],
                diagnosis={
                    "recommended_action": "teach",
                    "reason": "材料摘要已经预取，可以直接基于材料组织教学",
                    "confidence": 0.85,
                    "primary_issue": "missing-context",
                    "needs_tool": False,
                },
                reply=reply,
                plan=plan,
                activities=activities,
            )
        ),
        _mock_openai_response(enrichments),
        _mock_openai_stream([
            "我先看看你导入的材料，",
            "然后基于材料内容安排学习。",
        ]),
    ]
    return LLMClient(client=mock_client, model="gpt-4o-mini")


@pytest.fixture
def mock_llm() -> LLMClient:
    return build_mock_llm()
