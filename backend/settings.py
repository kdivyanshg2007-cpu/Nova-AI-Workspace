import os

from dotenv import load_dotenv


# Load variables from backend/.env
load_dotenv()


class Settings:
    """Application configuration settings."""

    APP_NAME = os.getenv(
        "APP_NAME",
        "Nova AI Workspace"
    )

    ENVIRONMENT = os.getenv(
        "ENVIRONMENT",
        "development"
    )

    API_PREFIX = os.getenv(
        "API_PREFIX",
        "/api/v1"
    )

    SECRET_KEY = os.getenv(
        "SECRET_KEY",
        ""
    )

    ACCESS_TOKEN_EXPIRE_MINUTES = int(
        os.getenv(
            "ACCESS_TOKEN_EXPIRE_MINUTES",
            "60"
        )
    )

    OPENAI_API_KEY = os.getenv(
        "OPENAI_API_KEY",
        ""
    )

    OPENAI_MODEL = os.getenv(
        "OPENAI_MODEL",
        "gpt-5.6-luna"
    )

    GEMINI_API_KEY = os.getenv(
        "GEMINI_API_KEY",
        ""
    )

    GEMINI_MODEL = os.getenv(
        "GEMINI_MODEL",
        "gemini-2.5-flash"
    )


settings = Settings()


# =========================================================
# PRODUCTION SECURITY VALIDATION
# =========================================================

if settings.ENVIRONMENT.lower() == "production":

    if not settings.SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY must be configured "
            "when ENVIRONMENT=production."
        )

    if settings.SECRET_KEY == (
        "dev-secret-key-change-in-production"
    ):
        raise RuntimeError(
            "A production SECRET_KEY must be used."
        )