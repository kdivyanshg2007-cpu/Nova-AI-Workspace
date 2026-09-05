from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from agents.research_agent import ResearchAgent
from dependencies import get_current_user
from workspace_routes import verify_workspace_ownership


router = APIRouter(
    prefix="/api/v1/research",
    tags=["Research"],
)


class ResearchRequest(BaseModel):
    query: str


class ResearchResponse(BaseModel):
    success: bool
    agent_name: str
    answer: str = ""
    data: dict[str, Any] = {}
    sources: list[dict[str, Any]] = []
    error: str | None = None


@router.post(
    "/run",
    response_model=ResearchResponse,
)
def run_research(
    request: ResearchRequest,
    workspace_id: int,
    current_user: dict = Depends(get_current_user),
):
    if workspace_id <= 0:
        return {
            "success": False,
            "agent_name": "research",
            "answer": "",
            "data": {},
            "sources": [],
            "error": "Invalid workspace_id.",
        }

    user_id = current_user["user_id"]

    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=user_id,
    ):
        return {
            "success": False,
            "agent_name": "research",
            "answer": "",
            "data": {},
            "sources": [],
            "error": (
                "Workspace not found or "
                "access denied."
            ),
        }

    query = request.query.strip()

    if not query:
        return {
            "success": False,
            "agent_name": "research",
            "answer": "",
            "data": {},
            "sources": [],
            "error": "Please provide a research query.",
        }

    try:
        agent = ResearchAgent()

        result = agent.run(
            query=query,
            workspace_id=workspace_id,
            user_id=user_id,
        )

        return {
            "success": result.success,
            "agent_name": result.agent_name,
            "answer": result.answer or "",
            "data": result.data or {},
            "sources": result.sources or [],
            "error": result.error,
        }

    except Exception as error:
        return {
            "success": False,
            "agent_name": "research",
            "answer": "",
            "data": {},
            "sources": [],
            "error": str(error),
        }