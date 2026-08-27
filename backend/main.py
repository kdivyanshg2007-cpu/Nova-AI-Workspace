from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from settings import settings
from logging_config import setup_logging
from errors import not_found_error
from auth_routes import signup_user, login_user
from workspace_routes import create_workspace, get_user_workspaces
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