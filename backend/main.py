from typing import Any

from pathlib import Path

import shutil
import time

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Request,
    UploadFile,
)

from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from slowapi.extension import _rate_limit_exceeded_handler

from settings import settings
from logging_config import setup_logging
from errors import not_found_error

from auth_routes import (
    signup_user,
    login_user,
)

from workspace_routes import (
    create_workspace,
    get_user_workspaces,
    verify_workspace_ownership,
    rename_workspace,
    archive_workspace,
    unarchive_workspace,
    delete_workspace,
)

from document_routes import (
    create_document,
    get_workspace_documents,
    update_document,
    delete_document,
    get_document,
    search_documents,
    search_document_chunks,
)

from chat_routes import (
    create_chat_message,
    get_workspace_chat_messages,
    get_user_conversations,
    create_new_conversation,
    rename_conversation,
    delete_conversation,
)

from dependencies import get_current_user
from database import get_connection
from document_processing import process_document
from document_qa import ask_document

from agents.coding_agent import CodingAgent

from research_routes import router as research_router
from share_routes import router as share_router
from notes_tasks_routes import router as productivity_router
from memories_routes import router as memories_router
from search_routes import router as search_router

from agents.research_pdf_export import ResearchPDFExportService
from agents.file_export import FileExportService

from preferences_routes import router as preferences_router
from evaluation_routes import router as evaluation_router
from usage_routes import router as usage_router

from services.data_analysis_service import (
    analyze_dataset,
    generate_analysis_report,
)


# =========================================================
# RESPONSE MODELS
# =========================================================

class APIResponse(BaseModel):
    success: bool
    message: str | None = None
    token: str | None = None
    user: dict[str, Any] | None = None
    workspace: dict[str, Any] | None = None
    workspaces: list[dict[str, Any]] | None = None
    document: dict[str, Any] | None = None
    documents: list[dict[str, Any]] | None = None
    document_id: int | None = None
    page: int | None = None
    limit: int | None = None
    query: str | None = None


class HealthResponse(BaseModel):
    status: str


class CodingRequest(BaseModel):
    task: str
    code: str = ""
    language: str = "python"
    operation: str = "generate"


class CodingResponse(BaseModel):
    success: bool
    agent_name: str
    answer: str = ""
    data: dict[str, Any] = {}
    error: str | None = None


class ResearchPDFExportRequest(BaseModel):
    report: dict[str, Any]


# =========================================================
# APP
# =========================================================

setup_logging()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Nova AI Workspace Backend API",
)

limiter = Limiter(
    key_func=get_remote_address
)

app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)


# =========================================================
# ROUTERS
# =========================================================

app.include_router(research_router)
app.include_router(share_router)
app.include_router(productivity_router)
app.include_router(memories_router)
app.include_router(search_router)
app.include_router(preferences_router)
app.include_router(evaluation_router)
app.include_router(usage_router)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "https://nova-ai-workspace-kappa.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# HEALTH
# =========================================================

@app.get(
    "/api/v1/health",
    response_model=HealthResponse,
)
def health_check():
    return {
        "status": "ok"
    }

# =========================================================
# TEST ERROR
# =========================================================

@app.get(
    "/api/v1/test-error"
)
def test_error():
    not_found_error(
        "Test resource not found"
    )


# =========================================================
# AUTHENTICATION
# =========================================================

@app.post(
    "/api/v1/auth/signup",
    response_model=APIResponse,
)
@limiter.limit("5/minute")
def signup(
    request: Request,
    name: str,
    email: str,
    password: str,
):
    return signup_user(
        name,
        email,
        password,
    )


@app.post(
    "/api/v1/auth/login",
    response_model=APIResponse,
)
@limiter.limit("10/minute")
def login(
    request: Request,
    email: str,
    password: str,
):
    return login_user(
        email,
        password,
    )


# =========================================================
# WORKSPACES
# =========================================================

@app.post(
    "/api/v1/workspaces",
    response_model=APIResponse,
)
def create_new_workspace(
    name: str,
    current_user: dict = Depends(
        get_current_user
    ),
):
    return create_workspace(
        user_id=current_user["user_id"],
        name=name,
    )


@app.get(
    "/api/v1/workspaces",
    response_model=APIResponse,
)
def list_workspaces(
    include_archived: bool = False,
    current_user: dict = Depends(
        get_current_user
    ),
):
    return get_user_workspaces(
        user_id=current_user["user_id"],
        include_archived=include_archived,
    )


@app.put(
    "/api/v1/workspaces/{workspace_id}",
    response_model=APIResponse,
)
def rename_existing_workspace(
    workspace_id: int,
    name: str,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return rename_workspace(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        name=name,
    )


# =========================================================
# ARCHIVE WORKSPACE
# =========================================================

@app.put(
    "/api/v1/workspaces/{workspace_id}/archive",
    response_model=APIResponse,
)
def archive_existing_workspace(
    workspace_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    return archive_workspace(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    )


# =========================================================
# UNARCHIVE WORKSPACE
# =========================================================

@app.put(
    "/api/v1/workspaces/{workspace_id}/unarchive",
    response_model=APIResponse,
)
def unarchive_existing_workspace(
    workspace_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    return unarchive_workspace(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    )


@app.delete(
    "/api/v1/workspaces/{workspace_id}",
    response_model=APIResponse,
)
def delete_existing_workspace(
    workspace_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return delete_workspace(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    )


# =========================================================
# DOCUMENTS
# =========================================================

@app.post(
    "/api/v1/documents",
    response_model=APIResponse,
)
def create_new_document(
    workspace_id: int,
    title: str,
    content: str,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return create_document(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        title=title,
        content=content,
    )


@app.get(
    "/api/v1/documents",
    response_model=APIResponse,
)
def list_documents(
    workspace_id: int,
    page: int = 1,
    limit: int = 10,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return get_workspace_documents(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        page=page,
        limit=limit,
    )


@app.get(
    "/api/v1/documents/search",
    response_model=APIResponse,
)
def search_workspace_documents(
    workspace_id: int,
    query: str,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return search_documents(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        query=query,
    )


# =========================================================
# RAG — VECTOR SEARCH
# =========================================================

@app.get(
    "/api/v1/documents/vector-search"
)
def vector_search_documents(
    workspace_id: int,
    query: str,
    limit: int = 5,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Search document chunks using semantic
    vector similarity.
    """

    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
            "chunks": [],
        }

    return search_document_chunks(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        query=query,
        limit=limit,
    )


@app.get(
    "/api/v1/documents/{document_id}",
    response_model=APIResponse,
)
def get_single_document(
    document_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    return get_document(
        document_id=document_id,
        user_id=current_user["user_id"],
    )


@app.put(
    "/api/v1/documents/{document_id}",
    response_model=APIResponse,
)
def update_existing_document(
    document_id: int,
    title: str,
    content: str,
    current_user: dict = Depends(
        get_current_user
    ),
):
    return update_document(
        document_id=document_id,
        user_id=current_user["user_id"],
        title=title,
        content=content,
    )


@app.delete(
    "/api/v1/documents/{document_id}",
    response_model=APIResponse,
)
def delete_existing_document(
    document_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    return delete_document(
        document_id=document_id,
        user_id=current_user["user_id"],
    )


# =========================================================
# DAY 14 — ASK YOUR DOCUMENT
# =========================================================

@app.post(
    "/api/v1/documents/ask"
)
def ask_document_endpoint(
    question: str,
    workspace_id: int,
    top_k: int = 5,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return ask_document(
        question=question,
        workspace_id=workspace_id,
        top_k=top_k,
    )


# =========================================================
# CHAT
# =========================================================

@app.post(
    "/api/v1/chat/messages"
)
def create_new_chat_message(
    workspace_id: int,
    message: str,
    conversation_id: int | None = None,
    file_id: int | None = None,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }
    return create_chat_message(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        message=message,
        conversation_id=conversation_id,
        file_id=file_id,
    )


@app.post(
    "/api/v1/chat/conversations"
)
def create_conversation(
    workspace_id: int,
    title: str = "New Chat",
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return create_new_conversation(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        title=title,
    )


@app.put(
    "/api/v1/chat/conversations/{conversation_id}"
)
def rename_chat_conversation(
    conversation_id: int,
    workspace_id: int,
    title: str,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return rename_conversation(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        conversation_id=conversation_id,
        title=title,
    )


@app.delete(
    "/api/v1/chat/conversations/{conversation_id}"
)
def delete_chat_conversation(
    conversation_id: int,
    workspace_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return delete_conversation(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        conversation_id=conversation_id,
    )


@app.get(
    "/api/v1/chat/conversations"
)
def list_conversations(
    workspace_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return get_user_conversations(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    )


@app.get(
    "/api/v1/chat/messages"
)
def list_chat_messages(
    workspace_id: int,
    conversation_id: int | None = None,
    current_user: dict = Depends(
        get_current_user
    ),
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
    ):
        return {
            "success": False,
            "message": (
                "Workspace not found or "
                "access denied."
            ),
        }

    return get_workspace_chat_messages(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        conversation_id=conversation_id,
    )


# =========================================================
# CHAT FILE UPLOAD + AUTOMATIC PROCESSING
# =========================================================

UPLOAD_DIR = Path(
    "uploads/chat"
)

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


@app.post(
    "/api/v1/chat/attachments"
)
async def upload_chat_attachment(
    workspace_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Upload file, save metadata, and automatically process
    PDF/DOCX/TXT documents.
    """

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id.",
        }

    user_id = current_user["user_id"]

    connection = None
    cursor = None
    file_path = None
    MAX_FILE_SIZE_MB = 25
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    processing_result = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM workspaces
            WHERE id = %s
              AND user_id = %s;
            """,
            (
                workspace_id,
                user_id,
            ),
        )

        workspace = cursor.fetchone()

        if workspace is None:
            return {
                "success": False,
                "message": (
                    "Workspace not found or "
                    "access denied."
                ),
            }

        if not file.filename:
            return {
                "success": False,
                "message": "No file selected.",
            }

        safe_name = Path(
            file.filename
        ).name

        allowed_extensions = {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".gif",
            ".pdf",
            ".txt",
            ".csv",
            ".doc",
            ".docx",
            ".xls",
            ".xlsx",
        }

        extension = Path(
            safe_name
        ).suffix.lower()

        if extension not in allowed_extensions:
            return {
                "success": False,
                "message": (
                    "This file type is not supported."
                ),
            }

        unique_name = (
            f"user_{user_id}_"
            f"workspace_{workspace_id}_"
            f"{int(time.time() * 1000)}_"
            f"{safe_name}"
        )

        file_path = (
            UPLOAD_DIR /
            unique_name
        )

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer,
            )

        file_size = file_path.stat().st_size

        if file_size > MAX_FILE_SIZE_BYTES:
            try:
                file_path.unlink(missing_ok=True)
            except Exception:
                pass

            file_path = None

            return {
                "success": False,
                "message": (
                    f"File is too large. "
                    f"Maximum allowed size is "
                    f"{MAX_FILE_SIZE_MB} MB."
                ),
            }

        cursor.execute(
            """
            INSERT INTO files (
                user_id,
                workspace_id,
                filename,
                file_path,
                mime_type,
                file_size
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            RETURNING id;
            """,
            (
                user_id,
                workspace_id,
                safe_name,
                str(file_path),
                file.content_type,
                file_size,
            ),
        )

        file_id = cursor.fetchone()[0]

        connection.commit()

        if extension in {
            ".pdf",
            ".docx",
            ".txt",
        }:
            try:
                processing_result = process_document(
                    file_path=str(file_path),
                    file_id=file_id,
                    filename=safe_name,
                    workspace_id=workspace_id,
                )

                print(
                    "DOCUMENT PROCESSING SUCCESS:",
                    {
                        "file_id": file_id,
                        "filename": safe_name,
                        "page_count": (
                            processing_result[
                                "page_count"
                            ]
                        ),
                        "chunk_count": (
                            processing_result[
                                "chunk_count"
                            ]
                        ),
                    },
                )

            except Exception as processing_error:
                print(
                    "DOCUMENT PROCESSING ERROR:",
                    repr(processing_error),
                )

        return {
            "success": True,
            "message": (
                "File uploaded successfully."
            ),
            "attachment": {
                "id": file_id,
                "filename": safe_name,
                "content_type": file.content_type,
                "size": file_size,
                "path": str(file_path),
                "workspace_id": workspace_id,
            },
            "processing": {
                "success": (
                    processing_result is not None
                ),
                "page_count": (
                    processing_result[
                        "page_count"
                    ]
                    if processing_result
                    else 0
                ),
                "chunk_count": (
                    processing_result[
                        "chunk_count"
                    ]
                    if processing_result
                    else 0
                ),
            },
        }

    except Exception as error:
        if connection is not None:
            try:
                connection.rollback()
            except Exception:
                pass

        if file_path is not None:
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception:
                pass

        print(
            "CHAT FILE UPLOAD ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"File upload failed: {str(error)}"
            ),
        }

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()

        await file.close()


# =========================================================
# AI DATA ANALYSIS
# =========================================================

DATA_ANALYSIS_UPLOAD_DIR = Path(
    "uploads/data_analysis"
)

DATA_ANALYSIS_UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


@app.post(
    "/api/v1/data-analysis/analyze"
)
async def analyze_data_file(
    workspace_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Upload and analyze a CSV/XLSX dataset.

    Safety limits:
    - Maximum file size: 25 MB
    - Maximum rows: 100,000
    """

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id.",
        }

    user_id = current_user["user_id"]

    file_path = None
    connection = None
    cursor = None

    MAX_FILE_SIZE_MB = 25
    MAX_FILE_SIZE_BYTES = (
        MAX_FILE_SIZE_MB *
        1024 *
        1024
    )

    try:
        if not verify_workspace_ownership(
            workspace_id=workspace_id,
            user_id=user_id,
        ):
            return {
                "success": False,
                "message": (
                    "Workspace not found or "
                    "access denied."
                ),
            }

        if not file.filename:
            return {
                "success": False,
                "message": "No file selected.",
            }

        safe_name = Path(
            file.filename
        ).name

        extension = Path(
            safe_name
        ).suffix.lower()

        allowed_extensions = {
            ".csv",
            ".xlsx",
        }

        if extension not in allowed_extensions:
            return {
                "success": False,
                "message": (
                    "AI Data Analysis supports "
                    "only CSV and XLSX files."
                ),
            }

        unique_name = (
            f"user_{user_id}_"
            f"workspace_{workspace_id}_"
            f"{int(time.time() * 1000)}_"
            f"{safe_name}"
        )

        file_path = (
            DATA_ANALYSIS_UPLOAD_DIR /
            unique_name
        )

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer,
            )

        file_size = file_path.stat().st_size

        if file_size > MAX_FILE_SIZE_BYTES:
            try:
                file_path.unlink(
                    missing_ok=True
                )
            except Exception:
                pass

            file_path = None

            return {
                "success": False,
                "message": (
                    f"File is too large. "
                    f"Maximum allowed size is "
                    f"{MAX_FILE_SIZE_MB} MB."
                ),
            }

        analysis_result = analyze_dataset(
            file_path=str(file_path)
        )

        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO files (
                user_id,
                workspace_id,
                filename,
                file_path,
                mime_type,
                file_size
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            RETURNING id;
            """,
            (
                user_id,
                workspace_id,
                safe_name,
                str(file_path),
                file.content_type,
                file_size,
            ),
        )

        file_id = cursor.fetchone()[0]

        connection.commit()

        return {
            "success": True,
            "message": (
                "Dataset analyzed successfully."
            ),
            "file_id": file_id,
            "workspace_id": workspace_id,
            "analysis": analysis_result,
        }

    except FileNotFoundError as error:
        if connection is not None:
            try:
                connection.rollback()
            except Exception:
                pass

        if file_path is not None:
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception:
                pass

        return {
            "success": False,
            "message": str(error),
        }

    except ValueError as error:
        if connection is not None:
            try:
                connection.rollback()
            except Exception:
                pass

        if file_path is not None:
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception:
                pass

        return {
            "success": False,
            "message": str(error),
        }

    except Exception as error:
        if connection is not None:
            try:
                connection.rollback()
            except Exception:
                pass

        if file_path is not None:
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception:
                pass

        print(
            "AI DATA ANALYSIS ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"Data analysis failed: {str(error)}"
            ),
        }

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()

        await file.close()


# =========================================================
# DOWNLOADABLE DATA ANALYSIS REPORT
# =========================================================

@app.get(
    "/api/v1/data-analysis/report/{file_id}"
)
def download_data_analysis_report(
    file_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Generate and download a TXT analysis report
    for a previously analyzed CSV/XLSX file.
    """

    if file_id <= 0:
        return {
            "success": False,
            "message": "Invalid file_id.",
        }

    user_id = current_user["user_id"]

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                workspace_id,
                filename,
                file_path
            FROM files
            WHERE id = %s
              AND user_id = %s;
            """,
            (
                file_id,
                user_id,
            ),
        )

        file_record = cursor.fetchone()

        if file_record is None:
            return {
                "success": False,
                "message": (
                    "File not found or "
                    "access denied."
                ),
            }

        filename = file_record[3]
        file_path = file_record[4]

    except Exception as error:
        return {
            "success": False,
            "message": (
                f"Unable to find analysis file: {str(error)}"
            ),
        }

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()

    try:
        source_path = Path(
            file_path
        )

        if not source_path.exists():
            return {
                "success": False,
                "message": (
                    "The analyzed dataset could "
                    "not be found on the server."
                ),
            }

        extension = (
            source_path.suffix.lower()
        )

        if extension not in {
            ".csv",
            ".xlsx",
        }:
            return {
                "success": False,
                "message": (
                    "This file is not a supported "
                    "data analysis dataset."
                ),
            }

        report_path = generate_analysis_report(
            file_path=str(source_path)
        )

        report_file = Path(
            report_path
        )

        return FileResponse(
            path=report_file,
            media_type="text/plain",
            filename=(
                f"{Path(filename).stem}"
                "_analysis_report.txt"
            ),
        )

    except FileNotFoundError:
        return {
            "success": False,
            "message": (
                "The analyzed dataset "
                "could not be found."
            ),
        }

    except ValueError as error:
        return {
            "success": False,
            "message": str(error),
        }

    except Exception as error:
        print(
            "DATA ANALYSIS REPORT ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"Report generation failed: {str(error)}"
            ),
        }


# =========================================================
# DATA ANALYSIS CHARTS
# =========================================================

@app.get(
    "/api/v1/data-analysis/charts/{file_id}/{chart_filename}"
)
def get_data_analysis_chart(
    file_id: int,
    chart_filename: str,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Return a generated PNG chart.

    Access is restricted to the authenticated
    owner of the analyzed dataset.
    """

    if file_id <= 0:
        return {
            "success": False,
            "message": "Invalid file_id.",
        }

    user_id = current_user["user_id"]

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                workspace_id,
                filename,
                file_path
            FROM files
            WHERE id = %s
              AND user_id = %s;
            """,
            (
                file_id,
                user_id,
            ),
        )

        file_record = cursor.fetchone()

        if file_record is None:
            return {
                "success": False,
                "message": (
                    "File not found or "
                    "access denied."
                ),
            }

        source_file_path = Path(
            file_record[4]
        )

    except Exception as error:
        return {
            "success": False,
            "message": (
                f"Unable to find analysis file: {str(error)}"
            ),
        }

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()

    try:
        safe_chart_filename = Path(
            chart_filename
        ).name

        if not safe_chart_filename.lower().endswith(
            ".png"
        ):
            return {
                "success": False,
                "message": (
                    "Only PNG chart files are supported."
                ),
            }

        chart_directory = (
            source_file_path.parent /
            "charts"
        )

        chart_path = (
            chart_directory /
            safe_chart_filename
        )

        if not chart_path.exists():
            return {
                "success": False,
                "message": "Chart not found.",
            }

        return FileResponse(
            path=chart_path,
            media_type="image/png",
            filename=chart_path.name,
        )

    except Exception as error:
        print(
            "AI DATA ANALYSIS CHART ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"Chart loading failed: {str(error)}"
            ),
        }


# =========================================================
# WORKSPACE FILES
# =========================================================

ALLOWED_FILE_ROOTS = [
    UPLOAD_DIR.resolve(),
    DATA_ANALYSIS_UPLOAD_DIR.resolve(),
]


def is_safe_file_path(file_path: str) -> bool:
    """
    Allow file access only inside known upload directories.
    Prevents path traversal / arbitrary file access.
    """
    try:
        resolved_path = Path(file_path).resolve()

        for allowed_root in ALLOWED_FILE_ROOTS:
            try:
                resolved_path.relative_to(allowed_root)
                return True
            except ValueError:
                continue

        return False

    except Exception:
        return False


@app.get(
    "/api/v1/files"
)
def list_workspace_files(
    workspace_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    List files belonging to the authenticated user's workspace.
    """

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id.",
            "files": [],
        }

    user_id = current_user["user_id"]

    connection = None
    cursor = None

    try:
        if not verify_workspace_ownership(
            workspace_id=workspace_id,
            user_id=user_id,
        ):
            return {
                "success": False,
                "message": (
                    "Workspace not found or "
                    "access denied."
                ),
                "files": [],
            }

        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                filename,
                mime_type,
                file_size,
                created_at
            FROM files
            WHERE user_id = %s
              AND workspace_id = %s
            ORDER BY created_at DESC;
            """,
            (
                user_id,
                workspace_id,
            ),
        )

        rows = cursor.fetchall()

        files = []

        for row in rows:
            files.append(
                {
                    "id": row[0],
                    "filename": row[1],
                    "mime_type": row[2],
                    "file_size": row[3],
                    "created_at": row[4],
                }
            )

        return {
            "success": True,
            "count": len(files),
            "files": files,
        }

    except Exception as error:
        print(
            "LIST WORKSPACE FILES ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"Unable to load files: {str(error)}"
            ),
            "files": [],
        }

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


@app.get(
    "/api/v1/files/{file_id}/download"
)
def download_workspace_file(
    file_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Download a file belonging to the authenticated user.

    Security:
    - User ownership is verified.
    - File path must remain inside an approved upload directory.
    """

    if file_id <= 0:
        return {
            "success": False,
            "message": "Invalid file_id.",
        }

    user_id = current_user["user_id"]

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                filename,
                file_path,
                mime_type,
                file_size
            FROM files
            WHERE id = %s
              AND user_id = %s;
            """,
            (
                file_id,
                user_id,
            ),
        )

        file_record = cursor.fetchone()

        if file_record is None:
            return {
                "success": False,
                "message": (
                    "File not found or "
                    "access denied."
                ),
            }

        filename = file_record[1]
        file_path = file_record[2]
        mime_type = file_record[3] or (
            "application/octet-stream"
        )

    except Exception as error:
        return {
            "success": False,
            "message": (
                f"Unable to find file: {str(error)}"
            ),
        }

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()

    try:
        if not is_safe_file_path(file_path):
            return {
                "success": False,
                "message": (
                    "File access denied."
                ),
            }

        source_path = Path(
            file_path
        ).resolve()

        if not source_path.exists():
            return {
                "success": False,
                "message": (
                    "The requested file "
                    "could not be found on the server."
                ),
            }

        return FileResponse(
            path=source_path,
            media_type=mime_type,
            filename=Path(filename).name,
        )

    except Exception as error:
        print(
            "FILE DOWNLOAD ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"File download failed: {str(error)}"
            ),
        }


@app.delete(
    "/api/v1/files/{file_id}"
)
def delete_workspace_file(
    file_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Delete a file belonging to the user's workspace.
    """

    if file_id <= 0:
        return {
            "success": False,
            "message": "Invalid file_id.",
        }

    user_id = current_user["user_id"]

    connection = None
    cursor = None
    file_path = None
    filename = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                filename,
                file_path
            FROM files
            WHERE id = %s
              AND user_id = %s;
            """,
            (
                file_id,
                user_id,
            ),
        )

        file_record = cursor.fetchone()

        if file_record is None:
            return {
                "success": False,
                "message": (
                    "File not found or "
                    "access denied."
                ),
            }

        filename = file_record[1]
        file_path = file_record[2]

        cursor.execute(
            """
            DELETE FROM files
            WHERE id = %s
              AND user_id = %s
            RETURNING id;
            """,
            (
                file_id,
                user_id,
            ),
        )

        deleted_file = cursor.fetchone()

        if deleted_file is None:
            connection.rollback()

            return {
                "success": False,
                "message": "File could not be deleted.",
            }

        connection.commit()

    except Exception as error:
        if connection is not None:
            try:
                connection.rollback()
            except Exception:
                pass

        print(
            "DELETE WORKSPACE FILE ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"File deletion failed: {str(error)}"
            ),
        }

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()

    try:
        if file_path and is_safe_file_path(file_path):
            stored_path = Path(
                file_path
            ).resolve()

            if stored_path.exists():
                stored_path.unlink()

    except Exception as error:
        print(
            "PHYSICAL FILE DELETE WARNING:",
            repr(error),
        )

    return {
        "success": True,
        "message": (
            f"File '{Path(filename).name}' "
            "deleted successfully."
        ),
        "file_id": file_id,
    }


@app.post(
    "/api/v1/documents/process"
)
def process_uploaded_document(
    file_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Process an already uploaded PDF, DOCX or TXT file.
    """

    if file_id <= 0:
        return {
            "success": False,
            "message": "Invalid file_id.",
        }

    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                id,
                user_id,
                workspace_id,
                filename,
                file_path,
                mime_type,
                file_size
            FROM files
            WHERE id = %s
              AND user_id = %s;
            """,
            (
                file_id,
                user_id,
            ),
        )

        file_record = cursor.fetchone()

        if file_record is None:
            return {
                "success": False,
                "message": (
                    "File not found or "
                    "access denied."
                ),
            }

        stored_file_id = file_record[0]
        workspace_id = file_record[2]
        filename = file_record[3]
        file_path = file_record[4]

    except Exception as error:
        return {
            "success": False,
            "message": (
                f"Unable to find file: {str(error)}"
            ),
        }

    finally:
        cursor.close()
        connection.close()

    try:
        result = process_document(
            file_path=file_path,
            file_id=stored_file_id,
            filename=filename,
            workspace_id=workspace_id,
        )

        return {
            "success": True,
            "message": (
                "Document processed successfully."
            ),
            "file_id": stored_file_id,
            "workspace_id": workspace_id,
            "filename": filename,
            "page_count": result["page_count"],
            "chunk_count": result["chunk_count"],
            "pages": result["pages"],
            "chunks": result["chunks"],
        }

    except FileNotFoundError:
        return {
            "success": False,
            "message": (
                "The uploaded file could not "
                "be found on the server."
            ),
        }

    except ValueError as error:
        return {
            "success": False,
            "message": str(error),
        }

    except Exception as error:
        print(
            "DOCUMENT PROCESSING ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"Document processing failed: {str(error)}"
            ),
        }


# =========================================================
# DAY 31 — RESEARCH PDF EXPORT
# =========================================================

@app.post(
    "/api/v1/research/export-pdf"
)
def export_research_pdf(
    request: ResearchPDFExportRequest,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Generate and return a research report as a PDF file.
    """

    report = request.report or {}

    if not report:
        return {
            "success": False,
            "message": (
                "Research report cannot be empty."
            ),
        }

    try:
        export_service = ResearchPDFExportService()

        file_path = export_service.export_pdf(
            report=report
        )

        return FileResponse(
            path=file_path,
            media_type="application/pdf",
            filename=Path(file_path).name,
        )

    except Exception as error:
        print(
            "RESEARCH PDF EXPORT ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"Research PDF export failed: {str(error)}"
            ),
        }


# =========================================================
# DAY 32 — FILE EXPORT
# =========================================================

@app.post(
    "/api/v1/research/export-docx"
)
def export_research_docx(
    request: ResearchPDFExportRequest,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Generate and return a research report as a DOCX file.
    """

    report = request.report or {}

    if not report:
        return {
            "success": False,
            "message": (
                "Research report cannot be empty."
            ),
        }

    try:
        export_service = FileExportService()

        file_path = export_service.export_docx(
            report=report
        )

        return FileResponse(
            path=file_path,
            media_type=(
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
            filename=Path(file_path).name,
        )

    except Exception as error:
        print(
            "RESEARCH DOCX EXPORT ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"Research DOCX export failed: {str(error)}"
            ),
        }


@app.post(
    "/api/v1/research/export-pptx"
)
def export_research_pptx(
    request: ResearchPDFExportRequest,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Generate and return a research report as a PPTX file.
    """

    report = request.report or {}

    if not report:
        return {
            "success": False,
            "message": (
                "Research report cannot be empty."
            ),
        }

    try:
        export_service = FileExportService()

        file_path = export_service.export_pptx(
            report=report
        )

        return FileResponse(
            path=file_path,
            media_type=(
                "application/vnd.openxmlformats-officedocument."
                "presentationml.presentation"
            ),
            filename=Path(file_path).name,
        )

    except Exception as error:
        print(
            "RESEARCH PPTX EXPORT ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"Research PPTX export failed: {str(error)}"
            ),
        }


@app.post(
    "/api/v1/research/export-xlsx"
)
def export_research_xlsx(
    request: ResearchPDFExportRequest,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Generate and return a research report as an XLSX file.
    """

    report = request.report or {}

    if not report:
        return {
            "success": False,
            "message": (
                "Research report cannot be empty."
            ),
        }

    try:
        export_service = FileExportService()

        file_path = export_service.export_xlsx(
            report=report
        )

        return FileResponse(
            path=file_path,
            media_type=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
            filename=Path(file_path).name,
        )

    except Exception as error:
        print(
            "RESEARCH XLSX EXPORT ERROR:",
            repr(error),
        )

        return {
            "success": False,
            "message": (
                f"Research XLSX export failed: {str(error)}"
            ),
        }


# =========================================================
# DAY 25 — AI CODING WORKSPACE
# =========================================================

@app.post(
    "/api/v1/coding/run",
    response_model=CodingResponse,
)
@limiter.limit("20/minute")
def run_coding_agent(
    http_request: Request,
    request: CodingRequest,
    workspace_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Run Nova AI Coding Agent.
    """

    if workspace_id <= 0:
        return {
            "success": False,
            "agent_name": "coding",
            "answer": "",
            "data": {},
            "error": "Invalid workspace_id.",
        }

    user_id = current_user["user_id"]

    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=user_id,
    ):
        return {
            "success": False,
            "agent_name": "coding",
            "answer": "",
            "data": {},
            "error": (
                "Workspace not found or "
                "access denied."
            ),
        }

    task = request.task.strip()
    code = request.code
    language = request.language.strip().lower()
    operation = request.operation.strip().lower()

    if not task and not code.strip():
        return {
            "success": False,
            "agent_name": "coding",
            "answer": "",
            "data": {},
            "error": (
                "Please provide a coding task "
                "or code."
            ),
        }

    try:
        agent = CodingAgent()

        result = agent.run(
            task=(
                task
                or
                f"Perform {operation} on the provided code."
            ),
            code=code,
            language=language,
            operation=operation,
            workspace_id=workspace_id,
            user_id=user_id,
        )

        return {
            "success": result.success,
            "agent_name": result.agent_name,
            "answer": result.answer or "",
            "data": result.data or {},
            "error": result.error,
        }

    except Exception as error:
        return {
            "success": False,
            "agent_name": "coding",
            "answer": "",
            "data": {},
            "error": str(error),
        }