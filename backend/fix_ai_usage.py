from pathlib import Path
import shutil


# ---------------------------------------------------------
# Project root
# This script is being run from the backend folder.
# ---------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
ROOT = BACKEND_DIR.parent


def backup(path: Path) -> None:
    backup_path = path.with_name(path.name + ".bak")
    shutil.copy2(path, backup_path)
    print(f"BACKUP: {backup_path.relative_to(ROOT)}")


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")

    if old not in text:
        raise SystemExit(
            f"ERROR: expected text not found in {label}"
        )

    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")

    print(f"UPDATED: {label}")


# =========================================================
# 1. ai_service.py
# =========================================================

ai_service = BACKEND_DIR / "ai_service.py"
backup(ai_service)

replace_once(
    ai_service,
    """def generate_ai_response(
    message: str,
    conversation_history: list | None = None,
    file_path: str | None = None,
    user_id: int | None = None,
) -> str:""",
    """def generate_ai_response(
    message: str,
    conversation_history: list | None = None,
    file_path: str | None = None,
    user_id: int | None = None,
    workspace_id: int | None = None,
) -> str:""",
    "backend/ai_service.py function signature",
)


usage_logging_code = r'''
        # =================================================
        # AI USAGE LOGGING
        # =================================================
        # Usage logging is best-effort.
        # It must never break the AI response.

        usage_metadata = getattr(
            response,
            "usage_metadata",
            None,
        )

        input_tokens = int(
            getattr(
                usage_metadata,
                "prompt_token_count",
                0,
            )
            or 0
        )

        output_tokens = int(
            getattr(
                usage_metadata,
                "candidates_token_count",
                0,
            )
            or 0
        )

        total_tokens = input_tokens + output_tokens

        usage_connection = None
        usage_cursor = None

        try:
            usage_connection = get_connection()
            usage_cursor = usage_connection.cursor()

            usage_sql = (
                "INSERT INTO ai_usage_logs "
                "(user_id, workspace_id, provider, model, "
                "input_tokens, output_tokens, total_tokens, estimated_cost) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s);"
            )

            usage_values = (
                user_id,
                workspace_id,
                "gemini",
                model_name,
                input_tokens,
                output_tokens,
                total_tokens,
                0,
            )

            usage_cursor.execute(
                usage_sql,
                usage_values,
            )

            usage_connection.commit()

        except Exception as usage_error:
            print(
                "AI USAGE LOG ERROR:",
                repr(usage_error),
            )

            if usage_connection is not None:
                try:
                    usage_connection.rollback()
                except Exception:
                    pass

        finally:
            if usage_cursor is not None:
                try:
                    usage_cursor.close()
                except Exception:
                    pass

            if usage_connection is not None:
                try:
                    usage_connection.close()
                except Exception:
                    pass
'''


replace_once(
    ai_service,
    """        return (
            response.text
            or "Nova returned an empty response."
        )""",
    usage_logging_code
    + r'''
        return (
            response.text
            or "Nova returned an empty response."
        )''',
    "backend/ai_service.py usage logging",
)


# =========================================================
# 2. chat_routes.py
# =========================================================

chat_routes = BACKEND_DIR / "chat_routes.py"
backup(chat_routes)

replace_once(
    chat_routes,
    """    ai_response = generate_ai_response(
        message=message,
        conversation_history=conversation_history,
        file_path=file_path,
        user_id=user_id,
    )""",
    """    ai_response = generate_ai_response(
        message=message,
        conversation_history=conversation_history,
        file_path=file_path,
        user_id=user_id,
        workspace_id=workspace_id,
    )""",
    "backend/chat_routes.py AI call",
)


# =========================================================
# 3. main.py
# =========================================================

main_py = BACKEND_DIR / "main.py"
backup(main_py)

main_text = main_py.read_text(encoding="utf-8")

if "from usage_routes import router as usage_router" not in main_text:

    import_marker = (
        "from evaluation_routes import router as evaluation_router\n"
    )

    if import_marker not in main_text:
        raise SystemExit(
            "ERROR: evaluation_routes import not found in main.py"
        )

    main_text = main_text.replace(
        import_marker,
        import_marker
        + "from usage_routes import router as usage_router\n",
        1,
    )

if "app.include_router(usage_router)" not in main_text:

    router_marker = (
        "app.include_router(evaluation_router)\n"
    )

    if router_marker not in main_text:
        raise SystemExit(
            "ERROR: evaluation router registration not found"
        )

    main_text = main_text.replace(
        router_marker,
        router_marker
        + "app.include_router(usage_router)\n",
        1,
    )

main_py.write_text(
    main_text,
    encoding="utf-8",
)

print("UPDATED: backend/main.py")


# =========================================================
# 4. Dashboard.jsx
# =========================================================

dashboard = (
    ROOT
    / "frontend"
    / "src"
    / "pages"
    / "Dashboard.jsx"
)

backup(dashboard)

replace_once(
    dashboard,
    """      setUsageLogs(
        data.usage_logs || []
      );""",
    """      setUsageLogs(
        data.usage || []
      );""",
    "frontend/src/pages/Dashboard.jsx usage response",
)


# =========================================================
# DONE
# =========================================================

print()
print("==============================================")
print("AI USAGE LOGGING FIX APPLIED SUCCESSFULLY")
print("==============================================")
print()
print("Backup files were created with .bak extension.")
print()
print("NEXT:")
print("1. Restart the FastAPI backend.")
print("2. Refresh the frontend.")
print("3. Open Dashboard.")
print("4. Open Test Workspace -> Chat.")
print("5. Send: Hello Nova")
print("6. Return to Dashboard.")
print("7. Check AI Usage.")