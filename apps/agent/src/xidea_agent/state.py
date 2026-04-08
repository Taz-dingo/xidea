from pydantic import BaseModel, Field


class LearnerState(BaseModel):
    understanding_level: int = Field(ge=0, le=100)
    memory_strength: int = Field(ge=0, le=100)
    confusion: int = Field(ge=0, le=100)
    recommended_action: str


class LearningContext(BaseModel):
    entry_mode: str
    topic: str
    learner_state: LearnerState


class GraphState(BaseModel):
    context: LearningContext
    selected_path: list[str] = Field(default_factory=list)
    rationale: list[str] = Field(default_factory=list)

