"""Managing a chat from the sidebar: rename it, or delete it with everything it made.

Deleting removes the chat row (messages, plan, plan versions, files and agent runs go with it
through ON DELETE CASCADE) and both LangGraph threads: the interview (`<chat_id>`) and the
planner (`plan:<chat_id>`).
"""

from typing import Annotated

from fastapi import APIRouter, Response
from pydantic import StringConstraints
from sqlalchemy import select

from app.agents.interviewer.schemas import CamelModel
from app.agents.planner.graph import plan_thread_id
from app.db.models import Plan
from app.routers.chats import ChatSummary, CheckpointerDep, OwnedChat, SessionDep

router = APIRouter(prefix="/chats", tags=["chats"])

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class RenameChat(CamelModel):
    title: Title


@router.patch("/{chat_id}")
def rename_chat(body: RenameChat, chat: OwnedChat, session: SessionDep) -> ChatSummary:
    chat.title = body.title
    session.commit()
    session.refresh(chat)
    plan_id = session.scalar(select(Plan.id).where(Plan.chat_id == chat.id))
    return ChatSummary(
        id=chat.id,
        title=chat.title,
        status=chat.status,
        updated_at=chat.updated_at,
        plan_id=plan_id,
    )


@router.delete("/{chat_id}", status_code=204)
def delete_chat(chat: OwnedChat, session: SessionDep, checkpointer: CheckpointerDep) -> Response:
    chat_id = str(chat.id)
    session.delete(chat)
    session.commit()
    # After the commit: if this fails, only unreachable checkpoint rows are left behind,
    # never a chat whose conversation has vanished.
    checkpointer.delete_thread(chat_id)
    checkpointer.delete_thread(plan_thread_id(chat_id))
    return Response(status_code=204)
