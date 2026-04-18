import { MODE_LABELS, buildStudyPlan } from "./planner";
import type { SessionType } from "./project-workspace";
import type {
  LearningActivity,
  LearningActivitySubmission,
  LearnerProfile,
  LearningMode,
  LearningUnit,
  ProjectContext,
  SourceAsset,
  StudyPlanStep,
  WritebackPreview,
} from "./types";

export type AgentEntryMode = "chat-question" | "material-import" | "coach-followup";
export type AgentAction = "teach" | "clarify" | "practice" | "review" | "apply";
export type AgentPrimaryIssue =
  | "insufficient-understanding"
  | "concept-confusion"
  | "weak-recall"
  | "poor-transfer"
  | "missing-context";
export type AgentSignalKind =
  | "concept-gap"
  | "concept-confusion"
  | "memory-weakness"
  | "transfer-readiness"
  | "review-pressure"
  | "project-relevance";

export interface AgentMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface AgentRequest {
  readonly project_id: string;
  readonly thread_id: string;
  readonly session_type: SessionType;
  readonly entry_mode: AgentEntryMode;
  readonly topic: string;
  readonly messages: ReadonlyArray<AgentMessage>;
  readonly source_asset_ids: ReadonlyArray<string>;
  readonly target_unit_id: string | null;
  readonly context_hint: string | null;
  readonly activity_result: AgentActivityResult | null;
  readonly response_mode: "sync" | "stream";
}

export type AgentActivityResultType = "exercise" | "review";
export type AgentActivityResultAction = "submit" | "skip";

export interface AgentActivityResult {
  readonly run_id: string;
  readonly project_id: string;
  readonly session_id: string;
  readonly activity_id: string;
  readonly knowledge_point_id: string;
  readonly result_type: AgentActivityResultType;
  readonly action: AgentActivityResultAction;
  readonly answer: string | null;
  readonly meta: Record<string, unknown>;
}

interface AgentExplanation {
  readonly summary: string;
  readonly evidence: ReadonlyArray<string>;
  readonly confidence: number;
}

interface AgentSignal {
  readonly kind: AgentSignalKind;
  readonly score: number;
  readonly confidence: number;
  readonly summary: string;
  readonly based_on: ReadonlyArray<string>;
}

export interface AgentDiagnosis {
  readonly recommended_action: AgentAction;
  readonly reason: string;
  readonly confidence: number;
  readonly focus_unit_id: string | null;
  readonly primary_issue: AgentPrimaryIssue;
  readonly needs_tool: boolean;
  readonly explanation: AgentExplanation | null;
}

interface AgentPlanStep {
  readonly id: string;
  readonly title: string;
  readonly mode: LearningMode;
  readonly reason: string;
  readonly outcome: string;
}

export interface AgentPlan {
  readonly headline: string;
  readonly summary: string;
  readonly selected_mode: LearningMode;
  readonly expected_outcome: string;
  readonly steps: ReadonlyArray<AgentPlanStep>;
}

interface AgentActivityChoice {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly is_correct?: boolean;
  readonly feedback_layers?: ReadonlyArray<string>;
  readonly analysis?: string | null;
}

type AgentActivityInput =
  | {
      readonly type: "choice";
      readonly choices: ReadonlyArray<AgentActivityChoice>;
    }
  | {
      readonly type: "text";
      readonly placeholder: string;
      readonly min_length: number;
    };

export interface AgentActivity {
  readonly id: string;
  readonly kind: LearningActivity["kind"];
  readonly title: string;
  readonly objective: string;
  readonly prompt: string;
  readonly support: string;
  readonly mode: LearningMode | null;
  readonly evidence: ReadonlyArray<string>;
  readonly submit_label: string;
  readonly input: AgentActivityInput;
}

export interface AgentLearnerUnitState {
  readonly unit_id: string;
  readonly mastery: number;
  readonly understanding_level: number;
  readonly memory_strength: number;
  readonly confusion_level: number;
  readonly transfer_readiness: number;
  readonly weak_signals: ReadonlyArray<string>;
  readonly recommended_action: AgentAction | null;
  readonly confidence: number;
  readonly based_on: ReadonlyArray<string>;
}

interface AgentLearnerStatePatch {
  readonly mastery: number | null;
  readonly understanding_level: number | null;
  readonly memory_strength: number | null;
  readonly confusion_level: number | null;
  readonly transfer_readiness: number | null;
  readonly weak_signals: ReadonlyArray<string> | null;
  readonly recommended_action: AgentAction | null;
  readonly last_reviewed_at: string | null;
  readonly next_review_at: string | null;
}

interface AgentLastAction {
  readonly action: AgentAction;
  readonly mode: LearningMode | null;
  readonly unit_id: string | null;
}

interface AgentReviewPatch {
  readonly due_unit_ids: ReadonlyArray<string> | null;
  readonly scheduled_at: string | null;
  readonly review_reason: string | null;
}

export interface AgentStatePatch {
  readonly learner_state_patch: AgentLearnerStatePatch | null;
  readonly last_action: AgentLastAction | null;
  readonly review_patch: AgentReviewPatch | null;
}

export type AgentStreamEvent =
  | {
      readonly event: "status";
      readonly phase: "loading-context" | "making-decision" | "retrieving-context" | "composing-response";
      readonly message: string;
    }
  | { readonly event: "text-delta"; readonly delta: string }
  | { readonly event: "diagnosis"; readonly diagnosis: AgentDiagnosis }
  | { readonly event: "activity"; readonly activity: AgentActivity }
  | { readonly event: "activities"; readonly activities: ReadonlyArray<AgentActivity> }
  | { readonly event: "plan"; readonly plan: AgentPlan }
  | { readonly event: "state-patch"; readonly state_patch: AgentStatePatch }
  | { readonly event: "done"; readonly final_message: string | null };

export interface AgentRunResult {
  readonly graph_state: {
    readonly signals: ReadonlyArray<AgentSignal>;
    readonly learner_unit_state: AgentLearnerUnitState | null;
    readonly diagnosis: AgentDiagnosis | null;
    readonly plan: AgentPlan | null;
    readonly activity: AgentActivity | null;
    readonly activities: ReadonlyArray<AgentActivity>;
    readonly assistant_message: string | null;
    readonly state_patch: AgentStatePatch | null;
    readonly rationale: ReadonlyArray<string>;
  };
  readonly events: ReadonlyArray<AgentStreamEvent>;
}

export interface AgentThreadContext {
  readonly thread_id: string;
  readonly entry_mode: AgentEntryMode;
  readonly source_asset_ids: ReadonlyArray<string>;
  readonly updated_at: string;
}

export interface AgentAssetSummaryAsset {
  readonly id: string;
  readonly title: string;
  readonly kind: SourceAsset["kind"];
  readonly topic: string;
  readonly contentExcerpt: string;
  readonly keyConcepts: ReadonlyArray<string>;
  readonly relevanceHint: string;
}

export interface AgentAssetSummary {
  readonly assetIds: ReadonlyArray<string>;
  readonly assets: ReadonlyArray<AgentAssetSummaryAsset>;
  readonly keyConcepts: ReadonlyArray<string>;
  readonly summary: string;
}

export interface AgentReviewEvent {
  readonly event_kind: "reviewed" | "scheduled";
  readonly event_at: string;
  readonly review_reason: string | null;
}

export interface AgentReviewInspector {
  readonly focusUnitId: string;
  readonly dueUnitIds: ReadonlyArray<string> | null;
  readonly scheduledAt: string | null;
  readonly reviewCount: number;
  readonly lapseCount: number;
  readonly performanceTrend: {
    readonly memoryStrength: number;
    readonly understandingLevel: number;
    readonly confusionLevel: number;
    readonly weakSignals: ReadonlyArray<string>;
    readonly trendHint: string;
  } | null;
  readonly decayRisk: "unknown" | "low" | "medium" | "high" | "critical";
  readonly lastReviewOutcome: {
    readonly scheduledAt: string | null;
    readonly reviewReason: string | null;
    readonly dueUnitIds: ReadonlyArray<string> | null;
    readonly reviewCount: number;
    readonly lapseCount: number;
  } | null;
  readonly summary: string;
  readonly events: ReadonlyArray<AgentReviewEvent>;
}

export interface AgentInspectorBootstrap {
  readonly thread_context: AgentThreadContext | null;
  readonly learner_state: AgentLearnerUnitState | null;
  readonly review_inspector: AgentReviewInspector | null;
}

export interface RuntimeSignalCard {
  readonly id: string;
  readonly label: string;
  readonly observation: string;
  readonly implication: string;
}

export interface RuntimeSnapshot {
  readonly source: "mock" | "hydrated-state" | "live-agent";
  readonly state: {
    readonly mastery: number;
    readonly understandingLevel: number;
    readonly memoryStrength: number;
    readonly confusion: number;
    readonly transferReadiness: number | null;
    readonly weakSignals: ReadonlyArray<string>;
    readonly recommendedAction: AgentAction;
    readonly lastReviewedAt: string | null;
    readonly nextReviewAt: string | null;
  };
  readonly stateSource: string;
  readonly signalCards: ReadonlyArray<RuntimeSignalCard>;
  readonly decision: {
    readonly title: string;
    readonly reason: string;
    readonly objective: string;
    readonly confidence: number | null;
  };
  readonly plan: {
    readonly headline: string;
    readonly summary: string;
    readonly steps: ReadonlyArray<StudyPlanStep>;
    readonly highlightedModes: ReadonlyArray<LearningMode>;
    readonly primaryMode: LearningMode | null;
  };
  readonly writeback: ReadonlyArray<WritebackPreview>;
  readonly activity: LearningActivity | null;
  readonly activities: ReadonlyArray<LearningActivity>;
  readonly assistantMessage: string;
  readonly streamStatusLabel: string | null;
  readonly rationale: ReadonlyArray<string>;
}

const SIGNAL_COPY: Record<AgentSignalKind, { label: string; implication: string }> = {
  "concept-gap": {
    label: "理解缺口",
    implication: "当前更适合先补框架，而不是直接推进更难的迁移练习。",
  },
  "concept-confusion": {
    label: "概念混淆",
    implication: "要先把边界拉清楚，否则会带着错模型继续推进项目。",
  },
  "memory-weakness": {
    label: "记忆走弱",
    implication: "下一轮需要把关键概念重新拉回可用状态，避免只剩模糊印象。",
  },
  "transfer-readiness": {
    label: "迁移能力",
    implication: "系统会判断是继续讲解，还是可以把知识丢进真实情境验证。",
  },
  "review-pressure": {
    label: "复习压力",
    implication: "说明这轮不仅要学新内容，还要考虑是否该安排复盘窗口。",
  },
  "project-relevance": {
    label: "项目相关性",
    implication: "系统确认当前问题和真实项目绑定，可以直接按项目学习来编排。",
  },
};

const PRIMARY_ISSUE_COPY: Record<AgentPrimaryIssue, string> = {
  "insufficient-understanding": "当前的主要问题是理解框架还没成形。",
  "concept-confusion": "当前最需要先拆开容易混淆的边界。",
  "weak-recall": "当前瓶颈更像记忆可用性下降。",
  "poor-transfer": "当前已经不只是会不会背，而是能不能用到项目场景。",
  "missing-context": "系统判断当前仍缺少必要上下文，先补足背景再继续。",
};

function formatDateLabel(value: string | null): string | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function toSignalCard(signal: AgentSignal, index: number): RuntimeSignalCard {
  const copy = SIGNAL_COPY[signal.kind];

  return {
    id: `${signal.kind}-${index}`,
    label: copy.label,
    observation: signal.summary,
    implication: `${copy.implication} 当前置信度 ${(signal.confidence * 100).toFixed(0)}%。`,
  };
}

function buildSignalCardsFromStream(
  diagnosis: AgentDiagnosis,
  learnerState: AgentLearnerUnitState,
): ReadonlyArray<RuntimeSignalCard> {
  const cards: RuntimeSignalCard[] = [
    {
      id: "stream-primary-issue",
      label: "主要问题",
      observation: PRIMARY_ISSUE_COPY[diagnosis.primary_issue],
      implication: `${diagnosis.reason} 当前置信度 ${(diagnosis.confidence * 100).toFixed(0)}%。`,
    },
  ];

  learnerState.based_on.slice(0, 2).forEach((reason, index) => {
    cards.push({
      id: `stream-based-on-${index}`,
      label: `判断依据 ${index + 1}`,
      observation: reason,
      implication: "这条依据会继续影响下一轮动作选择和状态回写。",
    });
  });

  if (cards.length < 3 && learnerState.weak_signals.length > 0) {
    cards.push({
      id: "stream-weak-signals",
      label: "弱信号",
      observation: learnerState.weak_signals.join(" / "),
      implication: "系统会把这些弱信号继续挂在当前 unit 上，避免下一轮重新从零判断。",
    });
  }

  return cards;
}

function buildChoice(input: {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly isCorrect: boolean;
  readonly feedbackLayers: ReadonlyArray<string>;
  readonly analysis: string;
}) {
  return {
    id: input.id,
    label: input.label,
    detail: input.detail,
    isCorrect: input.isCorrect,
    feedbackLayers: input.feedbackLayers,
    analysis: input.analysis,
  };
}

function buildChoiceInput(
  ...choices: Array<ReturnType<typeof buildChoice>>
): LearningActivity["input"] {
  return {
    type: "choice",
    choices,
  };
}

function buildActivityChoiceSet(input: {
  readonly mode: LearningMode;
  readonly unitId: string;
  readonly action: AgentAction;
}): LearningActivity["input"] {
  if (input.unitId === "unit-rag-retrieval") {
    if (input.mode === "contrast-drill") {
      return buildChoiceInput(
        buildChoice({
          id: "rerank-when-candidates-exist",
          label: "top-k 里已经有相关文档，但排在前面的常是语义相近却答非所问的片段。",
          detail: "候选基本找到了，问题更像排序没把真正对口的证据顶到前面。",
          isCorrect: true,
          feedbackLayers: [
            "对，这更像“候选已在集合里，但顺序没把最该看的证据排前面”，所以该补重排。",
            "关键不是继续扩大召回，而是让已有候选按任务相关性重新排序，把真正回答问题的片段顶上来。",
          ],
          analysis: "这条回答准确抓住了“召回基本够、但前排排序不对”的信号，最符合这轮要辨析的边界。",
        }),
        buildChoice({
          id: "recall-not-enough",
          label: "top-k 里经常根本找不到答案对应文档，所以优先加一个重排层。",
          detail: "这更像召回覆盖不足，先该补召回或索引，而不是指望重排把不存在的候选排出来。",
          isCorrect: false,
          feedbackLayers: [
            "先别急着加重排。正确文档如果还没进候选集，重排也无从发挥。",
            "这类现象更像召回覆盖不足：该先看索引、召回策略或查询表达，而不是把问题直接归到排序。",
            "重排解决的是“候选已有但排序不够对口”，不是“正确文档根本没被召回进来”。这里先补重排会把问题诊断偏掉。",
          ],
          analysis: "这条选择把“召回覆盖不足”和“排序相关性不足”混为一谈，是这轮最需要纠正的误判。",
        }),
        buildChoice({
          id: "stuff-more-context",
          label: "把 top-k 调大、多塞一些上下文给模型，就可以替代重排。",
          detail: "会把排序问题伪装成堆料问题，常常同时放大噪音和上下文污染。",
          isCorrect: false,
          feedbackLayers: [
            "多塞内容不等于解决排序问题，反而可能把噪音一起抬进上下文。",
            "如果最该看的证据没有被排到前面，单纯加大 top-k 只会让模型更难聚焦。",
            "这里缺的不是“更多内容”，而是“把真正对口的内容排到前面”。用堆上下文代替重排，通常会同时损失稳定性和可解释性。",
          ],
          analysis: "这条选择把“需要更好排序”误写成“需要更多上下文”，会让系统设计继续跑偏。",
        }),
      );
    }

    if (input.mode === "guided-qa" || input.mode === "socratic") {
      return buildChoiceInput(
        buildChoice({
          id: "rerank-explains-ordering-gap",
          label: "重排是在“候选已经召回进来”的前提下，把最回答问题的证据排到前面。",
          detail: "它补的是任务相关性排序，不是替代召回把漏掉的文档找回来。",
          isCorrect: true,
          feedbackLayers: [
            "对，这句解释把重排真正补的缺口说清楚了：不是补召回，而是补排序。",
            "只要这层边界讲清楚，后面再谈什么时候该加重排就有了稳定判断标准。",
          ],
          analysis: "这条表述直接命中“重排补排序、不补召回”的核心边界，是当前知识点最该先说清的一句。",
        }),
        buildChoice({
          id: "rerank-recovers-missed-docs",
          label: "重排的主要作用是把本来没召回到的正确文档重新找回来。",
          detail: "这会把重排误说成召回补丁，混掉两阶段架构里的职责边界。",
          isCorrect: false,
          feedbackLayers: [
            "这句最大的问题是把重排说成了“补召回”。",
            "如果正确文档根本不在候选集里，重排没有素材可排；它能做的是在已有候选里重排相关性。",
            "一旦把重排误写成“找回漏召文档”，后面对系统问题的诊断就会全线偏掉：你会错把召回缺口当成排序缺口。",
          ],
          analysis: "这条说法直接混淆了召回和重排的职责，是这轮必须排掉的典型误解。",
        }),
        buildChoice({
          id: "strong-embedding-removes-rerank",
          label: "只要 embedding 足够强，重排基本就没有实际价值。",
          detail: "embedding 决定召回语义能力，但不自动等于任务级的前排排序足够稳。",
          isCorrect: false,
          feedbackLayers: [
            "embedding 更强不等于前排结果已经足够对口。",
            "很多场景里，问题不是“能不能把相关候选找进来”，而是“前几条到底是不是最该给模型看的证据”。",
            "重排存在的原因正是：即使召回足够强，前排顺序仍可能把语义相近但不真正回答问题的片段放在前面。",
          ],
          analysis: "这条选择把召回语义能力和任务相关性排序混成一层，容易让系统设计判断失焦。",
        }),
      );
    }

    if (input.mode === "scenario-sim" || input.action === "apply") {
      return buildChoiceInput(
        buildChoice({
          id: "review-explain-relevance-order",
          label: "我们先保证候选能进来，再用重排把最回答问题的证据排前面，不然生成很容易抓错上下文。",
          detail: "这句先讲判断链路，再讲为什么不能偷成“只召回就行”。",
          isCorrect: true,
          feedbackLayers: [
            "对，这种解释先把两层职责拆开，再把“为什么需要重排”说清楚了。",
            "评审或同事真正需要听到的就是这层取舍：不是多做一步，而是为了减少前排证据错位。",
          ],
          analysis: "这条回答把“候选进入”和“前排排序”拆成两层，是项目语境下最有说服力的解释方式。",
        }),
        buildChoice({
          id: "review-blame-model-size",
          label: "加重排主要是因为模型还不够强，等模型更强就不需要这些结构了。",
          detail: "会把方案取舍偷换成模型强弱问题，答不到设计边界本身。",
          isCorrect: false,
          feedbackLayers: [
            "这句把方案取舍偷换成了模型强弱，解释焦点跑偏了。",
            "别人真正要问的是“为什么当前链路需要这一步”，不是“模型什么时候会更强”。",
            "如果只把原因归结为模型不够强，你就没有解释清楚：即使模型更强，候选排序和证据对口性为什么仍然重要。",
          ],
          analysis: "这条回答把结构化设计问题错误归因成模型能力问题，不利于答辩或方案讨论。",
        }),
        buildChoice({
          id: "review-just-stuff-more",
          label: "只要把更多召回结果直接拼给模型，通常就能替代重排。",
          detail: "会把“前排排序不对”的问题继续伪装成“内容还不够多”。",
          isCorrect: false,
          feedbackLayers: [
            "这类回答最大的问题是默认“多给内容”能替代排序判断。",
            "但如果前几条证据本来就不对口，多塞内容只会让模型更难聚焦，甚至把错证据一起放大。",
            "评审想听的是：为什么不能偷成“只召回 + 多塞上下文”。真正原因是候选进入和前排排序是两层不同的质量控制点。",
          ],
          analysis: "这条说法会把排序缺口继续伪装成堆料问题，无法真正说明为什么需要重排。",
        }),
      );
    }
  }

  if (input.unitId === "unit-rag-core") {
    if (input.mode === "contrast-drill" || input.mode === "guided-qa" || input.mode === "socratic") {
      return buildChoiceInput(
        buildChoice({
          id: "rag-needs-context-construction",
          label: "检索命中只是拿到候选；排序、截断和上下文组织决定模型最终会不会抓对证据。",
          detail: "这才是“RAG 不是简单检索 + 拼接”的核心原因。",
          isCorrect: true,
          feedbackLayers: [
            "对，这句把“检索命中”和“上下文可用”拆开了。",
            "只要这层关系讲清楚，就不会再把 RAG 理解成机械地把检索结果全文塞进 prompt。",
          ],
          analysis: "这条回答直接指出了 RAG 多出来的关键层：上下文构造，而不是单纯检索命中。",
        }),
        buildChoice({
          id: "rag-just-concat",
          label: "只要能检索到相关文档，把全文直接拼进 prompt 就够了。",
          detail: "会忽略排序、截断和噪音控制，把可用上下文误写成原始拼接。",
          isCorrect: false,
          feedbackLayers: [
            "问题不在“有没有文档”，而在“给模型的上下文是不是被组织成了可用证据”。",
            "直接全文拼接通常会把噪音、重复和无关段落一起塞进去，命中了也不代表模型能用好。",
            "这句把 RAG 误简化成“检索完就拼接”，正好漏掉了真正决定回答质量的那一层：上下文构造。",
          ],
          analysis: "这条说法忽略了上下文构造这层关键决策，会把 RAG 错看成机械拼接流程。",
        }),
        buildChoice({
          id: "rag-more-is-better",
          label: "RAG 的核心只是让模型看到更多内容，所以内容越多越好。",
          detail: "会把质量控制偷换成覆盖率直觉，忽略上下文窗口和证据优先级。",
          isCorrect: false,
          feedbackLayers: [
            "“更多内容”不是目标，给出“更对口的证据”才是目标。",
            "一旦内容过多、顺序不对或噪音过高，模型反而更容易抓错线索。",
            "RAG 不只是扩上下文，而是在有限窗口里做证据选择和组织。把它说成“越多越好”，会直接丢掉这层设计判断。",
          ],
          analysis: "这条选择把 RAG 错写成纯覆盖率问题，忽视了上下文构造和噪音控制。",
        }),
      );
    }

    if (input.mode === "scenario-sim" || input.action === "apply") {
      return buildChoiceInput(
        buildChoice({
          id: "rag-explain-context-layer",
          label: "检索到只是第一步，我们还要把最相关、最可回答问题的证据组织成可用上下文，RAG 才稳定。",
          detail: "这句先讲链路，再讲为什么不能偷成“检索 + 拼接”。",
          isCorrect: true,
          feedbackLayers: [
            "对，这种解释先把“找到候选”和“组织上下文”拆开了，听起来就不是黑盒堆料。",
            "只要把这层讲清楚，别人就能理解为什么 RAG 不是做完检索就结束。",
          ],
          analysis: "这条回答直指 RAG 相比“检索 + 拼接”多出的关键控制层，最适合对外解释。",
        }),
        buildChoice({
          id: "rag-explain-only-retrieval",
          label: "RAG 的关键就是把更多相关文档检索出来，后面拼接是细节。",
          detail: "会把上下文构造降成细节，解释不到最终回答质量为什么会分化。",
          isCorrect: false,
          feedbackLayers: [
            "这句把真正影响回答质量的一层降成了“细节”。",
            "别人想知道的是：为什么检索到了还可能答不好；如果不谈上下文构造，这个问题就没被回答。",
            "把“拼接/组织/筛选”都当成细节，会让方案听起来像只是多检索一点文档，而不是在做证据质量控制。",
          ],
          analysis: "这条说法仍把 RAG 讲成“检索主导”，解释力不够，容易被追问打穿。",
        }),
        buildChoice({
          id: "rag-explain-model-magic",
          label: "只要模型足够强，RAG 本质上就只是把检索结果交给模型自己消化。",
          detail: "会把系统设计责任偷交给模型，绕开链路取舍。",
          isCorrect: false,
          feedbackLayers: [
            "这句把问题再次推回模型强弱，没解释为什么系统还要设计上下文构造。",
            "即使模型更强，证据顺序、噪音和窗口限制也不会自动消失。",
            "如果对方问“那为什么不直接全交给模型自己处理”，你还是需要回到证据组织和质量控制这层，而不是用模型能力兜底。",
          ],
          analysis: "这条回答会把系统设计判断偷换成模型能力崇拜，不利于讲清真实取舍。",
        }),
      );
    }
  }

  if (input.unitId === "unit-rag-explain") {
    return buildChoiceInput(
      buildChoice({
        id: "explain-risk-and-tradeoff",
        label: "先讲业务风险和稳定性：这些步骤是在减少答非所问、证据错位和不可解释性。",
        detail: "先让非技术对象听懂为什么要这样设计，再展开技术实现。",
        isCorrect: true,
        feedbackLayers: [
          "对，先讲风险控制和业务影响，非技术对象才能听懂为什么这套结构有必要。",
          "这条开场能先建立“为什么这样设计”的心智，再往下接技术细节才不会散。",
        ],
        analysis: "这条说法先把评审真正关心的取舍讲清楚，是最适合作为解释开场的一句。",
      }),
      buildChoice({
        id: "explain-implementation-first",
        label: "先按顺序罗列 embedding、reranker、chunking、prompt 的实现步骤。",
        detail: "实现细节会让技术人点头，但不足以让评审先理解为什么需要这套方案。",
        isCorrect: false,
        feedbackLayers: [
          "实现步骤不是不能讲，但它不该是开场第一句。",
          "如果先列技术栈，评审或产品还没建立“为什么需要这套结构”的心智，很容易觉得你只是在堆术语。",
          "更有效的顺序是：先讲它解决什么风险和业务问题，再解释这些技术步骤各自承担哪层控制作用。",
        ],
        analysis: "这条开场把解释重心放在实现过程，忽略了“为什么这样设计”的答辩主线。",
      }),
      buildChoice({
        id: "explain-model-only",
        label: "先说如果模型再强一点，这些设计大多都可以省掉。",
        detail: "会把方案取舍偷换成模型强弱判断，显得整套设计只是权宜之计。",
        isCorrect: false,
        feedbackLayers: [
          "这会让整套方案听起来像“模型不够强时的临时补丁”，说服力会立刻下降。",
          "评审真正要听到的是：为什么这些结构本身就在控制质量和风险，而不是等更强模型来替代。",
          "如果开场就把原因归给模型不够强，你后面会越来越难解释：那为什么当前还值得做这些设计、ROI 又在哪里。",
        ],
        analysis: "这条回答会把系统设计价值削弱成模型短板补丁，不利于评审沟通。",
      }),
    );
  }

  if (input.mode === "contrast-drill") {
    return buildChoiceInput(
      buildChoice({
        id: "trace-boundary",
        label: "先把这条知识点里最关键的边界拉开，再决定下一步该补哪条证据。",
        detail: "先定位真正的判断对象，而不是继续泛泛补信息。",
        isCorrect: true,
        feedbackLayers: [
          "对，先把边界拉开，后面补证据才不会越补越乱。",
          "这轮先确认“到底哪两层最容易混”，比立刻堆更多信息更重要。",
        ],
        analysis: "这条回答先处理边界，再决定补证据方向，更符合辨析题的目标。",
      }),
      buildChoice({
        id: "increase-context",
        label: "先继续加更多信息，看看能不能把当前问题一起覆盖掉。",
        detail: "会把边界没拉开的缺口继续藏在信息噪音里。",
        isCorrect: false,
        feedbackLayers: [
          "先别急着加信息。现在更缺的是问题定位，不是覆盖率。",
          "如果边界还没拉开，继续加材料通常只会把噪音一起放大。",
          "真正要先回答的是：你现在混的是哪两层、哪一个判断标准还不稳。没定位前继续加料，后面会更难纠偏。",
        ],
        analysis: "这条选择把边界问题误写成信息不足，容易继续跑偏。",
      }),
      buildChoice({
        id: "skip-diagnosis",
        label: "先给一个大概结论，判断依据先不展开。",
        detail: "会让真正的混淆点继续藏着，系统也更难给出下一步。",
        isCorrect: false,
        feedbackLayers: [
          "只给结论还不够，这轮更关键的是把判断依据露出来。",
          "如果不展开依据，系统就看不见你到底是概念边界没稳，还是证据选择没稳。",
          "辨析题的价值就在于暴露“你靠什么区分它们”。如果把依据省掉，后面的学习编排就只能走更保守的路径。",
        ],
        analysis: "这条选择回避了判断依据，系统难以定位真实缺口。",
      }),
    );
  }

  if (input.mode === "scenario-sim") {
    return buildChoiceInput(
      buildChoice({
        id: "explain-judgment-chain",
        label: "先把关键步骤分别控制什么风险讲清楚，再解释为什么不能偷成更省事的做法。",
        detail: "项目讨论里，别人真正要听到的是判断链路，而不是只背最终结论。",
        isCorrect: true,
        feedbackLayers: [
          "对，项目解释最重要的是把判断链路和风险控制说出来。",
          "只要把“为什么不能偷简化”讲清楚，这轮就不只是背答案，而是真的能解释方案。",
        ],
        analysis: "这条选择把方案拆回判断链路，最能验证项目场景里的解释能力。",
      }),
      buildChoice({
        id: "stack-more-context",
        label: "重点强调信息越多越安全，先把更多内容塞进去再说。",
        detail: "会把系统设计问题继续伪装成覆盖率问题。",
        isCorrect: false,
        feedbackLayers: [
          "光强调“多放信息更安全”不够，因为它没有解释每一步为什么存在。",
          "项目讨论里，别人更想知道的是：哪些步骤在控制风险、为什么不能直接偷简化。",
          "如果不拆出关键判断链路，这个回答会把设计问题伪装成“多塞内容就行”的覆盖率问题，说服力会很弱。",
        ],
        analysis: "这条选择仍把重点放在堆信息，而不是解释关键判断链路。",
      }),
      buildChoice({
        id: "focus-model-only",
        label: "先把问题归因成模型或工具不够强，判断链路后面再说。",
        detail: "会跳过系统设计层的取舍标准，很难真的说服别人。",
        isCorrect: false,
        feedbackLayers: [
          "这会把责任全推给模型强弱，但没有回答系统为什么要这样设计。",
          "别人真正想知道的是：哪些步骤在控制风险、提高稳定性，而不是一句“模型还不够强”。",
          "如果不解释判断链路，模型再强也只是黑盒结论；你仍然没说明为什么当前方案需要这些结构。",
        ],
        analysis: "这条选择跳过了系统设计层的判断标准，解释焦点会跑偏。",
      }),
    );
  }

  if (input.mode === "guided-qa" || input.mode === "socratic") {
    return buildChoiceInput(
      buildChoice({
        id: "explain-boundary",
        label: "先给出和当前知识点直接相关的判断边界，再补一句为什么。",
        detail: "先让答案落在这条知识点本身，而不是只绕着答题方式打转。",
        isCorrect: true,
        feedbackLayers: [
          "对，先把当前知识点里的判断边界说清楚，后面的解释才有落点。",
          "这能更快看出你是否真的理解，而不是只会复述表面定义。",
        ],
        analysis: "这条回答先落在知识点本身，再补原因，更容易验证理解是否稳定。",
      }),
      buildChoice({
        id: "repeat-definition",
        label: "先复述概念定义，边界和应用后面再说。",
        detail: "只停在定义层，往往会把真正的判断缺口继续盖住。",
        isCorrect: false,
        feedbackLayers: [
          "先别退回纯定义。当前更重要的是把边界和判断标准拉开。",
          "只复述定义常常会让人“看起来懂了”，但一到实际判断还是会混。",
          "这轮要验证的是你能不能把知识点用在判断上，而不是能不能背出教材式表述。只停在定义层，真实缺口会继续被盖住。",
        ],
        analysis: "这条选择把任务退回成复述定义，绕开了当前真正要验证的内容。",
      }),
      buildChoice({
        id: "jump-to-solution",
        label: "先直接给一个结论，判断依据之后再补。",
        detail: "会让系统看不见你是怎么区分、怎么推到这个答案的。",
        isCorrect: false,
        feedbackLayers: [
          "先给结论还不够，因为这轮还要看到你的判断过程。",
          "如果不解释为什么这样判断，后面就很难区分你是真的理解，还是碰巧押中了答案。",
          "这轮最有价值的信息是：你靠什么证据、什么标准得出这个判断。如果直接跳到结论，这层学习信号会直接丢掉。",
        ],
        analysis: "这条选择省掉了判断过程，系统难以确认理解是否真的稳固。",
      }),
    );
  }

  if (input.mode === "image-recall" || input.mode === "audio-recall") {
    return buildChoiceInput(
      buildChoice({
        id: "recall-key-criterion",
        label: "先回忆关键判断标准，再看自己哪里记不稳。",
        detail: "优先验证可回忆性，而不是继续看材料。",
        isCorrect: true,
        feedbackLayers: [
          "对，复习时先看自己能不能直接回忆出判断标准。",
          "这能区分出是真记住了，还是只是刚看过材料还留着余温。",
        ],
        analysis: "这条回答优先验证主动回忆能力，最符合复习轮的目标。",
      }),
      buildChoice({
        id: "peek-material",
        label: "先回材料确认一遍，再回答。",
        detail: "会绕开主动回忆，系统没法判断记忆是否真的可用。",
        isCorrect: false,
        feedbackLayers: [
          "这会先把答案补回来，但复习轮想看的正是你此刻能不能自己想起。",
          "一旦先看材料，系统就分不清是你真的记住了，还是刚刚被提示起来的。",
          "复习轮的核心不是把题做对一次，而是测出记忆是不是已经能脱离材料独立调用；先回看材料会直接损失这层信息。",
        ],
        analysis: "这条选择绕开了主动回忆，系统无法判断记忆是否真正稳定可用。",
      }),
      buildChoice({
        id: "guess-roughly",
        label: "先模糊说个大概，细节以后再补。",
        detail: "会把记忆断点藏起来，降低复习判断质量。",
        isCorrect: false,
        feedbackLayers: [
          "模糊带过会让真正的记忆断点被藏起来。",
          "如果你只说个大概，系统很难判断你是差一点就想起来，还是核心标准已经丢了。",
          "复习轮需要的是清晰暴露断点：到底是哪条标准想不起来、哪一步顺序记混了。含糊作答会让后续编排失真。",
        ],
        analysis: "这条选择用含糊回答掩盖了真实断点，降低了复习信号质量。",
      }),
    );
  }

  return buildChoiceInput(
    buildChoice({
      id: "state-core-judgment",
      label: "先说出这一轮最关键的判断，再解释原因。",
      detail: "这样最容易暴露当前真正稳不稳。",
      isCorrect: true,
      feedbackLayers: [
        "对，先说关键判断，系统才能看见你最核心的理解是否稳。",
        "这条回答能先暴露真正的判断标准，再展开原因，信息密度最高。",
      ],
      analysis: "这条回答先给关键判断，再补原因，最有利于系统读取真实学习状态。",
    }),
    buildChoice({
      id: "repeat-material",
      label: "先把材料里的原话重述一遍，确保信息没漏。",
      detail: "会削弱系统对真实理解和迁移能力的判断。",
      isCorrect: false,
      feedbackLayers: [
        "重述材料不等于完成判断，这会把作答变成摘抄。",
        "系统现在要看的不是你能不能复述，而是你能不能抓住这轮最关键的判断点。",
        "如果只是把材料原话搬回来，系统无法判断你是否真的理解、能否迁移，也就很难决定下一步该 teach、clarify 还是 review。",
      ],
      analysis: "这条选择把任务退化成复述材料，弱化了对真实理解和迁移能力的判断。",
    }),
    buildChoice({
      id: "skip-judgment",
      label: "先不给判断，等系统直接告诉我答案。",
      detail: "会让这一轮失去可检视表现，下一步更难编排。",
      isCorrect: false,
      feedbackLayers: [
        "这会直接失去这轮最重要的信号：你现在到底会不会判断。",
        "如果把判断完全交给系统，后面就无法区分你是没理解、记不牢，还是只是暂时没组织好表达。",
        "学习编排依赖的是你的实际表现，而不是系统替你回答。跳过判断会让下一步只能做保守安排，精度会明显变差。",
      ],
      analysis: "这条选择放弃了当前作答机会，系统拿不到足够表现信号继续做高精度编排。",
    }),
  );
}

function buildActivityTitle(input: {
  readonly mode: LearningMode;
  readonly action: AgentAction;
  readonly unitId: string;
}): string {
  if (input.unitId === "unit-rag-retrieval") {
    if (input.mode === "contrast-drill") {
      return "先判断问题出在召回还是排序";
    }
    if (input.mode === "guided-qa" || input.mode === "socratic") {
      return "先讲清楚重排到底在补什么";
    }
    if (input.mode === "scenario-sim" || input.action === "apply") {
      return "先练一次向评审解释为什么需要重排";
    }
  }

  if (input.unitId === "unit-rag-core") {
    if (input.mode === "contrast-drill" || input.mode === "guided-qa" || input.mode === "socratic") {
      return "先判断问题出在检索命中还是上下文构造";
    }
    if (input.mode === "scenario-sim" || input.action === "apply") {
      return "先练一次解释为什么 RAG 不只是检索加拼接";
    }
  }

  if (input.unitId === "unit-rag-explain") {
    return "先练一次对评审解释方案";
  }

  if (input.mode === "contrast-drill") {
    return "先做一个边界辨析";
  }

  if (input.mode === "scenario-sim" || input.action === "apply") {
    return "先做一轮项目情境作答";
  }

  if (input.action === "review" || input.mode === "image-recall" || input.mode === "audio-recall") {
    return "先做一次主动回忆";
  }

  return "先接住导师追问";
}

function buildActivityPrompt(input: {
  readonly action: AgentAction;
  readonly mode: LearningMode;
  readonly unitId: string;
  readonly unitTitle: string;
}): string {
  if (input.unitId === "unit-rag-retrieval") {
    if (input.mode === "contrast-drill") {
      return "围绕「什么时候需要重排，而不是只做向量召回」，选出最合理的判断：下面哪种情况最说明“候选基本找到了，但前排排序不对”，因此该补的是重排？";
    }
    if (input.mode === "guided-qa" || input.mode === "socratic") {
      return "围绕「什么时候需要重排，而不是只做向量召回」，选出更准确的一句解释：重排到底是在补哪一类缺口？";
    }
    if (input.mode === "scenario-sim" || input.action === "apply") {
      return "如果你要向同事或评审解释「什么时候需要重排，而不是只做向量召回」，下面哪种说法最能讲清楚为什么不能偷成“只召回就行”？";
    }
  }

  if (input.unitId === "unit-rag-core") {
    if (input.mode === "contrast-drill" || input.mode === "guided-qa" || input.mode === "socratic") {
      return "围绕「RAG 为什么不是简单检索 + 拼接」，选出更准确的一句判断：真正多出来、而且决定回答质量的那一层是什么？";
    }
    if (input.mode === "scenario-sim" || input.action === "apply") {
      return "如果你要向产品或评审解释「RAG 为什么不是简单检索 + 拼接」，下面哪种说法最能先把设计取舍讲清楚？";
    }
  }

  if (input.unitId === "unit-rag-explain") {
    return "如果你要把「如何把 RAG 方案解释给产品和评审」讲给非技术同事，下面哪种开场最合适？";
  }

  if (input.mode === "contrast-drill") {
    return `围绕「${input.unitTitle}」，选出更合理的一句判断：哪种说法真正抓住了当前最该先分清的边界？`;
  }

  if (input.mode === "scenario-sim" || input.action === "apply") {
    return `如果你要把「${input.unitTitle}」解释给同事或评审，下面哪种说法最能先讲清楚这条方案为什么这样设计？`;
  }

  if (input.action === "review" || input.mode === "image-recall" || input.mode === "audio-recall") {
    return `不要看材料，回忆一下「${input.unitTitle}」里你最该记住的判断标准：先用一句话说核心边界，再补一句为什么。`;
  }

  return `围绕「${input.unitTitle}」，选出更准确的一句解释：哪种说法最能代表你已经抓住这条知识点的核心判断？`;
}

function buildLearningActivity(input: {
  readonly action: AgentAction;
  readonly mode: LearningMode | null;
  readonly order: number;
  readonly reason: string;
  readonly stepTitle: string;
  readonly unit: {
    readonly id: string;
    readonly title: string;
  };
  readonly objective: string;
  readonly evidence: ReadonlyArray<string>;
}): LearningActivity | null {
  const mode = input.mode;
  if (mode === null) {
    return null;
  }

  const kind =
    mode === "contrast-drill"
      ? "quiz"
      : input.action === "review" || mode === "image-recall" || mode === "audio-recall"
        ? "recall"
        : "coach-followup";

  return {
    id: `activity-${input.unit.id}-${mode}-${input.order + 1}`,
    kind,
    title:
      input.order === 0
        ? buildActivityTitle({
            mode,
            action: input.action,
            unitId: input.unit.id,
          })
        : `第 ${input.order + 1} 步：${input.stepTitle}`,
    objective: input.objective,
    prompt: buildActivityPrompt({
      action: input.action,
      mode,
      unitId: input.unit.id,
      unitTitle: input.unit.title,
    }),
    support: input.reason,
    mode,
    evidence: input.evidence.slice(0, 3),
    submitLabel:
      kind === "quiz" ? "提交判断" : kind === "recall" ? "提交回忆" : "提交作答",
    input: buildActivityChoiceSet({
      mode,
      unitId: input.unit.id,
      action: input.action,
    }),
  };
}

function normalizeAgentActivity(activity: AgentActivity): LearningActivity {
  return {
    id: activity.id,
    kind: activity.kind,
    title: activity.title,
    objective: activity.objective,
    prompt: activity.prompt,
    support: activity.support,
    mode: activity.mode,
    evidence: activity.evidence,
    submitLabel: activity.submit_label,
    input:
      activity.input.type === "choice"
        ? {
            type: "choice",
            choices: activity.input.choices.map((choice) => ({
              id: choice.id,
              label: choice.label,
              detail: choice.detail,
              isCorrect: choice.is_correct ?? false,
              feedbackLayers: choice.feedback_layers ?? [],
              analysis: choice.analysis ?? null,
            })),
          }
        : {
            type: "text",
            placeholder: activity.input.placeholder,
            minLength: activity.input.min_length,
          },
  };
}

function normalizeAgentActivities(
  activities: ReadonlyArray<AgentActivity>,
): ReadonlyArray<LearningActivity> {
  return activities.map(normalizeAgentActivity);
}

function buildActivityList(
  primaryActivity: LearningActivity | null,
  additionalActivities?: ReadonlyArray<LearningActivity>,
): ReadonlyArray<LearningActivity> {
  if (additionalActivities !== undefined) {
    return additionalActivities;
  }

  return primaryActivity === null ? [] : [primaryActivity];
}

function buildLearningActivities(input: {
  readonly action: AgentAction;
  readonly evidence: ReadonlyArray<string>;
  readonly plan: AgentPlan;
  readonly unit: {
    readonly id: string;
    readonly title: string;
  };
}): ReadonlyArray<LearningActivity> {
  return input.plan.steps
    .map((step, index) =>
      buildLearningActivity({
        action: input.action,
        mode: step.mode,
        order: index,
        reason: step.reason,
        stepTitle: step.title,
        unit: input.unit,
        objective: step.outcome,
        evidence: input.evidence,
      }),
    )
    .filter((activity): activity is LearningActivity => activity !== null);
}

function withActivities(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  if (snapshot.activities.length > 0 || snapshot.activity === null) {
    return snapshot;
  }

  return {
    ...snapshot,
    activities: [snapshot.activity],
  };
}

export function formatActivitySubmissionForAgent(input: {
  readonly activity: LearningActivity;
  readonly submission: LearningActivitySubmission;
}): string {
  const selectedChoice =
    input.activity.input.type === "choice" && input.submission.selectedChoiceId !== null
      ? input.activity.input.choices.find((choice) => choice.id === input.submission.selectedChoiceId) ??
        null
      : null;
  const normalizedResponse = input.submission.responseText.trim();

  if (selectedChoice !== null) {
    return `我的选择是「${selectedChoice.label}」。请根据这个判断继续安排下一步。`;
  }

  if (normalizedResponse !== "") {
    return `我的回答是：${normalizedResponse}。请根据这个回答继续安排下一步。`;
  }

  return `我完成了「${input.activity.title}」。请继续安排下一步。`;
}

function buildWritebackFromAgent(statePatch: AgentStatePatch | null): ReadonlyArray<WritebackPreview> {
  if (statePatch === null) {
    return [];
  }

  const items: WritebackPreview[] = [];
  const learnerPatch = statePatch.learner_state_patch;

  if (learnerPatch?.understanding_level !== null && learnerPatch?.understanding_level !== undefined) {
    items.push({
      id: "writeback-understanding",
      target: "LearnerState.understandingLevel",
      change: `把当前理解水平估计更新到 ${learnerPatch.understanding_level}，作为下一轮动作选择依据。`,
    });
  }

  if (learnerPatch?.confusion_level !== null && learnerPatch?.confusion_level !== undefined) {
    items.push({
      id: "writeback-confusion",
      target: "LearnerState.confusionLevel",
      change: `记录当前混淆风险 ${learnerPatch.confusion_level}，继续追踪是否已经把边界拉开。`,
    });
  }

  if (statePatch.last_action?.action !== null && statePatch.last_action?.action !== undefined) {
    items.push({
      id: "writeback-last-action",
      target: "LastAction",
      change: `记录本轮执行了 ${statePatch.last_action.action} / ${statePatch.last_action.mode ?? "unknown"}。`,
    });
  }

  if (statePatch.review_patch?.scheduled_at) {
    items.push({
      id: "writeback-review",
      target: "Review Engine",
      change: `安排下一次复盘时间 ${formatDateLabel(statePatch.review_patch.scheduled_at) ?? statePatch.review_patch.scheduled_at}。`,
    });
  }

  if (items.length === 0) {
    items.push({
      id: "writeback-thread",
      target: "Project Thread",
      change: "把这轮判断、动作和结果写回线程，作为下一轮编排的上下文。",
    });
  }

  return items;
}

function buildAssistantMessageFromEvents(result: AgentRunResult): string {
  const doneEvent = result.events.find((event) => event.event === "done");
  if (doneEvent?.final_message) {
    return doneEvent.final_message;
  }

  const deltaText = result.events
    .filter((event): event is Extract<AgentStreamEvent, { event: "text-delta" }> => event.event === "text-delta")
    .map((event) => event.delta)
    .join("");

  return deltaText || result.graph_state.assistant_message || "Agent 已返回结构化结果。";
}

function buildAssistantMessageFromStreamEvents(events: ReadonlyArray<AgentStreamEvent>): string {
  const doneEvent = events.find((event) => event.event === "done");
  if (doneEvent?.final_message) {
    return doneEvent.final_message;
  }

  return events
    .filter(
      (event): event is Extract<AgentStreamEvent, { event: "text-delta" }> =>
        event.event === "text-delta",
    )
    .map((event) => event.delta)
    .join("");
}

function getLatestStreamStatusLabel(events: ReadonlyArray<AgentStreamEvent>): string | null {
  const statusEvent = [...events]
    .reverse()
    .find(
      (event): event is Extract<AgentStreamEvent, { event: "status" }> =>
        event.event === "status",
    );

  return statusEvent?.message ?? null;
}

export function buildDefaultAgentPrompt(
  unit: LearningUnit,
  project: ProjectContext,
): string {
  return `我正在推进「${project.name}」，当前目标是${project.goal}。请围绕「${unit.title}」判断我这轮更适合先学什么，并解释为什么。`;
}

export function getRequestSourceAssetIds(
  _entryMode: AgentEntryMode,
  sourceAssets: ReadonlyArray<SourceAsset>,
): ReadonlyArray<string> {
  return sourceAssets.map((asset) => asset.id);
}

export function buildAgentRequest(input: {
  readonly activityResult: AgentActivityResult | null;
  readonly projectId: string;
  readonly sessionId: string;
  readonly sessionType: SessionType;
  readonly entryMode: AgentEntryMode;
  readonly prompt: string;
  readonly project: ProjectContext;
  readonly sourceAssets: ReadonlyArray<SourceAsset>;
  readonly unit: LearningUnit;
  readonly targetUnitId: string | null;
}): AgentRequest {
  const normalizedPrompt = input.prompt.trim();
  const fallbackPrompt = normalizedPrompt || buildDefaultAgentPrompt(input.unit, input.project);
  const sourceAssetIds = getRequestSourceAssetIds(input.entryMode, input.sourceAssets);

  return {
    project_id: input.projectId,
    thread_id: input.sessionId,
    session_type: input.sessionType,
    entry_mode: input.entryMode,
    topic:
      input.targetUnitId === null
        ? input.project.goal.trim() || input.project.name
        : input.unit.title,
    messages: [{ role: "user", content: fallbackPrompt }],
    source_asset_ids: sourceAssetIds,
    target_unit_id: input.targetUnitId,
    context_hint: input.project.currentThread,
    activity_result: input.activityResult,
    response_mode: "stream",
  };
}

export function buildMockRuntimeSnapshot(
  profile: LearnerProfile,
  unit: LearningUnit,
  sessionType: SessionType = "study",
): RuntimeSnapshot {
  const plan = buildStudyPlan(unit, profile.state);
  const activities =
    sessionType === "project"
      ? []
      : buildLearningActivities({
          action: profile.state.recommendedAction,
          evidence: profile.state.weakSignals,
          plan: {
            headline: plan.headline,
            summary: plan.summary,
            selected_mode: plan.steps[0]?.mode ?? "guided-qa",
            expected_outcome: plan.decision.objective,
            steps: plan.steps.map((step) => ({
              id: step.id,
              title: step.title,
              mode: step.mode,
              reason: step.reason,
              outcome: step.outcome,
            })),
          },
          unit,
        });
  const activity = activities[0] ?? null;

  return withActivities({
    source: "mock",
    state: {
      mastery: profile.state.mastery,
      understandingLevel: profile.state.understandingLevel,
      memoryStrength: profile.state.memoryStrength,
      confusion: profile.state.confusion,
      transferReadiness: null,
      weakSignals: profile.state.weakSignals,
      recommendedAction: profile.state.recommendedAction,
      lastReviewedAt: profile.state.lastReviewedAt,
      nextReviewAt: profile.state.nextReviewAt,
    },
    stateSource: profile.stateSource,
    signalCards: profile.diagnosisSignals,
    decision: {
      title: plan.decision.title,
      reason: plan.decision.reason,
      objective: plan.decision.objective,
      confidence: null,
    },
    plan: {
      headline: plan.headline,
      summary: plan.summary,
      steps: plan.steps,
      highlightedModes: plan.steps.map((step) => step.mode),
      primaryMode: plan.steps[0]?.mode ?? null,
    },
    writeback: plan.writeback,
    activity,
    activities,
    assistantMessage: `${plan.decision.reason} 这轮我会先用「${plan.decision.title}」推进，目标是${plan.decision.objective}。`,
    streamStatusLabel: null,
    rationale: [],
  });
}

export function hydrateRuntimeSnapshotFromLearnerState(
  learnerState: AgentLearnerUnitState,
  fallbackSnapshot: RuntimeSnapshot,
): RuntimeSnapshot {
  const signalCards =
    learnerState.based_on.length > 0
      ? learnerState.based_on.slice(0, 3).map((reason, index) => ({
          id: `persisted-based-on-${index}`,
          label: `判断依据 ${index + 1}`,
          observation: reason,
          implication: "这条依据来自已落库 learner state，会继续影响下一轮判断。",
        }))
      : fallbackSnapshot.signalCards;

  return withActivities({
    ...fallbackSnapshot,
    source: "hydrated-state",
    state: {
      mastery: learnerState.mastery,
      understandingLevel: learnerState.understanding_level,
      memoryStrength: learnerState.memory_strength,
      confusion: learnerState.confusion_level,
      transferReadiness: learnerState.transfer_readiness,
      weakSignals: learnerState.weak_signals,
      recommendedAction: learnerState.recommended_action ?? fallbackSnapshot.state.recommendedAction,
      lastReviewedAt: fallbackSnapshot.state.lastReviewedAt,
      nextReviewAt: fallbackSnapshot.state.nextReviewAt,
    },
    stateSource: learnerState.based_on.length > 0
      ? `来源：真实 learner state。${learnerState.based_on.join(" / ")}`
      : "来源：真实 learner state。",
    signalCards,
    activity: fallbackSnapshot.activity,
    activities: fallbackSnapshot.activities,
    streamStatusLabel: null,
  });
}

export function normalizeAgentRunResult(result: AgentRunResult): RuntimeSnapshot {
  const diagnosis = result.graph_state.diagnosis;
  const learnerState = result.graph_state.learner_unit_state;
  const plan = result.graph_state.plan;

  if (diagnosis === null || learnerState === null || plan === null) {
    throw new Error("Agent result is missing diagnosis, learner state, or plan.");
  }

  const learnerPatch = result.graph_state.state_patch?.learner_state_patch;
  const primaryReason = diagnosis.explanation?.summary ?? diagnosis.reason;
  const stateSourceParts = [
    "来源：真实 `/runs/v0` agent 结果。",
    PRIMARY_ISSUE_COPY[diagnosis.primary_issue],
    learnerState.based_on.length > 0 ? `判断依据：${learnerState.based_on.join(" / ")}` : null,
  ].filter((item): item is string => item !== null);

  const activities =
    result.graph_state.activities.length > 0
      ? normalizeAgentActivities(result.graph_state.activities)
      : result.graph_state.activity !== null
        ? [normalizeAgentActivity(result.graph_state.activity)]
        : [];
  const activity = activities[0] ?? null;

  return {
    source: "live-agent",
    state: {
      mastery: learnerState.mastery,
      understandingLevel: learnerState.understanding_level,
      memoryStrength: learnerState.memory_strength,
      confusion: learnerState.confusion_level,
      transferReadiness: learnerState.transfer_readiness,
      weakSignals: learnerState.weak_signals,
      recommendedAction: diagnosis.recommended_action,
      lastReviewedAt: formatDateLabel(learnerPatch?.last_reviewed_at ?? null),
      nextReviewAt: formatDateLabel(
        learnerPatch?.next_review_at ?? result.graph_state.state_patch?.review_patch?.scheduled_at ?? null,
      ),
    },
    stateSource: stateSourceParts.join(" "),
    signalCards: result.graph_state.signals.map(toSignalCard),
    decision: {
      title: MODE_LABELS[plan.selected_mode],
      reason: primaryReason,
      objective: plan.expected_outcome,
      confidence: diagnosis.confidence,
    },
    plan: {
      headline: plan.headline,
      summary: plan.summary,
      steps: plan.steps,
      highlightedModes: plan.steps.map((step) => step.mode),
      primaryMode: plan.selected_mode,
    },
    writeback: buildWritebackFromAgent(result.graph_state.state_patch),
    activity,
    activities,
    assistantMessage: buildAssistantMessageFromEvents(result),
    streamStatusLabel: null,
    rationale: result.graph_state.rationale,
  };
}

export function normalizeAgentStreamResult(input: {
  readonly events: ReadonlyArray<AgentStreamEvent>;
  readonly learnerState: AgentLearnerUnitState | null;
  readonly fallbackSnapshot: RuntimeSnapshot;
}): RuntimeSnapshot {
  const diagnosisEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "diagnosis" }> =>
      event.event === "diagnosis",
  );
  const planEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "plan" }> => event.event === "plan",
  );
  const activityEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "activity" }> =>
      event.event === "activity",
  );
  const activitiesEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "activities" }> =>
      event.event === "activities",
  );
  const statePatchEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "state-patch" }> =>
      event.event === "state-patch",
  );
  const streamStatusLabel = getLatestStreamStatusLabel(input.events);

  const diagnosis = diagnosisEvent?.diagnosis;
  const plan = planEvent?.plan;
  const learnerState = input.learnerState;

  if (diagnosis === undefined || plan === undefined || learnerState === null) {
    return input.fallbackSnapshot;
  }

  const learnerPatch = statePatchEvent?.state_patch.learner_state_patch;
  const primaryReason = diagnosis.explanation?.summary ?? diagnosis.reason;
  const stateSourceParts = [
    "来源：真实 `/runs/v0/stream` agent 结果。",
    PRIMARY_ISSUE_COPY[diagnosis.primary_issue],
    learnerState.based_on.length > 0 ? `判断依据：${learnerState.based_on.join(" / ")}` : null,
  ].filter((item): item is string => item !== null);

  const activities =
    activitiesEvent !== undefined
      ? normalizeAgentActivities(activitiesEvent.activities)
      : activityEvent !== undefined
        ? [normalizeAgentActivity(activityEvent.activity)]
        : [];
  const activity = activities[0] ?? null;

  return withActivities({
    source: "live-agent",
    state: {
      mastery: learnerState.mastery,
      understandingLevel: learnerState.understanding_level,
      memoryStrength: learnerState.memory_strength,
      confusion: learnerState.confusion_level,
      transferReadiness: learnerState.transfer_readiness,
      weakSignals: learnerState.weak_signals,
      recommendedAction: diagnosis.recommended_action,
      lastReviewedAt: formatDateLabel(learnerPatch?.last_reviewed_at ?? null),
      nextReviewAt: formatDateLabel(
        learnerPatch?.next_review_at ??
          statePatchEvent?.state_patch.review_patch?.scheduled_at ??
          null,
      ),
    },
    stateSource: stateSourceParts.join(" "),
    signalCards: buildSignalCardsFromStream(diagnosis, learnerState),
    decision: {
      title: MODE_LABELS[plan.selected_mode],
      reason: primaryReason,
      objective: plan.expected_outcome,
      confidence: diagnosis.confidence,
    },
    plan: {
      headline: plan.headline,
      summary: plan.summary,
      steps: plan.steps,
      highlightedModes: plan.steps.map((step) => step.mode),
      primaryMode: plan.selected_mode,
    },
    writeback: buildWritebackFromAgent(statePatchEvent?.state_patch ?? null),
    activity,
    activities,
    assistantMessage: buildAssistantMessageFromStreamEvents(input.events),
    streamStatusLabel,
    rationale: diagnosis.explanation?.evidence ?? [],
  });
}

export function normalizePartialAgentStreamResult(input: {
  readonly events: ReadonlyArray<AgentStreamEvent>;
  readonly fallbackSnapshot: RuntimeSnapshot;
}): RuntimeSnapshot {
  const diagnosisEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "diagnosis" }> =>
      event.event === "diagnosis",
  );
  const planEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "plan" }> => event.event === "plan",
  );
  const activityEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "activity" }> =>
      event.event === "activity",
  );
  const activitiesEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "activities" }> =>
      event.event === "activities",
  );
  const statePatchEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "state-patch" }> =>
      event.event === "state-patch",
  );
  const streamStatusLabel = getLatestStreamStatusLabel(input.events);

  const diagnosis = diagnosisEvent?.diagnosis;
  const plan = planEvent?.plan;
  const learnerPatch = statePatchEvent?.state_patch.learner_state_patch;
  const fallbackState = input.fallbackSnapshot.state;

  if (diagnosis === undefined && plan === undefined && statePatchEvent === undefined) {
    return {
      ...input.fallbackSnapshot,
      source: streamStatusLabel === null ? input.fallbackSnapshot.source : "live-agent",
      assistantMessage: buildAssistantMessageFromStreamEvents(input.events),
      streamStatusLabel,
    };
  }

  const activities =
    activitiesEvent !== undefined
      ? normalizeAgentActivities(activitiesEvent.activities)
      : activityEvent !== undefined
        ? [normalizeAgentActivity(activityEvent.activity)]
        : [];
  const activity = activities[0] ?? null;

  return withActivities({
    source: "live-agent",
    state: {
      mastery: learnerPatch?.mastery ?? fallbackState.mastery,
      understandingLevel: learnerPatch?.understanding_level ?? fallbackState.understandingLevel,
      memoryStrength: learnerPatch?.memory_strength ?? fallbackState.memoryStrength,
      confusion: learnerPatch?.confusion_level ?? fallbackState.confusion,
      transferReadiness: learnerPatch?.transfer_readiness ?? fallbackState.transferReadiness,
      weakSignals: learnerPatch?.weak_signals ?? fallbackState.weakSignals,
      recommendedAction:
        diagnosis?.recommended_action ??
        learnerPatch?.recommended_action ??
        fallbackState.recommendedAction,
      lastReviewedAt: formatDateLabel(
        learnerPatch?.last_reviewed_at ?? fallbackState.lastReviewedAt,
      ),
      nextReviewAt: formatDateLabel(
        learnerPatch?.next_review_at ??
          statePatchEvent?.state_patch.review_patch?.scheduled_at ??
          fallbackState.nextReviewAt,
      ),
    },
    stateSource:
      diagnosis !== undefined
        ? `来源：实时 /runs/v0/stream 事件。${PRIMARY_ISSUE_COPY[diagnosis.primary_issue]}`
        : "来源：实时 /runs/v0/stream 事件，持久化 learner state 尚未回读。",
    signalCards:
      diagnosis !== undefined
        ? [
            {
              id: "stream-primary-issue",
              label: "主要问题",
              observation: PRIMARY_ISSUE_COPY[diagnosis.primary_issue],
              implication: `${diagnosis.reason} 当前置信度 ${(diagnosis.confidence * 100).toFixed(0)}%。`,
            },
          ]
        : input.fallbackSnapshot.signalCards,
    decision: {
      title:
        plan !== undefined
          ? MODE_LABELS[plan.selected_mode]
          : diagnosis !== undefined
          ? MODE_LABELS[diagnosis.recommended_action === "clarify"
              ? "contrast-drill"
              : diagnosis.recommended_action === "teach"
              ? "guided-qa"
              : diagnosis.recommended_action === "review"
              ? "guided-qa"
              : diagnosis.recommended_action === "apply"
              ? "scenario-sim"
              : "socratic"]
          : input.fallbackSnapshot.decision.title,
      reason: diagnosis?.reason ?? input.fallbackSnapshot.decision.reason,
      objective: plan?.expected_outcome ?? input.fallbackSnapshot.decision.objective,
      confidence: diagnosis?.confidence ?? input.fallbackSnapshot.decision.confidence,
    },
    plan: {
      headline: plan?.headline ?? input.fallbackSnapshot.plan.headline,
      summary: plan?.summary ?? input.fallbackSnapshot.plan.summary,
      steps: plan?.steps ?? input.fallbackSnapshot.plan.steps,
      highlightedModes:
        plan?.steps.map((step) => step.mode) ?? input.fallbackSnapshot.plan.highlightedModes,
      primaryMode: plan?.selected_mode ?? input.fallbackSnapshot.plan.primaryMode,
    },
    writeback: buildWritebackFromAgent(statePatchEvent?.state_patch ?? null),
    activity,
    activities,
    assistantMessage: buildAssistantMessageFromStreamEvents(input.events),
    streamStatusLabel,
    rationale: diagnosis?.explanation?.evidence ?? input.fallbackSnapshot.rationale,
  });
}
