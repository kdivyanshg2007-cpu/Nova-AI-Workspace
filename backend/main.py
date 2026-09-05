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
    delete_workspace,
)

from document_routes import (
    create_document,
    get_workspace_documents,
    update_document,
    delete_document,
    get_document,
    search_documents,
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


limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# =========================================================
# DAY 26 — RESEARCH ROUTES
# =========================================================

app.include_router(research_router)
app.include_router(share_router)
app.include_router(productivity_router)
app.include_router(memories_router)
app.include_router(search_router)
app.include_router(preferences_router)


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
    ],
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
@limiter.limit("5/minute")
def health_check(request: Request):
    return {
        "status": "ok"
    }


# =========================================================
# TEST ERROR
# =========================================================

@app.get("/api/v1/test-error")
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
def signup(
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
def login(
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
    current_user: dict = Depends(
        get_current_user
    ),
):
    return get_user_workspaces(
        user_id=current_user["user_id"],
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

UPLOAD_DIR = Path("uploads/chat")

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
    processing_result = None

    try:

        # -------------------------------------------------
        # Verify workspace ownership
        # -------------------------------------------------

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

        # -------------------------------------------------
        # Validate file
        # -------------------------------------------------

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

        # -------------------------------------------------
        # Create unique filename
        # -------------------------------------------------

        unique_name = (
            f"user_{user_id}_"
            f"workspace_{workspace_id}_"
            f"{int(time.time() * 1000)}_"
            f"{safe_name}"
        )

        file_path = (
            UPLOAD_DIR / unique_name
        )

        # -------------------------------------------------
        # Save physical file
        # -------------------------------------------------

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer,
            )

        file_size = file_path.stat().st_size

        # -------------------------------------------------
        # Save metadata
        # -------------------------------------------------

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

        # -------------------------------------------------
        # Automatically process documents
        # -------------------------------------------------

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

        # -------------------------------------------------
        # Return result
        # -------------------------------------------------

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
                    processing_result["page_count"]
                    if processing_result
                    else 0
                ),
                "chunk_count": (
                    processing_result["chunk_count"]
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
# DOCUMENT PROCESSING API
# =========================================================

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
            "message": "Research report cannot be empty.",
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
            "message": "Research report cannot be empty.",
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
            "message": "Research report cannot be empty.",
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
    Generate and return a research report as a XLSX file.
    """

    report = request.report or {}

    if not report:
        return {
            "success": False,
            "message": "Research report cannot be empty.",
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
def run_coding_agent(
    request: CodingRequest,
    workspace_id: int,
    current_user: dict = Depends(
        get_current_user
    ),
):
    """
    Run Nova AI Coding Agent.
    """

    # -------------------------------------------------
    # Validate workspace
    # -------------------------------------------------

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

    # -------------------------------------------------
    # Validate request
    # -------------------------------------------------

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

    # -------------------------------------------------
    # Execute Coding Agent
    # -------------------------------------------------

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