"""Canned planner outputs, so the pipeline can be tested without a model."""

import threading
from typing import TypeVar, cast

from pydantic import BaseModel

from app.agents.planner.schemas import (
    Analysis,
    Backlog,
    CompetitorDraft,
    Critique,
    EstimatePlan,
    FeatureDraft,
    FeatureHours,
    FlowStep,
    PhaseDraft,
    ProductSpec,
    RiskDraft,
    ScreenDraft,
    StackChoice,
    StackPlan,
    Ticket,
    UxPlan,
    WireBlock,
)

T = TypeVar("T", bound=BaseModel)

ANALYSIS = Analysis(
    title="PhysioFlow",
    one_liner="Booking and home exercises for independent physiotherapists.",
    problem="Physios juggle bookings and paper exercise sheets.",
    audience=["Independent physiotherapists", "Their patients"],
    goals=["Patients book in under a minute"],
    constraints=["Web and mobile"],
    assumptions=["Stripe for payments"],
)
PRODUCT = ProductSpec(
    features=[
        FeatureDraft(
            id="booking",
            name="Online booking",
            description="Patients book a session.",
            moscow="must",
            complexity="M",
            user_stories=["As a patient, I want to book online so that I skip phone calls"],
        ),
        FeatureDraft(
            id="exercises",
            name="Exercise library",
            description="Physios assign video exercises.",
            moscow="should",
            complexity="L",
            user_stories=[],
        ),
        FeatureDraft(
            id="chat",
            name="In-app chat",
            description="Patients message their physio.",
            moscow="wont",
            complexity="L",
            user_stories=[],
        ),
    ],
    implementation_decisions=["Sessions are 30 or 60 minutes"],
    testing_decisions=["Double bookings are impossible"],
    out_of_scope=["Insurance claims"],
)
STACK = StackPlan(
    stack=[
        StackChoice(layer="Frontend", choice="Next.js", why="Fast to build.", alternative="Remix")
    ]
)
UX = UxPlan(
    screens=[
        ScreenDraft(
            id="home",
            name="Home",
            purpose="See upcoming sessions.",
            wireframe=[WireBlock(kind="nav", span=4, label="Menu")],
        ),
        ScreenDraft(
            id="book",
            name="Book",
            purpose="Pick a time.",
            wireframe=[WireBlock.model_construct(kind="button", span=9, label="Book")],  # clamped
        ),
    ],
    flow=[FlowStep(from_screen="home", to_screen="book", action="Book a session")],
)
ESTIMATE = EstimatePlan(
    features=[FeatureHours(id="booking", hours=50)],  # exercises falls back to the L default
    phases=[
        PhaseDraft(name="Foundation", weeks=2, deliverables=["Sign-in"]),
        PhaseDraft(name="Core", weeks=6, deliverables=["Booking"]),
    ],
    team=["1 full-stack engineer"],
)
BACKLOG = Backlog(
    tickets=[
        Ticket(
            id="T1",
            title="Book a session",
            feature_id="booking",
            description="Pick a slot and confirm.",
            acceptance=["Slot is reserved", "Email is sent"],
            blocked_by=[],
        ),
        Ticket(
            id="T2",
            title="Assign an exercise",
            feature_id="exercises",
            description="Physio picks a video.",
            acceptance=["Patient sees it"],
            blocked_by=["T1"],
        ),
    ]
)
CRITIQUE = Critique(
    readiness=72,
    readiness_notes=["Clear users"],
    risks=[RiskDraft(title="Health data rules", impact="high", mitigation="Use EU hosting.")],
    competitors=[CompetitorDraft(name="Physitrack", note="Exercises only, no booking.")],
)

BY_SCHEMA: dict[type[BaseModel], BaseModel] = {
    Analysis: ANALYSIS,
    ProductSpec: PRODUCT,
    StackPlan: STACK,
    UxPlan: UX,
    EstimatePlan: ESTIMATE,
    Backlog: BACKLOG,
    Critique: CRITIQUE,
}


class FakePlanner:
    """Returns the canned output for whichever schema an agent asks for. Thread-safe."""

    def __init__(self, fail_agent: str | None = None) -> None:
        self.agents: list[str] = []
        self.fail_agent = fail_agent
        self._lock = threading.Lock()

    def __call__(self, agent: str, schema: type[T], *, system: str, user: str) -> T:
        with self._lock:
            self.agents.append(agent)
        if agent == self.fail_agent:
            raise TimeoutError("model too slow")
        return cast(T, BY_SCHEMA[schema])
