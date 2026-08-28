import os


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
        "dev-secret-key-change-in-production"
    )

    ACCESS_TOKEN_EXPIRE_MINUTES = int(
        os.getenv(
            "ACCESS_TOKEN_EXPIRE_MINUTES",
            "60"
        )
    )


settings = Settings()