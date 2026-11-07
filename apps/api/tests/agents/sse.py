"""Parse a Server-Sent Events body in tests."""

import json
from typing import Any


def parse_events(body: str) -> list[tuple[str, Any]]:
    """(event, data) pairs, in order."""
    parsed: list[tuple[str, Any]] = []
    for block in body.strip().split("\n\n"):
        fields = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        if "event" in fields:
            parsed.append((fields["event"], json.loads(fields.get("data", "null"))))
    return parsed
