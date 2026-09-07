import os

import psycopg2


DATABASE_URL = os.getenv("DATABASE_URL")


DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "nova_ai_workspace",
    "user": "postgres",
    "password": "NovaDB@2026",
}


def get_connection():
    """
    Use Render's DATABASE_URL in production.
    Fall back to local PostgreSQL settings during local development.
    """

    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)

    return psycopg2.connect(**DB_CONFIG)