"""Prompt files live next to this module as Markdown, one per agent."""

from functools import cache
from pathlib import Path

_DIR = Path(__file__).parent


@cache
def load_prompt(name: str) -> str:
    """Read `prompts/<name>.md`. Cached: prompts are static, which keeps them cache-friendly."""
    return (_DIR / f"{name}.md").read_text(encoding="utf-8").strip()
