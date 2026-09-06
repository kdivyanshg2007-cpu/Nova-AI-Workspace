import { useState } from "react";
import "./CodingWorkspace.css";

function CodingWorkspace({
  workspace,
  onBack,
}) {
  const [language, setLanguage] = useState("Python");
  const [operation, setOperation] = useState("Generate");
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const operations = [
    "Generate",
    "Explain",
    "Debug",
    "Optimize",
    "Test Cases",
  ];

  const operationMap = {
    Generate: "generate",
    Explain: "explain",
    Debug: "debug",
    Optimize: "optimize",
    "Test Cases": "test_cases",
  };

  const handleAction = async () => {
    if (!prompt.trim() && !code.trim()) {
      setResult("Please enter a prompt or code.");
      return;
    }

    if (!workspace?.id) {
      setResult("Workspace ID is missing.");
      return;
    }

    const token = localStorage.getItem("nova_token");

    if (!token) {
      setResult("You are not logged in.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/coding/run?workspace_id=${workspace.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            task:
              prompt.trim() ||
              `Perform ${operation} on the provided code.`,
            code,
            language: language.toLowerCase(),
            operation:
              operationMap[operation] || "generate",
          }),
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Backend returned HTTP ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            data?.message ||
            `Request failed with status ${response.status}.`
        );
      }

      if (!data.success) {
        const errorMessage =
          data.error ||
          data.message ||
          "Coding agent failed.";

        const normalizedError =
          String(errorMessage).toLowerCase();

        if (
          normalizedError.includes("429") ||
          normalizedError.includes("resource_exhausted")
        ) {
          setResult(
            "Nova AI usage limit has been reached. Please try again later."
          );
        } else if (
          normalizedError.includes("503") ||
          normalizedError.includes("unavailable")
        ) {
          setResult(
            "Nova AI is temporarily unavailable. Please try again later."
          );
        } else {
          setResult(errorMessage);
        }

        return;
      }

      setResult(
        data.answer ||
          "Nova AI returned an empty response."
      );
    } catch (error) {
      const message =
        error?.message || "Unknown error occurred.";

      const normalizedMessage =
        message.toLowerCase();

      if (
        normalizedMessage.includes("429") ||
        normalizedMessage.includes("resource_exhausted")
      ) {
        setResult(
          "Nova AI usage limit has been reached. Please try again later."
        );
      } else if (
        normalizedMessage.includes("503") ||
        normalizedMessage.includes("unavailable")
      ) {
        setResult(
          "Nova AI is temporarily unavailable. Please try again later."
        );
      } else if (
        normalizedMessage.includes("failed to fetch")
      ) {
        setResult(
          "Cannot connect to Nova AI backend. Please make sure the backend server is running."
        );
      } else {
        setResult(`Error: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="coding-workspace">

      {/* Top Navigation Header */}
      <header className="coding-topbar">

        <div className="coding-brand">
          <div className="coding-title">
            Nova AI Coding Workspace
          </div>

          <div className="coding-subtitle">
            Generate, explain, debug and optimize code with AI.
          </div>

          {workspace?.name && (
            <div className="coding-workspace-name">
              Workspace: {workspace.name}
            </div>
          )}
        </div>

        <button
          className="back-button"
          onClick={onBack}
        >
          ← Back to Workspace
        </button>

      </header>

      {/* Toolbar */}
      <div className="coding-toolbar">

        <div className="toolbar-group">
          <label htmlFor="language">
            Language
          </label>

          <select
            id="language"
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value)
            }
          >
            <option>Python</option>
            <option>JavaScript</option>
            <option>TypeScript</option>
            <option>C++</option>
            <option>Java</option>
          </select>
        </div>

        <div className="toolbar-group">
          <label htmlFor="operation">
            Action
          </label>

          <select
            id="operation"
            value={operation}
            onChange={(event) =>
              setOperation(event.target.value)
            }
          >
            {operations.map((item) => (
              <option key={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <button
          className="run-button"
          onClick={handleAction}
          disabled={loading}
        >
          {loading ? "Processing..." : "Run AI"}
        </button>

      </div>

      {/* Main Panels */}
      <div className="coding-panels">

        <div className="coding-panel">

          <div className="panel-header">
            Prompt
          </div>

          <textarea
            value={prompt}
            onChange={(event) =>
              setPrompt(event.target.value)
            }
            placeholder="Ask Nova to generate, explain, debug or optimize code..."
          />

        </div>

        <div className="coding-panel">

          <div className="panel-header">
            Code Editor
          </div>

          <textarea
            className="code-editor"
            value={code}
            onChange={(event) =>
              setCode(event.target.value)
            }
            placeholder="// Write or paste your code here..."
            spellCheck="false"
          />

        </div>

      </div>

      {/* AI Result */}
      <div className="result-panel">

        <div className="panel-header">
          AI Result
        </div>

        <pre>
          {result ||
            "Your AI-generated result will appear here."}
        </pre>

      </div>

    </div>
  );
}

export default CodingWorkspace;