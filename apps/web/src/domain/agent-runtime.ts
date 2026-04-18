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

function buildActivityChoiceSet(mode: LearningMode): LearningActivity["input"] {
  if (mode === "contrast-drill") {
    return {
      type: "choice",
      choices: [
        buildChoice({
          id: "trace-boundary",
          label: "先区分最容易混淆的两个判断对象分别解决什么问题。",
          detail: "先把边界拉开，再决定下一步该补哪条证据或材料。",
          isCorrect: true,
          feedbackLayers: [
            "对，先把两个判断对象拉开，才能知道后面该补哪条证据。",
            "你抓到核心了：这轮不是继续堆信息，而是先确认它们分别控制什么风险。",
          ],
          analysis: "这条回答先处理边界，再决定补证据方向，最符合系统要验证的判断能力。",
        }),
        buildChoice({
          id: "increase-context",
          label: "先继续堆更多信息进去，看看能不能覆盖掉当前问题。",
          detail: "这是常见直觉，但会跳过问题定位，容易继续放大噪音。",
          isCorrect: false,
          feedbackLayers: [
            "先别急着加信息。现在缺的不是覆盖率，而是问题定位。",
            "如果还没区分清楚两个判断对象分别解决什么问题，信息越多只会把噪音一起放大。",
            "真正要先回答的是：当前缺口到底出在召回、判断边界，还是别的环节；没定位前继续加料通常无效。",
          ],
          analysis: "这条选择把问题误判成信息不够，而不是边界没拉开，容易越补越乱。",
        }),
        buildChoice({
          id: "skip-diagnosis",
          label: "先给一个模糊结论，暂时不解释为什么这样判断。",
          detail: "会把真正的边界缺口藏起来，不利于后续继续编排。",
          isCorrect: false,
          feedbackLayers: [
            "这会跳过最关键的判断依据，系统没法知道你到底卡在哪。",
            "如果只给结论、不解释为什么，真正混淆的是概念边界还是证据选择就会被藏起来。",
            "这轮的目标不是拿到一个表面答案，而是暴露你判断时最容易混淆的那一步；省略依据会直接损失这层信息。",
          ],
          analysis: "这条选择回避了判断依据，系统拿不到可用于继续编排的真实缺口。",
        }),
      ],
    };
  }

  if (mode === "scenario-sim") {
    return {
      type: "choice",
      choices: [
        buildChoice({
          id: "explain-judgment-chain",
          label: "先说明关键步骤分别控制什么风险，再解释为什么不能偷简化。",
          detail: "把判断链路拆开，评审或同事才能听见真实取舍。",
          isCorrect: true,
          feedbackLayers: [
            "对，项目解释最重要的是把判断链路和风险控制说出来。",
            "这条回答能证明你不是在背结论，而是真的知道每一步为什么存在。",
          ],
          analysis: "这条选择把方案拆回判断链路，最能验证是否具备项目迁移能力。",
        }),
        buildChoice({
          id: "stack-more-context",
          label: "重点强调信息越多越安全，先把更多内容塞进去再说。",
          detail: "这会把噪声问题伪装成覆盖率问题，解释链路不完整。",
          isCorrect: false,
          feedbackLayers: [
            "光强调“多放信息更安全”不够，因为它没有解释每一步为什么存在。",
            "评审真正会追问的是：哪些步骤在控制 hallucination、召回偏差或上下文漂移，而不是信息是不是越多越好。",
            "如果不拆出关键判断链路，这个回答会把系统设计问题伪装成“多塞内容就行”的覆盖率问题，解释力很弱。",
          ],
          analysis: "这条选择把重点放在堆信息，而不是解释关键判断链路，难以支撑项目场景里的说服力。",
        }),
        buildChoice({
          id: "focus-model-only",
          label: "先把问题归因成模型或工具不够强，暂时不解释判断链路。",
          detail: "会跳过系统设计层的判断标准，难以说服评审。",
          isCorrect: false,
          feedbackLayers: [
            "这会把责任全推给模型强弱，但没有回答系统为什么要这样设计。",
            "项目讨论里，别人更想知道的是：哪些步骤是为了降低风险、提高稳定性，而不是一句“模型还不够强”。",
            "如果不解释判断链路，模型能力再强也只是黑盒结论；你仍然没说明为什么当前方案需要这些结构。",
          ],
          analysis: "这条选择跳过了系统设计层的判断标准，把结构问题错误归因成模型能力问题。",
        }),
      ],
    };
  }

  if (mode === "guided-qa" || mode === "socratic") {
    return {
      type: "choice",
      choices: [
        buildChoice({
          id: "explain-boundary",
          label: "先用一句话讲清楚核心边界，再补原因。",
          detail: "先给判断标准，再展开解释，更容易看出是否真的理解。",
          isCorrect: true,
          feedbackLayers: [
            "对，先把边界说清楚，后面的解释才有落点。",
            "这能最快暴露你是否真正理解，而不是只会复述定义。",
          ],
          analysis: "这条回答先给判断标准，再展开原因，最容易验证理解是否稳定。",
        }),
        buildChoice({
          id: "repeat-definition",
          label: "先复述概念定义，后面再看要不要区分边界。",
          detail: "只复述定义容易掩盖真正的判断缺口。",
          isCorrect: false,
          feedbackLayers: [
            "先别回到定义。现在更重要的是把边界拉开。",
            "只复述定义常常会让人看起来像懂了，但一到判断题还是分不清。",
            "这轮要验证的是“你能不能用判断标准区分相近概念”，不是“你记不记得教材式表述”。如果只停在定义，真实缺口会被盖住。",
          ],
          analysis: "这条选择把任务退回成复述定义，绕开了真正要验证的边界判断能力。",
        }),
        buildChoice({
          id: "jump-to-solution",
          label: "先直接给方案结论，暂时不解释为什么这样判断。",
          detail: "会跳过理解验证，系统拿不到可靠的学习依据。",
          isCorrect: false,
          feedbackLayers: [
            "先给结论还不够，因为系统要看到你的判断过程。",
            "如果不解释为什么这样判断，后面就无法区分你是真的理解，还是碰巧押中了答案。",
            "这轮的价值在于让系统拿到稳定的学习依据：你区分了什么、靠什么区分。如果直接跳到结论，这层证据会消失。",
          ],
          analysis: "这条选择省掉了判断过程，系统无法据此确认理解是否真实稳固。",
        }),
      ],
    };
  }

  if (mode === "image-recall" || mode === "audio-recall") {
    return {
      type: "choice",
      choices: [
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
      ],
    };
  }

  return {
    type: "choice",
    choices: [
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
    ],
  };
}

function buildActivityTitle(mode: LearningMode, action: AgentAction): string {
  if (mode === "contrast-drill") {
    return "先做一个边界辨析";
  }

  if (mode === "scenario-sim" || action === "apply") {
    return "先做一轮项目情境作答";
  }

  if (action === "review" || mode === "image-recall" || mode === "audio-recall") {
    return "先做一次主动回忆";
  }

  return "先接住导师追问";
}

function buildActivityPrompt(input: {
  readonly action: AgentAction;
  readonly mode: LearningMode;
  readonly unitTitle: string;
}): string {
  if (input.mode === "contrast-drill") {
    return `围绕「${input.unitTitle}」，先说出这轮最容易混淆的两个判断对象分别解决什么问题，再补一句你会先看哪条证据来区分它们。`;
  }

  if (input.mode === "scenario-sim" || input.action === "apply") {
    return `假设你正在向同事或评审解释「${input.unitTitle}」，请用 3 到 5 句说明这条方案的关键取舍，以及为什么不能偷简化成一个看起来更省事的做法。`;
  }

  if (input.action === "review" || input.mode === "image-recall" || input.mode === "audio-recall") {
    return `不要看材料，回忆一下「${input.unitTitle}」里你最该记住的判断标准：先用一句话说核心边界，再补一句为什么。`;
  }

  return `先用你自己的话解释「${input.unitTitle}」里当前最关键的判断：它到底解决什么问题，最容易和什么混淆？`;
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
        ? buildActivityTitle(mode, input.action)
        : `第 ${input.order + 1} 步：${input.stepTitle}`,
    objective: input.objective,
    prompt: buildActivityPrompt({
      action: input.action,
      mode,
      unitTitle: input.unit.title,
    }),
    support: input.reason,
    mode,
    evidence: input.evidence.slice(0, 3),
    submitLabel:
      kind === "quiz" ? "提交判断" : kind === "recall" ? "提交回忆" : "提交作答",
    input: buildActivityChoiceSet(mode),
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
