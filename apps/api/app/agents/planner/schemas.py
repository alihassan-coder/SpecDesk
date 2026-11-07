"""What each planning agent returns. Field descriptions are part of the prompt — keep them clear.

The assembled plan (see `assemble.py`) is camelCase JSON matching `apps/web/src/mocks/types.ts`.
"""

from typing import Literal

from pydantic import BaseModel, Field

Complexity = Literal["S", "M", "L", "XL"]
Moscow = Literal["must", "should", "could", "wont"]
Impact = Literal["low", "medium", "high"]
WireKind = Literal[
    "nav", "header", "text", "input", "button", "card", "list", "image", "chart", "tabs"
]


# ---------- analyst ----------


class Analysis(BaseModel):
    title: str = Field(description="A short product name or working title, 2-5 words")
    one_liner: str = Field(description="What it is and for whom, one sentence")
    problem: str = Field(description="The problem it solves, 2-3 plain sentences")
    audience: list[str] = Field(description="2-5 user groups, a few words each")
    goals: list[str] = Field(description="2-5 measurable goals for the first version")
    constraints: list[str] = Field(description="Hard limits: platforms, rules, budget, deadlines")
    assumptions: list[str] = Field(description="Things you assumed because nobody said otherwise")


# ---------- product (to-spec) ----------


class FeatureDraft(BaseModel):
    id: str = Field(description="Short snake_case id, unique, e.g. 'online_booking'")
    name: str = Field(description="Feature name, 2-5 words")
    description: str = Field(description="What it does for the user, one sentence")
    moscow: Moscow = Field(description="must = MVP can't ship without it; wont = later version")
    complexity: Complexity = Field(
        description="S ≈ 1-3 days, M ≈ 1 week, L ≈ 2 weeks, XL ≈ 1 month or more"
    )
    user_stories: list[str] = Field(description="'As a <user>, I want <goal> so that <reason>'")


class ProductSpec(BaseModel):
    features: list[FeatureDraft] = Field(description="6-16 features covering the whole product")
    implementation_decisions: list[str] = Field(
        description="Decisions an engineer needs: data that must be stored, integrations, rules"
    )
    testing_decisions: list[str] = Field(description="What must be tested and how, briefly")
    out_of_scope: list[str] = Field(description="What this plan deliberately leaves out")


# ---------- ux ----------


class WireBlock(BaseModel):
    kind: WireKind
    span: int = Field(ge=1, le=4, description="Width on a 4-column grid")
    label: str = Field(description="1-4 words shown inside the box")


class ScreenDraft(BaseModel):
    id: str = Field(description="Short snake_case id, unique")
    name: str = Field(description="Screen name, 1-4 words")
    purpose: str = Field(description="What the user does here, one sentence")
    wireframe: list[WireBlock] = Field(description="4-9 blocks, top to bottom")


class FlowStep(BaseModel):
    from_screen: str = Field(description="Screen id the user starts on")
    to_screen: str = Field(description="Screen id the user ends on")
    action: str = Field(description="What they do, 1-4 words")


class UxPlan(BaseModel):
    screens: list[ScreenDraft] = Field(description="The 4-10 main screens")
    flow: list[FlowStep] = Field(description="The main user journey between screens")


# ---------- architect ----------


class StackChoice(BaseModel):
    layer: str = Field(description="e.g. Frontend, Backend, Database, Auth, Hosting, Payments")
    choice: str = Field(description="The technology picked")
    why: str = Field(description="Why, in plain English a founder understands, one sentence")
    alternative: str = Field(description="The main alternative considered and why not, short")


class StackPlan(BaseModel):
    stack: list[StackChoice] = Field(description="5-9 layers")


# ---------- estimator ----------


class FeatureHours(BaseModel):
    id: str = Field(description="Feature id from the list")
    hours: int = Field(ge=4, le=400, description="Engineering hours including tests")


class PhaseDraft(BaseModel):
    name: str
    weeks: int = Field(ge=1, le=26)
    deliverables: list[str] = Field(description="2-5 short items")


class EstimatePlan(BaseModel):
    features: list[FeatureHours]
    phases: list[PhaseDraft] = Field(description="3-5 delivery phases in order")
    team: list[str] = Field(description="Roles needed, e.g. '1 full-stack engineer'")


# ---------- backlog (to-tickets) ----------


class Ticket(BaseModel):
    id: str = Field(description="T1, T2, … in build order")
    title: str = Field(description="A thin end-to-end slice, imperative, e.g. 'Book a session'")
    feature_id: str = Field(description="The feature id it delivers")
    description: str = Field(description="What gets built across UI, API and data, 1-2 sentences")
    acceptance: list[str] = Field(description="2-4 checkable acceptance criteria")
    blocked_by: list[str] = Field(description="Ticket ids that must be done first; [] if none")


class Backlog(BaseModel):
    tickets: list[Ticket] = Field(description="8-25 tickets covering the must and should features")


# ---------- critic ----------


class RiskDraft(BaseModel):
    title: str
    impact: Impact
    mitigation: str = Field(description="What to do about it, one sentence")


class CompetitorDraft(BaseModel):
    name: str = Field(description="A real, existing product")
    note: str = Field(description="How it compares, one sentence")


class Critique(BaseModel):
    readiness: int = Field(ge=0, le=100, description="How ready the idea is to build, 0-100")
    readiness_notes: list[str] = Field(description="2-4 reasons for the score")
    risks: list[RiskDraft] = Field(description="3-6 real risks, biggest first")
    competitors: list[CompetitorDraft] = Field(
        description="2-5 well-known existing products in this space; [] if you are not sure"
    )
