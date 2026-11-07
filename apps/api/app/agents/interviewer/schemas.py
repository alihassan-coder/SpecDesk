"""Shapes for the interview. JSON uses camelCase to match `apps/web/src/mocks/types.ts`."""

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Option(CamelModel):
    id: str = Field(
        description="Short snake_case id, unique within the question, e.g. 'mobile_web'"
    )
    label: str = Field(description="What the founder clicks, 2-6 words")
    hint: str | None = Field(default=None, description="Optional consequence, e.g. 'Adds 3 weeks'")


class Question(CamelModel):
    id: str = Field(description="Short snake_case id for the decision, e.g. 'payments'")
    title: str = Field(description="The question, one short sentence")
    body: str = Field(description="One or two sentences on why it matters for the plan")
    options: list[Option] = Field(min_length=2, max_length=5)
    recommended: str = Field(description="The id of the option you recommend")
    multi: bool = False

    @model_validator(mode="after")
    def _recommendation_is_an_option(self) -> "Question":
        ids = [o.id for o in self.options]
        if len(set(ids)) != len(ids):
            raise ValueError("Option ids must be unique")
        if self.recommended not in ids:
            # Models occasionally name the label instead of the id; fall back to the first option.
            match = next((o.id for o in self.options if o.label == self.recommended), ids[0])
            self.recommended = match
        return self


class QuestionRound(CamelModel):
    round: int = Field(ge=1)
    questions: list[Question] = Field(min_length=1)


class InterviewerTurn(BaseModel):
    """What the interviewer model returns each turn."""

    ready: bool = Field(description="True when nothing important is left as a guess")
    why: str = Field(
        description="One sentence for the founder: what you're trying to settle, or why you're done"
    )
    questions: list[Question] = Field(
        default=[], description="This round's questions; empty when ready"
    )
    brief: str = Field(
        default="",
        description="When ready: the settled decisions as a short brief for the planners",
    )


class Answer(CamelModel):
    option_id: str | None = None
    text: str | None = None
    skipped: bool = False


Answers = dict[str, Answer]
