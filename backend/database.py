import psycopg2

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "nova_ai_workspace",
    "user": "postgres",
    "password": "NovaDB@2026",
}


def get_connection():
    return psycopg2.connect(**DB_CONFIG)