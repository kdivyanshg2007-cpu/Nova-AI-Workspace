import document_qa
import retrieval_service


class FakeSettings:
    GEMINI_API_KEY = "test-key"
    GEMINI_MODEL = "test-model"


class FakeResponse:
    def __init__(self, text):
        self.text = text


class FakeModels:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response


class FakeClient:
    def __init__(self, api_key, models):
        self.api_key = api_key
        self.models = models


def test_ask_document_passes_authenticated_user_id(monkeypatch):
    monkeypatch.setattr(document_qa, "settings", FakeSettings())

    captured = {}

    def fake_retrieve(**kwargs):
        captured.update(kwargs)
        return [
            {
                "file_id": 7,
                "filename": "notes.pdf",
                "page": 2,
                "chunk_id": 11,
                "similarity": 0.91,
                "content": "Nova is a productivity workspace.",
            }
        ]

    models = FakeModels(response=FakeResponse("Nova is a productivity workspace."))
    monkeypatch.setattr(document_qa, "retrieve_relevant_chunks", fake_retrieve)
    monkeypatch.setattr(
        document_qa.genai,
        "Client",
        lambda api_key: FakeClient(api_key, models),
    )

    result = document_qa.ask_document(
        question="What is Nova?",
        workspace_id=12,
        user_id=34,
        top_k=5,
    )

    assert result["success"] is True
    assert result["answer"] == "Nova is a productivity workspace."
    assert captured["workspace_id"] == 12
    assert captured["user_id"] == 34
    assert captured["top_k"] == 5


def test_ask_document_handles_missing_chunk_metadata(monkeypatch):
    monkeypatch.setattr(document_qa, "settings", FakeSettings())

    def fake_retrieve(**kwargs):
        return [
            {"content": ""},
            {
                "content": "Usable chunk content.",
                "similarity": "not-a-number",
            },
        ]

    models = FakeModels(response=FakeResponse("Usable answer."))
    monkeypatch.setattr(document_qa, "retrieve_relevant_chunks", fake_retrieve)
    monkeypatch.setattr(
        document_qa.genai,
        "Client",
        lambda api_key: FakeClient(api_key, models),
    )

    result = document_qa.ask_document(
        question="What is this?",
        workspace_id=1,
        user_id=2,
    )

    assert result["success"] is True
    assert result["answer"] == "Usable answer."
    assert len(result["sources"]) == 1
    assert result["sources"][0]["filename"] == "Unknown document"
    assert result["sources"][0]["similarity"] is None


def test_ask_document_returns_friendly_retrieval_error(monkeypatch):
    monkeypatch.setattr(document_qa, "settings", FakeSettings())

    def failing_retrieve(**kwargs):
        raise RuntimeError("database down")

    monkeypatch.setattr(document_qa, "retrieve_relevant_chunks", failing_retrieve)

    result = document_qa.ask_document(
        question="Anything?",
        workspace_id=1,
        user_id=2,
    )

    assert result["success"] is False
    assert "temporarily unavailable" in result["message"].lower()




def test_retrieval_scopes_query_to_authenticated_user(monkeypatch):
    class FakeCursor:
        def __init__(self):
            self.executed_sql = ""
            self.executed_params = None

        def execute(self, sql, params=None):
            self.executed_sql = sql
            self.executed_params = params

        def fetchall(self):
            return [
                (
                    1,          # chunk id
                    10,         # document id
                    20,         # workspace id
                    30,         # user id
                    0,          # chunk index
                    "Nova document content",
                    '[1, 0]',   # JSON embedding
                    "doc.pdf",
                    5,          # file id
                    1,          # page
                )
            ]

        def close(self):
            pass

    class FakeConnection:
        def __init__(self):
            self.cursor_instance = FakeCursor()

        def cursor(self):
            return self.cursor_instance

        def close(self):
            pass

    connection = FakeConnection()

    monkeypatch.setattr(
        retrieval_service,
        "get_connection",
        lambda: connection,
    )
    monkeypatch.setattr(
        retrieval_service,
        "get_document_chunks_columns",
        lambda cursor: {"id", "document_id", "workspace_id", "user_id", "file_id", "page", "content"},
    )
    monkeypatch.setattr(
        retrieval_service,
        "get_embedding_table_exists",
        lambda cursor: True,
    )
    monkeypatch.setattr(
        retrieval_service,
        "generate_embedding",
        lambda query: [1.0, 0.0],
    )
    monkeypatch.setattr(
        retrieval_service,
        "parse_json_embedding",
        lambda value: [1.0, 0.0],
    )
    monkeypatch.setattr(
        retrieval_service,
        "cosine_similarity",
        lambda a, b: 1.0,
    )

    results = retrieval_service.retrieve_relevant_chunks(
        query="Nova",
        top_k=5,
        workspace_id=20,
        user_id=30,
    )

    sql = connection.cursor_instance.executed_sql
    params = connection.cursor_instance.executed_params

    assert "dc.user_id = %s" in sql
    assert "f.user_id" not in sql
    assert params == (20, 30)
    assert results[0]["user_id"] == 30


def test_ask_document_returns_friendly_gemini_error(monkeypatch):
    monkeypatch.setattr(document_qa, "settings", FakeSettings())

    monkeypatch.setattr(
        document_qa,
        "retrieve_relevant_chunks",
        lambda **kwargs: [
            {
                "content": "Grounded content.",
                "filename": "doc.pdf",
                "page": 1,
                "file_id": 1,
                "chunk_id": 2,
                "similarity": 0.8,
            }
        ],
    )

    models = FakeModels(error=RuntimeError("Gemini unavailable"))
    monkeypatch.setattr(
        document_qa.genai,
        "Client",
        lambda api_key: FakeClient(api_key, models),
    )

    result = document_qa.ask_document(
        question="Anything?",
        workspace_id=1,
        user_id=2,
    )

    assert result["success"] is False
    assert "AI service" in result["message"]
