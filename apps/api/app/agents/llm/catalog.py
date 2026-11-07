"""Which models SpecDesk may use, and which one each agent gets.

Admins edit this in Admin → AI models; it is stored as JSON in `app_config` under
`CATALOG_CONFIG_KEY`. The code only ships defaults. Model ids use LangChain's
`"<provider>:<model>"` form, the same string `init_chat_model` understands.
"""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.agents.llm.usage import ModelPrice
from app.core.errors import AppError
from app.db.models import AppConfig

CATALOG_CONFIG_KEY = "model_catalog"

Effort = Literal["low", "medium", "high", "xhigh", "max"]


class Capabilities(BaseModel):
    structured_output: bool = True
    thinking: bool = False
    web_search: bool = False


class ModelEntry(BaseModel):
    id: str = Field(
        pattern=r"^[a-z0-9_-]+:.+$",
        description='"provider:model", e.g. "anthropic:claude-opus-5-5"',
    )
    label: str
    enabled: bool = True
    price: ModelPrice
    capabilities: Capabilities = Capabilities()

    @property
    def provider(self) -> str:
        return self.id.split(":", 1)[0]

    @property
    def name(self) -> str:
        return self.id.split(":", 1)[1]


class ModelCatalog(BaseModel):
    models: list[ModelEntry]
    default_model: str
    fallback_models: list[str] = []
    agent_models: dict[str, str] = {}
    agent_effort: dict[str, Effort] = {}
    disabled_providers: list[str] = []

    @model_validator(mode="after")
    def _references_exist(self) -> "ModelCatalog":
        known = {m.id for m in self.models}
        referenced = [self.default_model, *self.fallback_models, *self.agent_models.values()]
        missing = sorted({ref for ref in referenced if ref not in known})
        if missing:
            raise ValueError(f"Catalog refers to unknown models: {', '.join(missing)}")
        return self

    def get(self, model_id: str) -> ModelEntry | None:
        return next((m for m in self.models if m.id == model_id), None)

    def is_usable(self, entry: ModelEntry) -> bool:
        return entry.enabled and entry.provider not in self.disabled_providers

    def chain_for(self, agent: str) -> list[ModelEntry]:
        """The agent's model first, then the fallbacks — usable ones only, no duplicates."""
        wanted = [self.agent_models.get(agent, self.default_model), *self.fallback_models]
        chain: list[ModelEntry] = []
        for model_id in dict.fromkeys(wanted):
            entry = self.get(model_id)
            if entry is not None and self.is_usable(entry):
                chain.append(entry)
        if not chain:
            raise AppError(
                "model_not_configured",
                status_code=503,
                title="No AI model is switched on",
                message=f"Every model chosen for the {agent} is turned off.",
                action="Turn a model on in Admin → AI models.",
            )
        return chain

    def effort_for(self, agent: str) -> Effort:
        return self.agent_effort.get(agent, "medium")


def _price(inp: str, out: str, cache_read: str) -> ModelPrice:
    return ModelPrice(input=Decimal(inp), output=Decimal(out), cache_read=Decimal(cache_read))


_CLAUDE = Capabilities(structured_output=True, thinking=True, web_search=True)

DEFAULT_CATALOG = ModelCatalog(
    models=[
        ModelEntry(
            id="anthropic:claude-opus-5-5",
            label="Claude Opus 5.5",
            price=_price("4", "20", "0.20"),
            capabilities=_CLAUDE,
        ),
        ModelEntry(
            id="anthropic:claude-sonnet-5-5",
            label="Claude Sonnet 5.5",
            price=_price("2", "10", "0.20"),
            capabilities=_CLAUDE,
        ),
        ModelEntry(
            id="anthropic:claude-haiku-5-5",
            label="Claude Haiku 5.5",
            price=_price("0.10", "0.50", "0.01"),
            capabilities=_CLAUDE,
        ),
    ],
    default_model="anthropic:claude-opus-5-5",
    fallback_models=["anthropic:claude-sonnet-5-5"],
    agent_effort={"interviewer": "medium"},
)


def load_catalog(session: Session) -> ModelCatalog:
    """The admin's catalog if one is saved, otherwise the defaults."""
    row = session.get(AppConfig, CATALOG_CONFIG_KEY)
    if row is None:
        return DEFAULT_CATALOG
    return ModelCatalog.model_validate(row.value)
