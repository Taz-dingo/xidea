import { learnerProfiles, learningUnits } from "./demo";
import { buildMockRuntimeSnapshot, type RuntimeSnapshot } from "../domain/agent-runtime";
import type { LearningActivity } from "../domain/types";

export interface TutorFixtureMessage {
  readonly role: "assistant" | "user";
  readonly content: string;
}

export interface TutorFixtureScenario {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly snapshot: RuntimeSnapshot;
  readonly messages: ReadonlyArray<TutorFixtureMessage>;
  readonly submitReply: string;
  readonly skipReply: string;
  readonly submitErrorMessage: string | null;
}

function toLiveSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  return {
    ...snapshot,
    source: "live-agent",
    stateSource: `Fixture: ${snapshot.stateSource}`,
  };
}

function buildCustomActivity(input: {
  readonly id: string;
  readonly kind: LearningActivity["kind"];
  readonly title: string;
  readonly objective: string;
  readonly prompt: string;
  readonly support: string;
  readonly mode: LearningActivity["mode"];
  readonly evidence: ReadonlyArray<string>;
  readonly submitLabel: string;
  readonly input: LearningActivity["input"];
}): LearningActivity {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    objective: input.objective,
    prompt: input.prompt,
    support: input.support,
    mode: input.mode,
    evidence: input.evidence,
    submitLabel: input.submitLabel,
    input: input.input,
  };
}

const clarifyProfile = learnerProfiles[1] ?? learnerProfiles[0] ?? learnerProfiles[2];
const recallProfile = learnerProfiles[0] ?? learnerProfiles[1] ?? learnerProfiles[2];
const coachProfile = learnerProfiles[2] ?? learnerProfiles[0] ?? learnerProfiles[1];
const clarifyUnit = learningUnits[0];
const recallUnit = learningUnits[1] ?? learningUnits[0];
const coachUnit = learningUnits[2] ?? learningUnits[0];

if (
  clarifyProfile === undefined ||
  recallProfile === undefined ||
  coachProfile === undefined ||
  clarifyUnit === undefined ||
  recallUnit === undefined ||
  coachUnit === undefined
) {
  throw new Error("Tutor fixtures require demo learner profiles and learning units.");
}

const clarifyBase = toLiveSnapshot(
  buildMockRuntimeSnapshot(clarifyProfile, clarifyUnit),
);

const recallBase = toLiveSnapshot(
  buildMockRuntimeSnapshot(recallProfile, recallUnit),
);

const coachBase = toLiveSnapshot(
  buildMockRuntimeSnapshot(coachProfile, coachUnit),
);

export const tutorFixtureScenarios: ReadonlyArray<TutorFixtureScenario> = [
  {
    id: "clarify-quiz",
    label: "边界辨析",
    description: "测试选择题卡、锁输入和提交后的回合完成态。",
    snapshot: clarifyBase,
    messages: [
      {
        role: "assistant",
        content:
          "你现在不是完全不懂，而是把“召回问题”和“上下文构造问题”揉在一起了。先别继续泛讲，我们先做一个边界辨析。",
      },
    ],
    submitReply:
      "这次判断已经够用了。下一轮我会基于你选的失真环节继续追问，而不是再给一整段标准答案。",
    skipReply:
      "我先记下你跳过了这轮辨析，接下来会收成更轻的一步，但仍然围绕概念边界继续推进。",
    submitErrorMessage: null,
  },
  {
    id: "recall-text",
    label: "主动回忆",
    description: "测试文本回忆卡、长输入和提交后的恢复。",
    snapshot: (() => {
      const activity = buildCustomActivity({
        id: "fixture-recall",
        kind: "recall",
        title: "先做一次主动回忆",
        objective: "确认你还能不看材料说出判断标准。",
        prompt:
          "不要看材料，回忆一下：什么时候应该先怀疑是记忆走弱，什么时候更像是概念边界没拉开？",
        support: "这轮更需要验证可回忆性，而不是继续增加解释量。",
        mode: "guided-qa",
        evidence: ["最近两轮都能复述流程，但一脱离材料就开始混淆判断标准。"],
        submitLabel: "提交回忆",
        input: {
          type: "text",
          placeholder: "先写下你回忆出的判断标准，再看系统怎么追问。",
          minLength: 24,
        },
      });

      return {
        ...recallBase,
        decision: {
          ...recallBase.decision,
          title: "主动回忆",
          reason: "当前更需要先把关键判断标准从记忆里拉回可用状态。",
          objective: "确认用户能不看材料回忆出判断标准。",
        },
        activity,
        activities: [activity],
        assistantMessage:
          "这轮先别看资料。你更需要先证明这些判断标准还在脑子里，而不是继续堆解释。",
      };
    })(),
    messages: [
      {
        role: "assistant",
        content:
          "你最近的问题不像是完全没懂，更像是关键判断标准不够稳。先做一次主动回忆，我再决定要不要补讲。",
      },
    ],
    submitReply:
      "这次回忆足够让我判断下一步了。我会根据你漏掉的部分决定是继续追问，还是回到短讲解。",
    skipReply:
      "先跳过也可以，但我会把这轮记成“记忆稳定性未验证”，后面仍会找机会把这块补回来。",
    submitErrorMessage: null,
  },
  {
    id: "coach-followup",
    label: "导师追问",
    description: "测试追问卡、跳过动作和卡片完成后的解锁。",
    snapshot: (() => {
      const activity = buildCustomActivity({
        id: "fixture-followup",
        kind: "coach-followup",
        title: "先接住导师追问",
        objective: "验证你能否把设计取舍讲成评审能听懂的版本。",
        prompt:
          "如果评审追问“为什么不能直接把检索结果拼给模型”，你会先用哪一个判断标准开头？",
        support: "你已经有基础理解了，这轮更关键的是先把表达迁移到真实答辩语境里。",
        mode: "scenario-sim",
        evidence: ["你能说出模块名，但答辩时容易回到泛泛描述。"],
        submitLabel: "提交作答",
        input: {
          type: "text",
          placeholder: "把你会在评审里先说的那一句写出来。",
          minLength: 18,
        },
      });

      return {
        ...coachBase,
        activity,
        activities: [activity],
        assistantMessage:
          "这轮先别继续讲模块定义。你更需要先接住一个真实评审追问，看表达能不能立住。",
      };
    })(),
    messages: [
      {
        role: "assistant",
        content:
          "你已经不是不会了，而是要把会的东西讲稳。先接住一个真实评审追问，我们再看要不要补哪一层。",
      },
    ],
    submitReply:
      "这句开头已经让我看见你的答辩思路了。下一轮我会继续追问你是不是能把“召回、重排、上下文构造”讲成一条完整因果链。",
    skipReply:
      "我先把这轮情境追问记成跳过。接下来可以先换轻一点的动作，但我不会直接把答辩表达问题放掉。",
    submitErrorMessage: null,
  },
  {
    id: "submit-error",
    label: "提交报错",
    description: "测试提交失败时卡片是否恢复可操作。",
    snapshot: clarifyBase,
    messages: [
      {
        role: "assistant",
        content:
          "这一轮主要是验证失败态。你可以提交一次，看看卡片和输入区会不会正确回滚。",
      },
    ],
    submitReply: "",
    skipReply:
      "跳过动作在这个 fixture 里会正常生效，用来对比提交失败和跳过成功的差别。",
    submitErrorMessage: "Mock fixture：本轮提交被故意标记为失败，用来检查交互回滚。",
  },
  {
    id: "stacked-drills",
    label: "多张卡组",
    description: "测试多张学习卡叠放、翻卡顺序和锁输入状态。",
    snapshot: (() => {
      const first = buildCustomActivity({
        id: "fixture-stack-1",
        kind: "quiz",
        title: "先辨一下问题卡在哪一层",
        objective: "先确认你是不是把召回和上下文构造混在一起了。",
        prompt: "如果检索结果本身是准的，但回答还是漂，第一怀疑点更应该落在哪？",
        support: "先把最上层判断点说清，再往下拆具体误差来源。",
        mode: "guided-qa",
        evidence: ["最近几轮你总是把“召回”和“提示词拼接”一起归因。"],
        submitLabel: "提交选择",
        input: {
          type: "choice",
          choices: [
            {
              id: "stack-1-a",
              label: "先看上下文构造是不是把检索结果组织坏了",
              detail: "先区分检索命中和回答组织是否错位。",
              isCorrect: true,
              feedbackLayers: [
                "对，检索命中了但回答仍然漂，先看组织层更合理。",
              ],
              analysis: "这条选择先检查检索后的组织层，最符合这张卡的判断目标。",
            },
            {
              id: "stack-1-b",
              label: "先假设 embedding 一定失效了",
              detail: "这会跳过更直接的组织层排查。",
              isCorrect: false,
              feedbackLayers: [
                "先别急着归因到 embedding，本题给的前提是检索结果本身已经比较准。",
                "如果检索结果本身准，但回答还是漂，优先怀疑的是组织层，而不是先把问题推回 embedding。",
              ],
              analysis: "这条选择忽略了“检索结果本身是准的”这个前提，归因方向偏了。",
            },
            {
              id: "stack-1-c",
              label: "先去改 temperature",
              detail: "这会跳过当前更关键的系统层判断。",
              isCorrect: false,
              feedbackLayers: [
                "temperature 更像生成层调参，不是这张卡最先要看的判断点。",
                "这题要先分清是检索后的组织层出问题，还是更上游的检索层出问题；直接改 temperature 太晚了。",
              ],
              analysis: "这条选择把问题过早推到生成参数，没有先完成系统层的定位。",
            },
          ],
        },
      });
      const second = buildCustomActivity({
        id: "fixture-stack-2",
        kind: "recall",
        title: "再回忆一下判断标准",
        objective: "确认你能脱离材料复述这条判断顺序。",
        prompt: "不用看材料，写一句你会怎么区分“检索错了”和“组织错了”。",
        support: "这一张用来检查你是否只是选对了，而不是真的记住了判断顺序。",
        mode: "guided-qa",
        evidence: ["你最近能做对选择题，但转成口述时容易卡住。"],
        submitLabel: "提交回忆",
        input: {
          type: "text",
          placeholder: "先用自己的话写一句判断顺序。",
          minLength: 18,
        },
      });
      const third = buildCustomActivity({
        id: "fixture-stack-3",
        kind: "coach-followup",
        title: "最后接一个答辩追问",
        objective: "把理解迁移成能对评审说出口的话。",
        prompt: "如果评审继续问“为什么你先怀疑组织层”，你会怎么补一句？",
        support: "最后一张不再测概念，而是测你能不能把判断讲清楚。",
        mode: "scenario-sim",
        evidence: ["你能复述概念，但答辩时第一句话还不够稳。"],
        submitLabel: "提交作答",
        input: {
          type: "text",
          placeholder: "写下你会接给评审的下一句。",
          minLength: 16,
        },
      });

      return {
        ...clarifyBase,
        decision: {
          ...clarifyBase.decision,
          title: "连续三步小卡组",
          reason: "这轮不需要一口气解释完，更适合先辨析、再回忆、再迁移表达。",
          objective: "用三张轻卡连续确认边界、记忆和表达。",
        },
        activity: first,
        activities: [first, second, third],
        assistantMessage: "这轮我不只给一张卡。我们先从最上面这一张开始，做完再往下翻。",
      };
    })(),
    messages: [
      {
        role: "assistant",
        content: "你这轮更像需要一组连续小动作，而不是一次讲完。我先给你三张轻卡，按顺序推进。",
      },
    ],
    submitReply: "这一张已经够了，我们继续翻下一张，不急着一次性讲透全部。",
    skipReply: "我先记下你跳过了这一张，后面的卡组仍会保留，但会把这一层标成未验证。",
    submitErrorMessage: null,
  },
  {
    id: "no-activity",
    label: "只有回复",
    description: "测试没有学习动作卡时，普通对话和 markdown 展示是否正常。",
    snapshot: {
      ...coachBase,
      activity: null,
      activities: [],
      assistantMessage:
        "这轮先不给学习动作。\n\n- 你已经有基本框架\n- 当前更需要先看系统怎么展示纯 markdown 回复\n- 然后再决定要不要补卡片",
    },
    messages: [
      {
        role: "assistant",
        content:
          "这轮先不给卡片，专门用来检查纯 markdown 回复的节奏。\n\n## 当前判断\n- 先看信息流密度\n- 再决定要不要把动作插回来",
      },
    ],
    submitReply: "",
    skipReply: "",
    submitErrorMessage: null,
  },
] as const;

export function getTutorFixtureScenario(
  fixtureId: string | null,
): TutorFixtureScenario | null {
  if (fixtureId === null) {
    return null;
  }

  return tutorFixtureScenarios.find((fixture) => fixture.id === fixtureId) ?? null;
}
