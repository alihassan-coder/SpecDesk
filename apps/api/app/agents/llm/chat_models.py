"""Build LangChain chat models from catalog entries, and ask them for structured output.

`init_chat_model` covers every provider LangChain supports; a provider's package
(e.g. `langchain-openai`) must be installed before an admin can switch its models on.
"""

from typing import Any, cast

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from langchain_core.runnables import Runnable, RunnableLambda
from pydantic import BaseModel, SecretStr

from app.agents.llm.catalog import Effort, ModelEntry

# Large enough for a full planning section; streaming keeps long calls safe from timeouts.
MAX_OUTPUT_TOKENS = 16_000


def build_chat_model(entry: ModelEntry, api_key: SecretStr, effort: Effort) -> BaseChatModel:
    kwargs: dict[str, Any] = {"api_key": api_key.get_secret_value(), "max_retries": 2}
    if entry.provider == "anthropic":
        # `effort` sets output_config.effort and turns on adaptive thinking with summarized
        # reasoning, which the UI shows as "why it decided this".
        kwargs |= {"effort": effort, "max_tokens": MAX_OUTPUT_TOKENS}
    elif entry.provider == "groq":
        # GPT-OSS reasoning models take low / medium / high.
        level = effort if effort in ("low", "medium", "high") else "high"
        # One retry only: on a rate limit, moving to the fallback model is faster than waiting.
        kwargs |= {"reasoning_effort": level, "max_tokens": MAX_OUTPUT_TOKENS, "max_retries": 1}
    elif entry.provider == "google_genai":
        # A small thinking budget keeps Flash-Lite fast; structured output stays reliable.
        budget = {"low": 256, "medium": 1024}.get(effort, 4096)
        kwargs |= {"thinking_budget": budget, "max_tokens": MAX_OUTPUT_TOKENS, "max_retries": 1}
    return cast(BaseChatModel, init_chat_model(entry.name, model_provider=entry.provider, **kwargs))


def structured(
    model: BaseChatModel, schema: type[BaseModel]
) -> Runnable[list[BaseMessage], tuple[object, object]]:
    """Runnable that returns `(raw_message, parsed_or_None)`.

    `json_schema` is the provider's native structured-output mode. On Claude it avoids forced
    tool calls, which newer models (Opus 5.5, Sonnet 5.5) reject.
    """
    with_schema = model.with_structured_output(schema, method="json_schema", include_raw=True)

    def split(result: object) -> tuple[object, object]:
        data = cast(dict[str, object], result)
        return data.get("raw"), data.get("parsed")

    return with_schema | RunnableLambda(split)
