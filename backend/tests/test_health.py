from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


# =========================================================
# BASIC API TESTS
# =========================================================

def test_health():
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_error_endpoint():
    response = client.get("/api/v1/test-error")

    assert response.status_code == 404


# =========================================================
# AUTHENTICATION / SECURITY TESTS
# =========================================================

def test_protected_workspaces_without_token():
    response = client.get("/api/v1/workspaces")

    assert response.status_code == 401


def test_protected_workspaces_with_invalid_token():
    response = client.get(
        "/api/v1/workspaces",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401


def test_protected_chat_without_token():
    response = client.get("/api/v1/chat/messages")

    assert response.status_code == 401


def test_protected_chat_post_without_token():
    response = client.post(
        "/api/v1/chat/messages",
        params={
            "workspace_id": 1,
            "message": "Hello Nova",
        },
    )

    assert response.status_code == 401


# =========================================================
# DOCUMENT API TESTS
# =========================================================

def test_documents_without_token():
    response = client.get(
        "/api/v1/documents",
        params={"workspace_id": 1},
    )

    assert response.status_code == 401


def test_create_document_without_token():
    response = client.post(
        "/api/v1/documents",
        params={
            "workspace_id": 1,
            "title": "Test Document",
            "content": "Hello",
        },
    )

    assert response.status_code == 401


def test_ask_document_without_token():
    response = client.post(
        "/api/v1/documents/ask",
        params={
            "question": "What is this document?",
            "workspace_id": 1,
        },
    )

    assert response.status_code == 401


def test_process_document_without_token():
    response = client.post(
        "/api/v1/documents/process",
        params={"file_id": 1},
    )

    assert response.status_code == 401


# =========================================================
# CONVERSATION API TESTS
# =========================================================

def test_conversations_without_token():
    response = client.get(
        "/api/v1/chat/conversations",
        params={"workspace_id": 1},
    )

    assert response.status_code == 401


def test_create_conversation_without_token():
    response = client.post(
        "/api/v1/chat/conversations",
        params={
            "workspace_id": 1,
            "title": "Test Chat",
        },
    )

    assert response.status_code == 401


# =========================================================
# AUTH INPUT VALIDATION
# =========================================================

def test_signup_missing_fields():
    response = client.post("/api/v1/auth/signup")

    assert response.status_code == 422


def test_login_missing_fields():
    response = client.post("/api/v1/auth/login")

    assert response.status_code == 422