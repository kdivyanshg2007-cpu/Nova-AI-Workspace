import { useEffect, useState } from "react";
import "./ResearchWorkspace.css";

function ResearchWorkspace({ workspace, onBack }) {
  const workspaceId = workspace?.id || "default";
  const historyKey =
    "nova_research_history_" + workspaceId;

  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedSource, setSelectedSource] = useState(null);

  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [shareId, setShareId] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const [history, setHistory] = useState(() => {
    try {
      const savedHistory =
        localStorage.getItem(historyKey);

      return savedHistory
        ? JSON.parse(savedHistory)
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        historyKey,
        JSON.stringify(history)
      );
    } catch {}
  }, [history, historyKey]);

  const saveHistory = ({
    queryText,
    answerText,
    sourceList,
    reportData,
  }) => {
    const historyItem = {
      id: Date.now(),
      query: queryText,
      answer: answerText,
      sources: sourceList,
      report: reportData,
      createdAt: new Date().toLocaleString(),
    };

    setHistory((previousHistory) => [
      historyItem,
      ...previousHistory,
    ]);
  };

  const handleResearch = async () => {
    if (!query.trim()) {
      setAnswer("Please enter a research question.");
      return;
    }

    if (!workspace?.id) {
      setAnswer("Workspace ID is missing.");
      return;
    }

    const token =
      localStorage.getItem("nova_token");

    if (!token) {
      setAnswer("You are not logged in.");
      return;
    }

    setLoading(true);
    setSelectedSource(null);
    setShowSharePanel(false);
    setShareMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/research/run?workspace_id=` +
          workspace.id,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            query: query.trim(),
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      const backendError = String(
        data?.detail ||
          data?.error ||
          data?.message ||
          ""
      );

      const normalizedError =
        backendError.toLowerCase();

      if (response.status === 429) {
        setAnswer(
          "Nova Research is temporarily unavailable because the AI service quota has been reached. You can use Demo Research meanwhile."
        );
        return;
      }

      if (
        normalizedError.includes("resource_exhausted") ||
        normalizedError.includes("quota") ||
        normalizedError.includes("rate limit") ||
        normalizedError.includes("too many requests")
      ) {
        setAnswer(
          "Nova Research is temporarily unavailable because the AI service quota has been reached. You can use Demo Research meanwhile."
        );
        return;
      }

      if (
        response.status === 503 ||
        normalizedError.includes("service unavailable") ||
        normalizedError.includes("temporarily unavailable")
      ) {
        setAnswer(
          "Nova Research is temporarily unavailable. Please try again later."
        );
        return;
      }

      if (response.status === 401) {
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");

        setAnswer(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setAnswer(
          backendError ||
            `Research request failed. Status: ${response.status}`
        );
        return;
      }

      if (!data.success) {
        const errorMessage =
          data.error ||
          data.message ||
          "Research agent failed.";

        const normalizedMessage =
          String(errorMessage).toLowerCase();

        if (
          normalizedMessage.includes("429") ||
          normalizedMessage.includes("resource_exhausted") ||
          normalizedMessage.includes("quota") ||
          normalizedMessage.includes("rate limit")
        ) {
          setAnswer(
            "Nova Research is temporarily unavailable because the AI service quota has been reached. You can use Demo Research meanwhile."
          );
        } else {
          setAnswer(errorMessage);
        }

        return;
      }

      const researchAnswer =
        data.answer ||
        data.data?.summary ||
        "No research answer returned.";

      const researchSources =
        data.sources ||
        data.data?.citations ||
        data.data?.sources ||
        [];

      const researchReport =
        data.data?.report || null;

      setAnswer(researchAnswer);
      setSources(researchSources);
      setReport(researchReport);

      saveHistory({
        queryText: query.trim(),
        answerText: researchAnswer,
        sourceList: researchSources,
        reportData: researchReport,
      });
    } catch (error) {
      const errorMessage = String(
        error?.message ||
          "Unknown error occurred."
      );

      const normalizedMessage =
        errorMessage.toLowerCase();

      if (
        normalizedMessage.includes("429") ||
        normalizedMessage.includes("resource_exhausted") ||
        normalizedMessage.includes("quota") ||
        normalizedMessage.includes("rate limit")
      ) {
        setAnswer(
          "Nova Research is temporarily unavailable because the AI service quota has been reached. You can use Demo Research meanwhile."
        );
      } else if (
        normalizedMessage.includes("503") ||
        normalizedMessage.includes("unavailable")
      ) {
        setAnswer(
          "Nova Research is temporarily unavailable. Please try again later."
        );
      } else if (
        normalizedMessage.includes("failed to fetch") ||
        normalizedMessage.includes("networkerror")
      ) {
        setAnswer(
          "Cannot connect to Nova Research backend. Please make sure the backend server is running."
        );
      } else {
        setAnswer(
          "Research error: " + errorMessage
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMockResearch = () => {
    if (!query.trim()) {
      setAnswer("Please enter a research question.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const demoAnswer =
        "Artificial Intelligence (AI) is a technology that enables computers and machines to perform tasks that normally require human intelligence, such as learning, reasoning, problem-solving and understanding information.";

      const demoSources = [
        {
          title: "Artificial Intelligence - Wikipedia",
          url: "https://en.wikipedia.org/wiki/Artificial_intelligence",
          source_type: "web",
          description:
            "A general overview of artificial intelligence.",
        },
        {
          title: "Artificial Intelligence - IBM",
          url: "https://www.ibm.com/think/topics/artificial-intelligence",
          source_type: "web",
          description:
            "IBM's overview of artificial intelligence.",
        },
        {
          title: "Artificial Intelligence - Google Cloud",
          url: "https://cloud.google.com/learn/what-is-artificial-intelligence",
          source_type: "web",
          description:
            "Google Cloud's explanation of artificial intelligence.",
        },
        {
          title: "Artificial Intelligence - Britannica",
          url: "https://www.britannica.com/technology/artificial-intelligence",
          source_type: "reference",
          description:
            "Reference information about artificial intelligence.",
        },
      ];

      const demoReport = {
        title:
          "Research Report: " + query.trim(),
        query: query.trim(),
        summary: demoAnswer,
        key_findings: [
          "AI enables machines to perform intelligent tasks.",
          "AI can learn, reason and solve problems.",
          "AI is used in many practical applications.",
        ],
        citations: demoSources.map(
          (source, index) => ({
            id: index + 1,
            title: source.title,
            url: source.url,
            source_type: source.source_type,
          })
        ),
        source_count: demoSources.length,
      };

      setAnswer(demoAnswer);
      setSources(demoSources);
      setReport(demoReport);
      setSourceFilter("all");
      setSelectedSource(null);
      setShowSharePanel(false);
      setShareMessage("");

      saveHistory({
        queryText: query.trim(),
        answerText: demoAnswer,
        sourceList: demoSources,
        reportData: demoReport,
      });

      setLoading(false);
    }, 700);
  };

  const handleExportTxt = () => {
    if (!report) {
      setAnswer(
        "Please generate a research report before exporting."
      );
      return;
    }

    const lines = [];

    lines.push(
      report.title ||
        "Nova AI Research Report"
    );

    lines.push("");

    lines.push(
      "Query: " +
        (report.query || query)
    );

    lines.push("");

    lines.push("SUMMARY");

    lines.push(
      report.summary ||
        answer ||
        ""
    );

    lines.push("");

    lines.push("KEY FINDINGS");

    (report.key_findings || []).forEach(
      (finding, index) => {
        lines.push(
          index + 1 + ". " + finding
        );
      }
    );

    lines.push("");

    lines.push("SOURCES & CITATIONS");

    const citations =
      report.citations || sources;

    citations.forEach(
      (citation, index) => {
        lines.push(
          "[" +
            (citation.id || index + 1) +
            "] " +
            (citation.title ||
              "Web Source")
        );

        if (citation.url) {
          lines.push(
            "URL: " +
              citation.url
          );
        }

        lines.push("");
      }
    );

    const blob = new Blob(
      [lines.join("\n")],
      {
        type:
          "text/plain;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "research_report.txt";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!report) {
      setAnswer(
        "Please generate a research report before exporting."
      );
      return;
    }

    const token =
      localStorage.getItem("nova_token");

    if (!token) {
      setAnswer("You are not logged in.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/research/export-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              "Bearer " + token,
          },
          body: JSON.stringify({
            report,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "PDF export failed."
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        "research_report.pdf";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      setAnswer(
        "PDF export error: " +
          (error?.message || "")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!report) {
      setAnswer(
        "Please generate a research report before sharing."
      );
      return;
    }

    const token = localStorage.getItem("nova_token");

    if (!token) {
      setAnswer("You are not logged in.");
      return;
    }

    setShowSharePanel(true);
    setShareMessage("Creating share link...");
    setShareId("");
    setShareUrl("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/research/share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            report: report,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Unable to create share link."
        );
      }

      if (!data.success) {
        throw new Error(
          data.message ||
            "Unable to create share link."
        );
      }

      const backendUrl = data.share_url || "";

      const fullUrl = backendUrl.startsWith("http")
        ? backendUrl
        : API_BASE_URL + backendUrl;

      setShareId(data.share_id || "");
      setShareUrl(fullUrl);
      setShareMessage("Share link created successfully.");
    } catch (error) {
      setShareMessage(
        "Share error: " +
          (error?.message || "Unable to create share link.")
      );
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Share link copied successfully.");
    } catch {
      setShareMessage("Unable to copy share link.");
    }
  };

  const handleCopyShareData = async () => {
    if (!report) {
      return;
    }

    const shareText =
      (report.title ||
        "Nova AI Research Report") +
      "\n\nQuery: " +
      (report.query || query) +
      "\n\nSummary:\n" +
      (report.summary || answer) +
      "\n\nSources: " +
      (report.source_count ||
        sources.length);

    try {
      await navigator.clipboard.writeText(
        shareText
      );

      setShareMessage(
        "Research details copied successfully."
      );
    } catch {
      setShareMessage(
        "Unable to copy research details."
      );
    }
  };

  const loadHistoryItem = (item) => {
    setQuery(item.query);
    setAnswer(item.answer);
    setSources(item.sources || []);
    setReport(item.report || null);
    setSelectedSource(null);
    setShowSharePanel(false);
    setShareMessage("");
  };

  const deleteHistoryItem = (id) => {
    setHistory((previousHistory) =>
      previousHistory.filter(
        (item) => item.id !== id
      )
    );
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const sourceTypes = [
    ...new Set(
      sources
        .map(
          (source) =>
            source.source_type
        )
        .filter(Boolean)
    ),
  ];

  const filteredSources =
    sourceFilter === "all"
      ? sources
      : sources.filter(
          (source) =>
            source.source_type ===
            sourceFilter
        );

  return (
    <div className="research-workspace">
      <header className="research-topbar">
        <div className="research-brand">
          <div className="research-title">
            Nova AI Research Workspace
          </div>

          <div className="research-subtitle">
            Research topics, analyze sources and view
            citations with AI.
          </div>

          {workspace?.name && (
            <div className="research-workspace-name">
              Workspace: {workspace.name}
            </div>
          )}
        </div>

        <button
          type="button"
          className="research-back-button"
          onClick={onBack}
        >
          ← Back to Workspace
        </button>
      </header>

      <main className="research-content">
        <section className="research-search-card">
          <label htmlFor="research-query">
            Research Query
          </label>

          <textarea
            id="research-query"
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Ask Nova to research a topic..."
          />

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "14px",
            }}
          >
            <button
              type="button"
              className="research-run-button"
              onClick={handleResearch}
              disabled={loading}
            >
              {loading
                ? "Researching..."
                : "Start Research"}
            </button>

            <button
              type="button"
              className="research-run-button"
              onClick={handleMockResearch}
              disabled={loading}
            >
              Demo Research
            </button>

            <button
              type="button"
              className="research-run-button"
              onClick={handleExportTxt}
              disabled={!report || loading}
            >
              Export TXT
            </button>

            <button
              type="button"
              className="research-run-button"
              onClick={handleExportPdf}
              disabled={!report || loading}
            >
              Export PDF
            </button>

            <button
              type="button"
              className="research-run-button"
              onClick={handleShare}
              disabled={!report || loading}
            >
              Share Research
            </button>
          </div>
        </section>

        {showSharePanel && report && (
          <section className="share-research-panel">
            <div className="share-panel-header">
              <div>
                <h2>
                  Share Research
                </h2>

                <p>
                  Share this research report with others.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowSharePanel(false);
                  setShareMessage("");
                }}
              >
                ✕
              </button>
            </div>

            <div className="share-panel-body">
              <div className="share-info-box">
                <div className="share-info-label">
                  Report
                </div>

                <div className="share-info-value">
                  {report.title ||
                    "Nova AI Research Report"}
                </div>
              </div>

              <div className="share-info-box">
                <div className="share-info-label">
                  Query
                </div>

                <div className="share-info-value">
                  {report.query ||
                    query}
                </div>
              </div>

              <div className="share-info-box">
                <div className="share-info-label">
                  Sources
                </div>

                <div className="share-info-value">
                  {report.source_count ||
                    sources.length}{" "}
                  sources
                </div>
              </div>

              {shareId && (
                <div className="share-info-box">
                  <div className="share-info-label">
                    Share ID
                  </div>

                  <div className="share-info-value">
                    {shareId}
                  </div>
                </div>
              )}

              <div className="share-link-box">
                <input
                  type="text"
                  readOnly
                  value={
                    shareUrl ||
                    "Creating share link..."
                  }
                />

                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  disabled={!shareUrl}
                >
                  Copy Link
                </button>
              </div>

              {shareMessage && (
                <div className="share-success-message">
                  {shareMessage}
                </div>
              )}

              <div className="share-panel-actions">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  disabled={!shareUrl}
                >
                  🔗 Copy Share Link
                </button>

                <button
                  type="button"
                  onClick={handleCopyShareData}
                >
                  📋 Copy Research Details
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowSharePanel(false)
                  }
                >
                  Done
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="research-answer-card">
          <div className="section-heading">
            <h2>Research Answer</h2>
          </div>

          <div className="research-answer">
            {answer ||
              "Your research answer will appear here."}
          </div>
        </section>

        {report && (
          <section className="research-answer-card">
            <div className="section-heading">
              <h2>Research Report</h2>
            </div>

            <div className="research-answer">
              <h3>
                {report.title ||
                  "Research Report"}
              </h3>

              <p>
                Query:{" "}
                {report.query ||
                  query}
              </p>

              <h3>
                Summary
              </h3>

              <p>
                {report.summary ||
                  "No summary available."}
              </p>

              <h3>
                Key Findings
              </h3>

              {report.key_findings?.length ? (
                <ul>
                  {report.key_findings.map(
                    (finding, index) => (
                      <li key={index}>
                        {finding}
                      </li>
                    )
                  )}
                </ul>
              ) : (
                <p>
                  No key findings available.
                </p>
              )}

              <p>
                Citation Count:{" "}
                {report.source_count ||
                  0}{" "}
                sources
              </p>
            </div>
          </section>
        )}

        <section className="research-sources-card">
          <div className="section-heading sources-heading">
            <div>
              <h2>
                Sources & Citations
              </h2>

              <p>
                {filteredSources.length}{" "}
                {filteredSources.length === 1
                  ? "source"
                  : "sources"}
              </p>
            </div>

            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All Sources
              </option>

              {sourceTypes.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                )
              )}
            </select>
          </div>

          {filteredSources.length === 0 ? (
            <div className="empty-sources">
              No sources available yet.
            </div>
          ) : (
            <div className="source-list">
              {filteredSources.map(
                (source, index) => (
                  <article
                    className="source-card"
                    key={
                      (source.url ||
                        "source") +
                      "-" +
                      index
                    }
                  >
                    <div className="source-number">
                      {index + 1}
                    </div>

                    <div className="source-info">
                      <h3>
                        {source.title ||
                          "Untitled Source"}
                      </h3>

                      {source.source_type && (
                        <span className="source-type">
                          {
                            source.source_type
                          }
                        </span>
                      )}

                      <div
                        style={{
                          display:
                            "flex",
                          gap:
                            "10px",
                          flexWrap:
                            "wrap",
                          marginTop:
                            "10px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSource(
                              source
                            )
                          }
                        >
                          View Details
                        </button>

                        {source.url && (
                          <a
                            href={
                              source.url
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Source ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        {selectedSource && (
          <section className="research-answer-card">
            <div className="section-heading">
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                }}
              >
                <h2>
                  Source Details
                </h2>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedSource(
                      null
                    )
                  }
                >
                  Close
                </button>
              </div>
            </div>

            <div className="research-answer">
              <h3>
                {
                  selectedSource.title ||
                  "Untitled Source"
                }
              </h3>

              <p>
                Type:{" "}
                {
                  selectedSource.source_type ||
                  "web"
                }
              </p>

              {selectedSource.description && (
                <p>
                  {
                    selectedSource.description
                  }
                </p>
              )}

              {selectedSource.url && (
                <a
                  href={
                    selectedSource.url
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {
                    selectedSource.url
                  }
                </a>
              )}
            </div>
          </section>
        )}

        <section className="research-sources-card">
          <div className="section-heading sources-heading">
            <div>
              <h2>
                Research History
              </h2>

              <p>
                {history.length}{" "}
                {history.length === 1
                  ? "research"
                  : "researches"}
              </p>
            </div>

            {history.length > 0 && (
              <button
                type="button"
                onClick={
                  clearHistory
                }
              >
                Clear History
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="empty-sources">
              No research history yet.
            </div>
          ) : (
            <div className="source-list">
              {history.map(
                (item) => (
                  <article
                    className="source-card"
                    key={item.id}
                  >
                    <div className="source-number">
                      🔎
                    </div>

                    <div className="source-info">
                      <h3>
                        {item.query}
                      </h3>

                      <p>
                        {item.createdAt}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          loadHistoryItem(
                            item
                          )
                        }
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteHistoryItem(
                            item.id
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default ResearchWorkspace;