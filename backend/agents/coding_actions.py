from agents.coding_agent import CodingAgent


class CodingActions:
    """
    High-level actions for the Coding Workspace.
    """

    def __init__(self):
        self.agent = CodingAgent()

    def generate(
        self,
        prompt: str,
        language: str = "python",
        code: str = "",
    ):
        return self.agent.run(
            task=prompt,
            code=code,
            language=language,
            operation="generate",
        )

    def explain(
        self,
        code: str,
        language: str = "python",
    ):
        return self.agent.run(
            task="Explain this code in simple language.",
            code=code,
            language=language,
            operation="explain",
        )

    def debug(
        self,
        code: str,
        language: str = "python",
    ):
        return self.agent.run(
            task="Find and fix errors in this code.",
            code=code,
            language=language,
            operation="debug",
        )

    def optimize(
        self,
        code: str,
        language: str = "python",
    ):
        return self.agent.run(
            task="Optimize this code and explain the improvements.",
            code=code,
            language=language,
            operation="optimize",
        )

    def test_cases(
        self,
        code: str,
        language: str = "python",
    ):
        return self.agent.run(
            task="Generate useful test cases for this code.",
            code=code,
            language=language,
            operation="test_cases",
        )


def get_coding_actions():
    return CodingActions()