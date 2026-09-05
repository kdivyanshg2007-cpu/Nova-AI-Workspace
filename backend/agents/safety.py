import re


class AgentSafety:
    """
    Basic safety checks for Nova AI agents.
    """

    BLOCKED_PATTERNS = [
        r"delete\s+all",
        r"drop\s+database",
        r"rm\s+-rf",
        r"format\s+drive",
        r"steal\s+password",
        r"show\s+api\s+key",
        r"reveal\s+secret",
    ]

    def check_query(self, query: str) -> dict:
        """
        Check a user query for obviously dangerous requests.
        """

        query = query.strip().lower()

        if not query:
            return {
                "allowed": False,
                "reason": "Empty query",
            }

        for pattern in self.BLOCKED_PATTERNS:
            if re.search(pattern, query):
                return {
                    "allowed": False,
                    "reason": "Potentially dangerous request",
                }

        return {
            "allowed": True,
            "reason": "Query passed safety checks",
        }

    def requires_confirmation(self, action: str) -> bool:
        """
        Mark potentially consequential actions for confirmation.
        """

        confirmation_actions = {
            "delete",
            "send",
            "publish",
            "external_request",
            "modify_data",
        }

        return action.lower() in confirmation_actions


def get_agent_safety():
    return AgentSafety()