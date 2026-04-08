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

export interface LearningUnit {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly weaknessTags: ReadonlyArray<string>;
  readonly candidateModes: ReadonlyArray<LearningMode>;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface LearnerState {
  readonly mastery: number;
  readonly confusion: number;
  readonly preferredModes: ReadonlyArray<LearningMode>;
  readonly weakSignals: ReadonlyArray<string>;
}

export interface StudyPlanStep {
  readonly id: string;
  readonly title: string;
  readonly mode: LearningMode;
  readonly reason: string;
  readonly outcome: string;
}

export interface StudyPlan {
  readonly headline: string;
  readonly summary: string;
  readonly steps: ReadonlyArray<StudyPlanStep>;
}

