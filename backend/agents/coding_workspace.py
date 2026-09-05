from dataclasses import dataclass, field
from typing import Any


@dataclass
class CodingSession:
    """
    Stores one coding workspace session.
    """

    session_id: str
    language: str = "python"
    code: str = ""
    history: list[dict[str, Any]] = field(
        default_factory=list
    )

    def add_history(
        self,
        operation: str,
        prompt: str,
        result: str,
    ):
        self.history.append(
            {
                "operation": operation,
                "prompt": prompt,
                "result": result,
            }
        )

    def to_dict(self):
        return {
            "session_id": self.session_id,
            "language": self.language,
            "code": self.code,
            "history": self.history,
        }


class CodingWorkspace:
    """
    Manages coding workspace sessions.
    """

    def __init__(self):
        self.sessions: dict[str, CodingSession] = {}

    def create_session(
        self,
        session_id: str,
        language: str = "python",
    ) -> CodingSession:

        if session_id in self.sessions:
            return self.sessions[session_id]

        session = CodingSession(
            session_id=session_id,
            language=language,
        )

        self.sessions[session_id] = session

        return session

    def get_session(
        self,
        session_id: str,
    ) -> CodingSession | None:

        return self.sessions.get(session_id)

    def update_code(
        self,
        session_id: str,
        code: str,
    ):

        session = self.get_session(session_id)

        if session is None:
            raise ValueError(
                f"Session '{session_id}' not found."
            )

        session.code = code

    def set_language(
        self,
        session_id: str,
        language: str,
    ):

        session = self.get_session(session_id)

        if session is None:
            raise ValueError(
                f"Session '{session_id}' not found."
            )

        session.language = language

    def add_result(
        self,
        session_id: str,
        operation: str,
        prompt: str,
        result: str,
    ):

        session = self.get_session(session_id)

        if session is None:
            raise ValueError(
                f"Session '{session_id}' not found."
            )

        session.add_history(
            operation,
            prompt,
            result,
        )

    def get_history(
        self,
        session_id: str,
    ):

        session = self.get_session(session_id)

        if session is None:
            raise ValueError(
                f"Session '{session_id}' not found."
            )

        return session.history.copy()


def get_coding_workspace():
    return CodingWorkspace()