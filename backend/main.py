from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from settings import settings
from logging_config import setup_logging
from errors import not_found_error
from auth_routes import signup_user, login_user

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