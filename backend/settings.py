import os


class Settings:
    APP_NAME = os.getenv("APP_NAME", "Nova AI Workspace")
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    API_PREFIX = os.getenv("API_PREFIX", "/api/v1")


settings = Settings()