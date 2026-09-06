import { useEffect, useState } from "react";
import "./SharedResearch.css";

function SharedResearch() {
  const [report, setReport] = useState(null);
  const [shareId, setShareId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    const loadSharedResearch = async () => {
      const pathParts = window.location.pathname.split("/");
      const currentShareId =
        pathParts[pathParts.length - 1];

      if (!currentShareId) {
        setError("Share ID is missing.");
        setLoading(false);
        return;
      }

      setShareId(currentShareId);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/research/shared/` +
            currentShareId
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Shared research report not found."
          );
        }

        if (!data.success) {
          throw new Error(
            data?.message ||
              "Unable to load shared research."
          );
        }

        setReport(data.report || null);
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load shared research."
        );
      } finally {
        setLoading(false);
      }
    };

    loadSharedResearch();
  }, []);

  if (loading) {
    return (
      <div className="shared-research-page">
        <header className="shared-research-header">
          <div>
            <div className="shared-research-brand">
              Nova AI
            </div>
            <div className="shared-research-subtitle">
              Shared Research
            </div>
          </div>
        </header>

        <main className="shared-research-container">
          <section className="shared-research-card shared-status-card">
            <div className="shared-loading-icon">
              ⏳
            </div>

            <h1>
              Loading Research Report
            </h1>

            <p>
              Please wait while Nova AI loads the shared
              research report.
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-research-page">
        <header className="shared-research-header">
          <div>
            <div className="shared-research-brand">
              Nova AI
            </div>
            <div className="shared-research-subtitle">
              Shared Research
            </div>
          </div>
        </header>

        <main className="shared-research-container">
          <section className="shared-research-card shared-status-card">
            <div className="shared-error-icon">
              !
            </div>

            <h1>
              Unable to Load Report
            </h1>

            <p>
              {error}
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="shared-research-page">
        <header className="shared-research-header">
          <div>
            <div className="shared-research-brand">
              Nova AI
            </div>
            <div className="shared-research-subtitle">
              Shared Research
            </div>
          </div>
        </header>

        <main className="shared-research-container">
          <section className="shared-research-card shared-status-card">
            <h1>
              No Research Report
            </h1>

            <p>
              This shared research report is not available.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const findings =
    Array.isArray(report.key_findings)
      ? report.key_findings
      : [];

  const citations =
    Array.isArray(report.citations)
      ? report.citations
      : [];

  return (
    <div className="shared-research-page">
      <header className="shared-research-header">
        <div className="shared-header-inner">
          <div>
            <div className="shared-research-brand">
              Nova AI
            </div>

            <div className="shared-research-subtitle">
              Shared Research Report
            </div>
          </div>

          <div className="shared-header-badge">
            🔗 Shared
          </div>
        </div>
      </header>

      <main className="shared-research-container">
        <section className="shared-research-card">
          <div className="shared-badge">
            Shared Research
          </div>

          <h1 className="shared-report-title">
            {report.title ||
              "Nova AI Research Report"}
          </h1>

          <div className="shared-query-box">
            <div className="shared-label">
              Research Query
            </div>

            <div className="shared-value">
              {report.query ||
                "No query available."}
            </div>
          </div>

          {shareId && (
            <div className="shared-id-text">
              Share ID: {shareId}
            </div>
          )}
        </section>

        <section className="shared-research-card">
          <h2>
            Summary
          </h2>

          <p className="shared-summary">
            {report.summary ||
              "No summary available."}
          </p>
        </section>

        <section className="shared-research-card">
          <h2>
            Key Findings
          </h2>

          {findings.length === 0 ? (
            <p className="shared-muted">
              No key findings available.
            </p>
          ) : (
            <ol className="shared-findings">
              {findings.map(
                (finding, index) => (
                  <li key={index}>
                    {finding}
                  </li>
                )
              )}
            </ol>
          )}
        </section>

        <section className="shared-research-card">
          <div className="shared-section-header">
            <div>
              <h2>
                Sources & Citations
              </h2>

              <p>
                {citations.length}{" "}
                {citations.length === 1
                  ? "source"
                  : "sources"}
              </p>
            </div>
          </div>

          {citations.length === 0 ? (
            <div className="shared-empty">
              No sources available.
            </div>
          ) : (
            <div className="shared-citation-list">
              {citations.map(
                (citation, index) => (
                  <article
                    className="shared-citation"
                    key={
                      citation.url ||
                      citation.id ||
                      index
                    }
                  >
                    <div className="shared-citation-number">
                      {citation.id ||
                        index + 1}
                    </div>

                    <div className="shared-citation-content">
                      <h3>
                        {citation.title ||
                          "Web Source"}
                      </h3>

                      {citation.source_type && (
                        <span className="shared-source-type">
                          {
                            citation.source_type
                          }
                        </span>
                      )}

                      {citation.url && (
                        <a
                          href={
                            citation.url
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Source ↗
                        </a>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <div className="shared-research-footer">
          Generated and shared with Nova AI Workspace.
        </div>
      </main>
    </div>
  );
}

export default SharedResearch;