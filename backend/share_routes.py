from pathlib import Path
from typing import Any

import json
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


router = APIRouter(
    prefix="/api/v1/research",
    tags=["Research Sharing"],
)


BASE_DIR = Path(__file__).resolve().parent
SHARED_DIR = BASE_DIR / "generated" / "research"
SHARED_FILE = SHARED_DIR / "shared_reports.json"


class ShareResearchRequest(BaseModel):
    report: dict[str, Any]


def ensure_storage():
    SHARED_DIR.mkdir(parents=True, exist_ok=True)

    if not SHARED_FILE.exists():
        SHARED_FILE.write_text(
            json.dumps({}, indent=2),
            encoding="utf-8",
        )


def load_shared_reports() -> dict[str, Any]:
    ensure_storage()

    try:
        content = SHARED_FILE.read_text(
            encoding="utf-8"
        )

        if not content.strip():
            return {}

        data = json.loads(content)

        if isinstance(data, dict):
            return data

        return {}

    except (json.JSONDecodeError, OSError):
        return {}


def save_shared_reports(
    reports: dict[str, Any],
) -> None:
    ensure_storage()

    SHARED_FILE.write_text(
        json.dumps(
            reports,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


@router.post("/share")
def create_research_share(
    request: ShareResearchRequest,
):
    report = request.report

    if not report:
        raise HTTPException(
            status_code=400,
            detail="Research report is required.",
        )

    share_id = uuid.uuid4().hex

    reports = load_shared_reports()

    reports[share_id] = {
        "share_id": share_id,
        "report": report,
    }

    save_shared_reports(reports)

    share_url = (
        "/api/v1/research/shared/"
        + share_id
    )

    return {
        "success": True,
        "message": "Research report shared successfully.",
        "share_id": share_id,
        "share_url": share_url,
        "report": report,
    }


@router.get("/shared/{share_id}")
def get_shared_research(
    share_id: str,
):
    reports = load_shared_reports()

    shared_item = reports.get(share_id)

    if not shared_item:
        raise HTTPException(
            status_code=404,
            detail="Shared research report not found.",
        )

    return {
        "success": True,
        "share_id": share_id,
        "report": shared_item.get(
            "report",
            {},
        ),
    }