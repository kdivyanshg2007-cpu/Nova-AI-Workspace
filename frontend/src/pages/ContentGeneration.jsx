import { useEffect, useState } from "react";

const CONTENT_TYPES = [
  {
    value: "email",
    label: "Email",
    description: "Professional or personal emails",
  },
  {
    value: "report",
    label: "Report",
    description: "Structured reports and summaries",
  },
  {
    value: "resume",
    label: "Resume",
    description: "Resume and CV content",
  },
  {
    value: "notes",
    label: "Notes",
    description: "Study and meeting notes",
  },
  {
    value: "proposal",
    label: "Proposal",
    description: "Project and business proposals",
  },
  {
    value: "blog",
    label: "Blog",
    description: "Articles and blog posts",
  },
];

export default function ContentGeneration({
  workspace,
  onBack,
}) {
  const [contentType, setContentType] = useState("email");
  const [prompt, setPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [pptxLoading, setPptxLoading] = useState(false);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveFormat, setSaveFormat] = useState("docx");
  const [hydrated, setHydrated] = useState(false);

  const workspaceId =
    workspace?.id ??
    workspace?.workspace_id ??
    localStorage.getItem("nova_workspace_id") ??
    "";

  // --------------------------------------------------
  // RESTORE SAVED CONTENT
  // --------------------------------------------------

  useEffect(() => {
    const saved = localStorage.getItem(
      "nova_content_generation"
    );

    if (saved) {
      try {
        const data = JSON.parse(saved);

        setContentType(
          data.contentType || "email"
        );

        setPrompt(
          data.prompt || ""
        );

        setGeneratedContent(
          data.generatedContent || ""
        );
      } catch {
        localStorage.removeItem(
          "nova_content_generation"
        );
      }
    }

    setHydrated(true);
  }, []);

  // --------------------------------------------------
  // SAVE CONTENT
  // --------------------------------------------------

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    localStorage.setItem(
      "nova_content_generation",
      JSON.stringify({
        contentType,
        prompt,
        generatedContent,
      })
    );
  }, [
    hydrated,
    contentType,
    prompt,
    generatedContent,
  ]);

  // --------------------------------------------------
  // GENERATE CONTENT
  // --------------------------------------------------

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError(
        "Please enter a prompt."
      );
      return;
    }

    if (!workspaceId) {
      setError(
        "No workspace is selected."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token =
        localStorage.getItem(
          "nova_token"
        );

      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL ||
        "http://127.0.0.1:8001";

      const response = await fetch(
        `${apiBaseUrl}/api/v1/content/generate`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },

          body: JSON.stringify({
            workspace_id:
              Number(workspaceId),

            content_type:
              contentType,

            prompt:
              trimmedPrompt,
          }),
        }
      );

      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Content generation failed."
        );
      }

      if (data?.success === false) {
        throw new Error(
          data?.message ||
            data?.detail ||
            "Content generation failed."
        );
      }

      const result =
        data?.content ??
        data?.generated_content ??
        data?.text ??
        "";

      if (!result) {
        throw new Error(
          "The AI returned an empty response."
        );
      }

      setGeneratedContent(
        result
      );
    } catch (err) {
      console.error(
        "Content generation error:",
        err
      );

      setError(
        err?.message ||
          "Something went wrong while generating content."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // COPY
  // --------------------------------------------------

  const handleCopy = async () => {
    if (!generatedContent) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        generatedContent
      );

      setError("");
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
      setError(
        "Unable to copy the generated content."
      );
    }
  };

  // --------------------------------------------------
  // SAVE OUTPUT TO WORKSPACE
  // --------------------------------------------------

  const handleSaveOutput = async () => {
    if (!generatedContent) {
      setError("Generate content before saving an output.");
      return;
    }

    if (!workspaceId) {
      setError("No workspace is selected.");
      return;
    }

    setSaveLoading(true);
    setSaveMessage("");
    setError("");

    try {
      const token = localStorage.getItem("nova_token");

      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL ||
        "http://127.0.0.1:8001";

      const response = await fetch(
        `${apiBaseUrl}/api/v1/content/save-output`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",

            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },

          body: JSON.stringify({
            workspace_id: Number(workspaceId),
            content_type: contentType,
            content: generatedContent,
            file_format: saveFormat,
            filename: `nova_${contentType}.${saveFormat}`,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            `Save output failed. Status: ${response.status}`
        );
      }

      if (data?.success === false) {
        throw new Error(
          data?.message ||
            data?.detail ||
            "Unable to save output."
        );
      }

      const filename =
        data?.output?.filename ||
        `nova_${contentType}_v1.${saveFormat}`;

      setSaveMessage(`Saved: ${filename}`);
    } catch (err) {
      console.error(
        "Save output error:",
        err
      );

      setError(
        err?.message ||
          "Unable to save the output to the workspace."
      );
    } finally {
      setSaveLoading(false);
    }
  };

  // --------------------------------------------------
  // DOWNLOAD DOCX
  // --------------------------------------------------

  const handleDownloadDocx = async () => {
    if (!generatedContent) {
      setError("Generate content before downloading a DOCX.");
      return;
    }

    if (!workspaceId) {
      setError("No workspace is selected.");
      return;
    }

    setDownloadLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("nova_token");

      if (!token) {
        throw new Error("You are not logged in. Please login again.");
      }

      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL ||
        "http://127.0.0.1:8001";

      const response = await fetch(
        `${apiBaseUrl}/api/v1/content/export-docx`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            workspace_id: Number(workspaceId),
            content_type: contentType,
            content: generatedContent,
            filename: `nova_${contentType}.docx`,
          }),
        }
      );

      if (!response.ok) {
        let message = `DOCX export failed. Status: ${response.status}`;

        try {
          const data = await response.json();
          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Keep the status-based message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error(
          "DOCX export returned an empty file."
        );
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = `nova_${contentType}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(
        "DOCX download error:",
        err
      );

      setError(
        err?.message ||
          "Unable to download the DOCX file."
      );
    } finally {
      setDownloadLoading(false);
    }
  };

  // --------------------------------------------------
  // DOWNLOAD PPTX
  // --------------------------------------------------

  const handleDownloadPptx = async () => {
    if (!generatedContent) {
      setError("Generate content before downloading a PPTX.");
      return;
    }

    if (!workspaceId) {
      setError("No workspace is selected.");
      return;
    }

    setPptxLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("nova_token");

      if (!token) {
        throw new Error("You are not logged in. Please login again.");
      }

      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL ||
        "http://127.0.0.1:8001";

      const response = await fetch(
        `${apiBaseUrl}/api/v1/content/export-pptx`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            workspace_id: Number(workspaceId),
            content_type: contentType,
            content: generatedContent,
            filename: `nova_${contentType}.pptx`,
          }),
        }
      );

      if (!response.ok) {
        let message = `PPTX export failed. Status: ${response.status}`;

        try {
          const data = await response.json();
          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Keep the status-based message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error(
          "PPTX export returned an empty file."
        );
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = `nova_${contentType}.pptx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(
        "PPTX download error:",
        err
      );

      setError(
        err?.message ||
          "Unable to download the PPTX file."
      );
    } finally {
      setPptxLoading(false);
    }
  };

  // --------------------------------------------------
  // DOWNLOAD XLSX
  // --------------------------------------------------

  const handleDownloadXlsx = async () => {
    if (!generatedContent) {
      setError(
        "Generate content before downloading an XLSX."
      );
      return;
    }

    if (!workspaceId) {
      setError(
        "No workspace is selected."
      );
      return;
    }

    setXlsxLoading(true);
    setError("");

    try {
      const token =
        localStorage.getItem(
          "nova_token"
        );

      if (!token) {
        throw new Error(
          "You are not logged in. Please login again."
        );
      }

      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL ||
        "http://127.0.0.1:8001";

      const response = await fetch(
        `${apiBaseUrl}/api/v1/content/export-xlsx`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            workspace_id: Number(workspaceId),
            content_type: contentType,
            content: generatedContent,
            filename: `nova_${contentType}.xlsx`,
          }),
        }
      );

      if (!response.ok) {
        let message =
          `XLSX export failed. Status: ${response.status}`;

        try {
          const data = await response.json();
          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Keep status-based message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error(
          "XLSX export returned an empty file."
        );
      }

      const downloadUrl =
        window.URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = `nova_${contentType}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(
        "XLSX download error:",
        err
      );

      setError(
        err?.message ||
          "Unable to download the XLSX file."
      );
    } finally {
      setXlsxLoading(false);
    }
  };

  // --------------------------------------------------
  // CLEAR
  // --------------------------------------------------

  const handleClear = () => {
    setPrompt("");
    setGeneratedContent("");
    setError("");
    setCopied(false);
    setDownloadLoading(false);
    setPptxLoading(false);
    setXlsxLoading(false);
    localStorage.removeItem(
      "nova_content_generation"
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Content Generation
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Nova AI Workspace
            </p>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Back to Workspace
          </button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Intro */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              ✍️ AI Content Generation
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-slate-400">
              Create professional emails, reports, resumes, notes,
              proposals and blog content with Nova AI.
            </p>
          </section>

          {/* Generator */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            {/* Content Type */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Content Type
              </h3>

              <div className="mt-4 space-y-3">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setContentType(type.value)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      contentType === type.value
                        ? "border-gray-900 bg-gray-50 shadow-sm dark:border-white dark:bg-slate-800"
                        : "border-gray-200 bg-white hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {type.label}
                    </div>

                    <div className="mt-1 text-sm leading-5 text-gray-500 dark:text-slate-400">
                      {type.description}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Prompt */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Prompt
                  </h3>

                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Tell Nova exactly what you want to create.
                  </p>
                </div>

                <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  {contentType}
                </span>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: Write a professional email asking my professor for a 2-day assignment extension because of a college event."
                className="mt-4 min-h-[260px] w-full resize-y rounded-xl border border-gray-300 bg-white p-4 text-base leading-7 text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-800"
              />

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {loading ? "Generating..." : "Generate Content"}
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Clear
                </button>
              </div>
            </section>
          </div>

          {/* Generated Content - full width */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Generated Content
                </h3>

                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Your generated result appears below.
                </p>
                {saveMessage ? (
                  <p className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">
                    {saveMessage}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 self-start">
                <select
                  value={saveFormat}
                  onChange={(e) => setSaveFormat(e.target.value)}
                  disabled={saveLoading}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  aria-label="Output format"
                >
                  <option value="docx">DOCX</option>
                  <option value="pptx">PPTX</option>
                  <option value="xlsx">XLSX</option>
                </select>

                <button
                  type="button"
                  onClick={handleSaveOutput}
                  disabled={
                    !generatedContent ||
                    saveLoading
                  }
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {saveLoading
                    ? "Saving..."
                    : "Save to Workspace"}
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={
                    !generatedContent ||
                    downloadLoading ||
                    pptxLoading ||
                    xlsxLoading
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  disabled={
                    !generatedContent ||
                    downloadLoading ||
                    pptxLoading ||
                    xlsxLoading
                  }
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {downloadLoading
                    ? "Preparing DOCX..."
                    : "Download DOCX"}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPptx}
                  disabled={
                    !generatedContent ||
                    downloadLoading ||
                    pptxLoading ||
                    xlsxLoading
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {pptxLoading
                    ? "Preparing PPTX..."
                    : "Download PPTX"}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadXlsx}
                  disabled={
                    !generatedContent ||
                    downloadLoading ||
                    pptxLoading ||
                    xlsxLoading
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {xlsxLoading
                    ? "Preparing XLSX..."
                    : "Download XLSX"}
                </button>
              </div>
            </div>

            <div className="mt-4 min-h-[360px] max-h-[650px] w-full overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:p-7 dark:border-slate-700 dark:bg-slate-950">
              {generatedContent ? (
                <div className="w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-base leading-7 text-gray-900 dark:text-white">
                  {generatedContent}
                </div>
              ) : (
                <div className="flex min-h-[310px] items-center justify-center text-center">
                  <p className="max-w-md text-sm leading-6 text-gray-400 dark:text-slate-500">
                    Generated content will appear here after you click
                    <span className="font-semibold"> Generate Content</span>.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Workspace */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Workspace
            </h3>

            <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
              {workspace?.name || "Current Workspace"}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}