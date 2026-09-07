import { useEffect, useMemo, useState } from "react";
import "./CodingWorkspace.css";

function CodingWorkspace({
  workspace,
  onBack,
}) {
  const workspaceId =
    workspace?.id ||
    workspace?.workspace_id ||
    localStorage.getItem("nova_workspace_id") ||
    "default";

  const storageKey = `nova_coding_workspace_${workspaceId}`;

  const [language, setLanguage] = useState("Python");
  const [operation, setOperation] = useState("Generate");
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [stateHydrated, setStateHydrated] = useState(false);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000";

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

  // Restore saved coding state first.
  // Important: we do NOT save anything until hydration is complete.
  // This prevents the initial empty React state from overwriting
  // the previously saved data during a page refresh.
  useEffect(() => {
    let cancelled = false;

    try {
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (parsed.language) {
          setLanguage(parsed.language);
        }

        if (parsed.operation) {
          setOperation(parsed.operation);
        }

        if (typeof parsed.prompt === "string") {
          setPrompt(parsed.prompt);
        }

        if (typeof parsed.code === "string") {
          setCode(parsed.code);
        }

        if (typeof parsed.result === "string") {
          setResult(parsed.result);
        }
      }
    } catch (error) {
      console.error(
        "CODING STATE RESTORE ERROR:",
        error
      );
    } finally {
      if (!cancelled) {
        setStateHydrated(true);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Persist ONLY after the saved state has been restored.
  useEffect(() => {
    if (!stateHydrated) {
      return;
    }

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          language,
          operation,
          prompt,
          code,
          result,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error(
        "CODING STATE SAVE ERROR:",
        error
      );
    }
  }, [
    stateHydrated,
    storageKey,
    language,
    operation,
    prompt,
    code,
    result,
  ]);

  const extractCodeAndExplanation = (answer) => {
    const text = String(answer || "").trim();

    if (!text) {
      return {
        extractedCode: "",
        explanation: "",
      };
    }

    // Prefer fenced code blocks. This safely extracts the code that
    // should go into the Code Editor and leaves the surrounding
    // explanation for the AI Result panel.
    const fencedMatches = [
      ...text.matchAll(
        /```(?:[\w+#.-]+)?\s*\n([\s\S]*?)```/g
      ),
    ];

    if (fencedMatches.length > 0) {
      const extractedCode =
        String(fencedMatches[0][1] || "").trim();

      const explanation = text
        .replace(fencedMatches[0][0], "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return {
        extractedCode,
        explanation:
          explanation ||
          "Nova generated the code shown in the Code Editor.",
      };
    }

    // Some responses may not contain a fenced code block.
    // Keep the complete response as the explanation rather than
    // accidentally deleting useful content.
    return {
      extractedCode: "",
      explanation: text,
    };
  };

  const handleAction = async () => {
    if (!prompt.trim() && !code.trim()) {
      setResult("Please enter a prompt or code.");
      return;
    }

    if (!workspaceId || workspaceId === "default") {
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
    setCopyMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/coding/run?workspace_id=${workspaceId}`,
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
          normalizedError.includes("resource_exhausted") ||
          normalizedError.includes("quota")
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

      const answer =
        data.answer ||
        "Nova AI returned an empty response.";

      const {
        extractedCode,
        explanation,
      } = extractCodeAndExplanation(answer);

      // When Nova returns a code block, place ONLY the code in the
      // editor and keep the surrounding theory/explanation below.
      if (extractedCode) {
        setCode(extractedCode);
      }

      setResult(explanation);
    } catch (error) {
      const errorMessage =
        error?.message ||
        "Unknown error occurred.";

      const normalizedMessage =
        errorMessage.toLowerCase();

      if (
        normalizedMessage.includes("429") ||
        normalizedMessage.includes("resource_exhausted") ||
        normalizedMessage.includes("quota")
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
        setResult(`Error: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!code.trim()) {
      setCopyMessage("No code to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(code);

      setCopyMessage("Code copied ✅");

      window.setTimeout(() => {
        setCopyMessage("");
      }, 2000);
    } catch (error) {
      console.error(
        "COPY CODE ERROR:",
        error
      );

      setCopyMessage(
        "Unable to copy automatically. Please select and copy the code."
      );
    }
  };

  const handleClear = () => {
    setPrompt("");
    setCode("");
    setResult("");
    setCopyMessage("");

    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error(
        "CODING CLEAR ERROR:",
        error
      );
    }
  };

  const resultTitle = useMemo(() => {
    switch (operation) {
      case "Explain":
        return "AI Explanation";
      case "Debug":
        return "AI Debug Report";
      case "Optimize":
        return "AI Optimization Report";
      case "Test Cases":
        return "AI Test Cases";
      default:
        return "AI Result";
    }
  }, [operation]);

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
          type="button"
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
            onChange={(event) => {
              setLanguage(event.target.value);
              setCopyMessage("");
            }}
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
            onChange={(event) => {
              setOperation(event.target.value);
              setCopyMessage("");
            }}
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
          type="button"
        >
          {loading ? "Processing..." : "Run AI"}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={loading}
          className="run-button"
        >
          Clear
        </button>

      </div>

      {/* Main Panels */}
      <div className="coding-panels">

        {/* Prompt */}
        <div className="coding-panel">

          <div className="panel-header">
            Prompt
          </div>

          <textarea
            value={prompt}
            onChange={(event) =>
              setPrompt(event.target.value)
            }
            placeholder="Ask Nova what code you need..."
          />

        </div>

        {/* Code Editor */}
        <div className="coding-panel">

          <div className="panel-header coding-panel-header-with-action">
            <span>Code Editor</span>

            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!code.trim()}
              className="copy-code-button"
            >
              Copy Code
            </button>
          </div>

          <textarea
            className="code-editor"
            value={code}
            onChange={(event) =>
              setCode(event.target.value)
            }
            placeholder="// Nova's copy-ready code will appear here..."
            spellCheck="false"
          />

          {copyMessage && (
            <div className="copy-code-status">
              {copyMessage}
            </div>
          )}

        </div>

      </div>

      {/* AI Result / Theory */}
      <div className="result-panel">

        <div className="panel-header">
          {resultTitle}
        </div>

        <pre>
          {result ||
            "Nova's explanation, theory, approach and test information will appear here."}
        </pre>

      </div>

    </div>
  );
}

export default CodingWorkspace;
