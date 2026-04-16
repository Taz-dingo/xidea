export type LearningMode =
  | "socratic"
  | "guided-qa"
  | "contrast-drill"
  | "image-recall"
  | "audio-recall"
  | "scenario-sim";

export interface SourceAsset {
  readonly id: string;
  readonly title: string;
  readonly kind: "pdf" | "web" | "note" | "audio" | "video" | "image";
  readonly topic: string;
}

export interface ProjectContext {
  readonly name: string;
  readonly goal: string;
  readonly currentThread: string;
  readonly successSignal: string;
  readonly orchestrationWhy: string;
}

export interface LearningUnit {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly weaknessTags: ReadonlyArray<string>;
  readonly candidateModes: ReadonlyArray<LearningMode>;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface DiagnosisSignal {
  readonly id: string;
  readonly label: string;
  readonly observation: string;
  readonly implication: string;
}

export interface LearnerState {
  readonly mastery: number;
  readonly understandingLevel: number;
  readonly memoryStrength: number;
  readonly confusion: number;
  readonly preferredModes: ReadonlyArray<LearningMode>;
  readonly weakSignals: ReadonlyArray<string>;
  readonly lastReviewedAt: string | null;
  readonly nextReviewAt: string | null;
  readonly recommendedAction:
    | "teach"
    | "clarify"
    | "practice"
    | "review"
    | "apply";
}

export interface LearnerProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly stateSource: string;
  readonly diagnosisSignals: ReadonlyArray<DiagnosisSignal>;
  readonly state: LearnerState;
}

export interface StudyPlanStep {
  readonly id: string;
  readonly title: string;
  readonly mode: LearningMode;
  readonly reason: string;
  readonly outcome: string;
}

export interface StudyPlanDecision {
  readonly title: string;
  readonly reason: string;
  readonly objective: string;
}

export interface WritebackPreview {
  readonly id: string;
  readonly target: string;
  readonly change: string;
}

export interface StudyPlan {
  readonly headline: string;
  readonly summary: string;
  readonly decision: StudyPlanDecision;
  readonly steps: ReadonlyArray<StudyPlanStep>;
  readonly writeback: ReadonlyArray<WritebackPreview>;
}

export type LearningActivityKind = "quiz" | "recall" | "coach-followup";

export interface LearningActivityChoice {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
}

export type LearningActivityInput =
  | {
      readonly type: "choice";
      readonly choices: ReadonlyArray<LearningActivityChoice>;
    }
  | {
      readonly type: "text";
      readonly placeholder: string;
      readonly minLength: number;
    };

export interface LearningActivity {
  readonly id: string;
  readonly kind: LearningActivityKind;
  readonly title: string;
  readonly objective: string;
  readonly prompt: string;
  readonly support: string;
  readonly mode: LearningMode | null;
  readonly evidence: ReadonlyArray<string>;
  readonly submitLabel: string;
  readonly input: LearningActivityInput;
}

export interface LearningActivitySubmission {
  readonly activityId: string;
  readonly kind: LearningActivityKind;
  readonly responseText: string;
  readonly selectedChoiceId: string | null;
}
