"""The one interface agents use to talk to a model."""

from typing import Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class AskModel(Protocol):
    """Ask the model chosen for `agent` for an instance of `schema`.

    `system` is the agent's static prompt (kept identical across calls so providers can cache it);
    `user` carries everything that changes: the idea, earlier answers, the round number.
    """

    def __call__(self, agent: str, schema: type[T], *, system: str, user: str) -> T: ...
