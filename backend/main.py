from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from settings import settings
from logging_config import setup_logging
from errors import not_found_error
from auth_routes import signup_user, login_user
from workspace_routes import create_workspace, get_user_workspaces
from document_routes import (
    create_document,
    get_workspace_documents,
    update_document,
    delete_document,
    get_document,
    search_documents,
)
from dependencies import get_current_user

setup_logging()

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/v1/test-error")
def test_error():
    not_found_error("Test resource not found")


@app.post("/api/v1/auth/signup")
def signup(name: str, email: str, password: str):
    return signup_user(name, email, password)


@app.post("/api/v1/auth/login")
def login(email: str, password: str):
    return login_user(email, password)


@app.post("/api/v1/workspaces")
def create_new_workspace(
    name: str,
    current_user: dict = Depends(get_current_user)
):
    return create_workspace(
        user_id=current_user["user_id"],
        name=name
    )


@app.get("/api/v1/workspaces")
def list_workspaces(
    current_user: dict = Depends(get_current_user)
):
    return get_user_workspaces(
        user_id=current_user["user_id"]
    )


@app.post("/api/v1/documents")
def create_new_document(
    workspace_id: int,
    title: str,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    return create_document(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        title=title,
        content=content
    )


@app.get("/api/v1/documents")
def list_documents(
    workspace_id: int,
    page: int = 1,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    return get_workspace_documents(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        page=page,
        limit=limit
    )


@app.get("/api/v1/documents/search")
def search_workspace_documents(
    workspace_id: int,
    query: str,
    current_user: dict = Depends(get_current_user)
):
    return search_documents(
        workspace_id=workspace_id,
        user_id=current_user["user_id"],
        query=query
    )


@app.get("/api/v1/documents/{document_id}")
def get_single_document(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    return get_document(
        document_id=document_id,
        user_id=current_user["user_id"]
    )


@app.put("/api/v1/documents/{document_id}")
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


@app.delete("/api/v1/documents/{document_id}")
def delete_existing_document(
    document_id: int,
    current_user: dict = Depends(get_current_user)
):
    return delete_document(
        document_id=document_id,
        user_id=current_user["user_id"]
    )