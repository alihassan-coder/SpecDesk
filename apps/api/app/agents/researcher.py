"""Competitor research with live web search (Groq's built-in `browser_search` tool on GPT-OSS).

Slow (often 30-60 s) and only on request, so it runs outside the planning graph. The model is asked
for JSON; anything that doesn't parse falls back to an empty list rather than guessed data.
"""

import json
import re
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from groq import Groq
from pydantic import BaseModel, SecretStr, ValidationError

from app.agents.llm.catalog import ModelCatalog
from app.agents.llm.structured import CallRecord
from app.agents.llm.usage import Usage

PROVIDER = "groq"
MODEL = "openai/gpt-oss-120b"
AGENT = "researcher"

PROMPT = """Research the market for this software product using web search.

<product>
{product}
</product>

Find 3-6 real, existing products that compete with it (direct competitors first). Only include
products you found on the web. Reply with JSON only, no other text:
{{"summary": "<two plain sentences on the market and where this idea can stand out>",
  "competitors": [{{"name": "...", "url": "https://...", "note": "<one line: what it does and
  how this idea differs>"}}]}}"""


class Competitor(BaseModel):
    name: str
    url: str
    note: str


class Research(BaseModel):
    summary: str = ""
    competitors: list[Competitor] = []


@dataclass(frozen=True)
class ResearchResult:
    research: Research
    record: CallRecord


_CITATION = re.compile(r"【[^】]*】")


def _parse(text: str) -> Research:
    cleaned = _CITATION.sub("", text)
    match = re.search(r"\{.*\}", cleaned, re.S)
    if not match:
        return Research()
    try:
        data: Any = json.loads(match.group(0))
        research = Research.model_validate(data)
    except (json.JSONDecodeError, ValidationError):
        return Research()
    research.competitors = [c for c in research.competitors if c.url.startswith("http")][:6]
    return research


def research_competitors(product: str, key: SecretStr, catalog: ModelCatalog) -> ResearchResult:
    started = time.monotonic()
    client = Groq(api_key=key.get_secret_value(), timeout=120)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": PROMPT.format(product=product[:3000])}],
        tools=[{"type": "browser_search"}],  # pyright: ignore[reportArgumentType]
        tool_choice="auto",
    )
    text = response.choices[0].message.content or ""
    usage = Usage(
        input_tokens=response.usage.prompt_tokens if response.usage else 0,
        output_tokens=response.usage.completion_tokens if response.usage else 0,
    )
    entry = catalog.get(f"{PROVIDER}:{MODEL}")
    cost = usage.cost_usd(entry.price) if entry else Decimal(0)
    record = CallRecord(
        agent=AGENT,
        model_id=f"{PROVIDER}:{MODEL}",
        ok=True,
        usage=usage,
        cost_usd=cost,
        duration_ms=int((time.monotonic() - started) * 1000),
        error=None,
    )
    return ResearchResult(_parse(text), record)
