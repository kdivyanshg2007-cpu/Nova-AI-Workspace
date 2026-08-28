from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from settings import settings
from logging_config import setup_logging
from errors import not_found_error
from auth_routes import signup_user, login_user
from workspace_routes import (
    create_workspace,
    get_user_workspaces,
    verify_workspace_ownership,
)
from document_routes import (
    create_document,
    get_workspace_documents,
    update_document,
    delete_document,
    get_document,
    search_documents,
)
from dependencies import get_current_user


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


setup_logging()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Nova AI Workspace Backend API",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/api/v1/health",
    response_model=HealthResponse
)
def health_check():
    return {"status": "ok"}


@app.get("/api/v1/test-error")
def test_error():
    not_found_error("Test resource not found")


@app.post(
    "/api/v1/auth/signup",
    response_model=APIResponse
)
def signup(
    name: str,
    email: str,
    password: str
):
    return signup_user(name, email, password)


@app.post(
    "/api/v1/auth/login",
    response_model=APIResponse
)
def login(
    email: str,
    password: str
):
    return login_user(email, password)


@app.post(
    "/api/v1/workspaces",
    response_model=APIResponse
)
def create_new_workspace(
    name: str,
    current_user: dict = Depends(get_current_user)
):
    return create_workspace(
        user_id=current_user["user_id"],
        name=name
    )


@app.get(
    "/api/v1/workspaces",
    response_model=APIResponse
)
def list_workspaces(
    current_user: dict = Depends(get_current_user)
):
    return get_user_workspaces(
        user_id=current_user["user_id"]
    )


@app.post(
    "/api/v1/documents",
    response_model=APIResponse
)
def create_new_document(
    workspace_id: int,
    title: str,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"]
    ):
        return {
            "success": False,
            "message": "Workspace not found or access denied."
        }

    return create_document(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        title=title,
        content=content
    )


@app.get(
    "/api/v1/documents",
    response_model=APIResponse
)
def list_documents(
    workspace_id: int,
    page: int = 1,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"]
    ):
        return {
            "success": False,
            "message": "Workspace not found or access denied."
        }

    return get_workspace_documents(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        page=page,
        limit=limit
    )


@app.get(
    "/api/v1/documents/search",
    response_model=APIResponse
)
def search_workspace_documents(
    workspace_id: int,
    query: str,
    current_user: dict = Depends(get_current_user)
):
    if not verify_workspace_ownership(
        workspace_id=workspace_id,
        user_id=current_user["user_id"]
    ):
        return {
            "success": False,
            "message": "Workspace not found or access denied."
        }

    return search_documents(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        query=query
    )


@app.get(
    "/api/v1/documents/{document_id}",
    response_model=APIResponse
)
def get_single_document(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    return get_document(
        document_id=document_id,
        user_id=current_user["user_id"]
    )


@app.put(
    "/api/v1/documents/{document_id}",
    response_model=APIResponse
)
def update_existing_document(
    document_id: int,
    title: str,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    return update_document(
        document_id=document_id,
        user_id=current_user["user_id"],
        title=title,
        content=content
    )


@app.delete(
    "/api/v1/documents/{document_id}",
    response_model=APIResponse
)
def delete_existing_document(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    return delete_document(
        document_id=document_id,
        user_id=current_user["user_id"]
    )