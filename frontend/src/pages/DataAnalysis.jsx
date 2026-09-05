import { useEffect, useState } from "react";

function DataAnalysis({ workspace, onBack }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analysisFileId, setAnalysisFileId] = useState(null);

  const [chartUrls, setChartUrls] = useState({});
  const [chartErrors, setChartErrors] = useState({});
  const [chartsLoading, setChartsLoading] = useState(false);

  const token = localStorage.getItem("nova_token");

  const workspaceId =
    workspace?.id ||
    workspace?.workspace_id ||
    localStorage.getItem("nova_workspace_id");

  const API_BASE_URL = "http://127.0.0.1:8000";

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;

    setSelectedFile(file);
    setMessage("");
    setAnalysis(null);
    setAnalysisFileId(null);
    setChartUrls({});
    setChartErrors({});
  };

  const handleAnalyze = async () => {
    if (!token) {
      setMessage("Your session has expired. Please login again.");
      return;
    }

    if (!workspaceId) {
      setMessage("Workspace ID not found.");
      return;
    }

    if (!selectedFile) {
      setMessage("Please select a CSV or XLSX file.");
      return;
    }

    const fileName = selectedFile.name.toLowerCase();

    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx")) {
      setMessage("Only CSV and XLSX files are supported.");
      return;
    }

    setLoading(true);
    setMessage("");
    setAnalysis(null);
    setAnalysisFileId(null);
    setChartUrls({});
    setChartErrors({});

    try {
      const formData = new FormData();

      formData.append("workspace_id", String(workspaceId));
      formData.append("file", selectedFile);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/data-analysis/analyze`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");

        setMessage("Your session has expired. Please login again.");
        return;
      }

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            data.detail ||
            `Analysis failed. Status: ${response.status}`
        );
        return;
      }

      setAnalysis(data.analysis || null);
      setAnalysisFileId(data.file_id || null);

      setMessage("Dataset analyzed successfully ✅");
    } catch (error) {
      console.error("DATA ANALYSIS ERROR:", error);

      setMessage("Unable to connect to Nova backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!token) {
      setMessage("Your session has expired. Please login again.");
      return;
    }

    if (!analysisFileId) {
      setMessage("Analysis report is not available yet.");
      return;
    }

    setReportLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/data-analysis/report/${analysisFileId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/plain",
          },
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");

        setMessage("Your session has expired. Please login again.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        setMessage(
          errorData.message ||
            errorData.detail ||
            `Report download failed. Status: ${response.status}`
        );

        return;
      }

      const blob = await response.blob();

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = downloadUrl;

      const baseName = selectedFile?.name
        ? selectedFile.name.replace(/\.[^/.]+$/, "")
        : "dataset";

      link.download = `${baseName}_analysis_report.txt`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(downloadUrl);

      setMessage("Analysis report downloaded successfully ✅");
    } catch (error) {
      console.error("REPORT DOWNLOAD ERROR:", error);

      setMessage("Unable to download the analysis report.");
    } finally {
      setReportLoading(false);
    }
  };

  // ============================================================
  // LOAD GENERATED CHARTS
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    const createdUrls = [];

    const loadCharts = async () => {
      const charts = analysis?.charts?.charts || [];

      if (!analysisFileId || charts.length === 0 || !token) {
        setChartUrls({});
        setChartErrors({});
        setChartsLoading(false);
        return;
      }

      setChartsLoading(true);
      setChartUrls({});
      setChartErrors({});

      const nextUrls = {};
      const nextErrors = {};

      for (const chart of charts) {
        if (!chart?.filename) {
          continue;
        }

        const chartFilename = chart.filename;

        try {
          const chartUrl =
            `${API_BASE_URL}/api/v1/data-analysis/charts/` +
            `${analysisFileId}/` +
            encodeURIComponent(chartFilename);

          console.log("Loading chart:", chartFilename);
          console.log("Chart URL:", chartUrl);

          const response = await fetch(chartUrl, {
            method: "GET",
            headers: {
              Accept: "image/png",
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");

            console.error(
              "CHART LOAD FAILED:",
              chartFilename,
              "STATUS:",
              response.status,
              "RESPONSE:",
              errorText
            );

            nextErrors[chartFilename] =
              `Chart request failed (${response.status})`;

            continue;
          }

          const contentType =
            response.headers.get("content-type") || "";

          if (!contentType.includes("image")) {
            const unexpectedResponse =
              await response.text().catch(() => "");

            console.error(
              "CHART INVALID RESPONSE:",
              chartFilename,
              "CONTENT TYPE:",
              contentType,
              "RESPONSE:",
              unexpectedResponse
            );

            nextErrors[chartFilename] =
              "Backend returned an invalid chart response.";

            continue;
          }

          const blob = await response.blob();

          if (!blob || blob.size === 0) {
            nextErrors[chartFilename] =
              "Chart file is empty.";

            continue;
          }

          const objectUrl = window.URL.createObjectURL(blob);

          createdUrls.push(objectUrl);

          nextUrls[chartFilename] = objectUrl;
        } catch (error) {
          console.error(
            "CHART LOAD ERROR:",
            chartFilename,
            error
          );

          nextErrors[chartFilename] =
            "Unable to load chart.";
        }
      }

      if (!cancelled) {
        setChartUrls(nextUrls);
        setChartErrors(nextErrors);
        setChartsLoading(false);
      }
    };

    loadCharts();

    return () => {
      cancelled = true;

      createdUrls.forEach((url) => {
        window.URL.revokeObjectURL(url);
      });
    };
  }, [analysis, analysisFileId, token]);

  // ============================================================
  // ANALYSIS DATA
  // ============================================================

  const profile = analysis?.profile || {};
  const correlations = analysis?.correlations || {};
  const outliers = analysis?.outliers || {};
  const trends = analysis?.trends || {};
  const insights = analysis?.insights || [];

  const totalMissingValues = Object.values(
    profile.missing_values || {}
  ).reduce(
    (total, value) => total + Number(value || 0),
    0
  );

  const correlationRelationships =
    correlations.relationships || [];

  const numericStatistics =
    profile.statistics || {};

  const numericColumns =
    profile.numeric_columns || [];

  const strongestCorrelation =
    correlationRelationships.length > 0
      ? correlationRelationships[0]
      : null;

  const statisticsEntries =
    Object.entries(numericStatistics);

  const chartEntries =
    analysis?.charts?.charts || [];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* =================================================
          HEADER
          ================================================= */}

      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            AI Data Analysis
          </h1>

          <p className="text-sm text-slate-500">
            {workspace?.name || "Workspace"}
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
        >
          Back to Workspace
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* =================================================
            UPLOAD
            ================================================= */}

        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Analyze your dataset 📊
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            Upload a CSV or XLSX file to generate a
            complete data analysis.
          </p>

          <div className="mt-6 border-2 border-dashed border-slate-300 rounded-2xl p-8">
            <div className="text-center">
              <div className="text-4xl">
                📁
              </div>

              <p className="font-semibold text-slate-900 mt-3">
                Select your dataset
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Supported formats: CSV, XLSX
              </p>

              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="mt-5 block mx-auto text-sm"
                disabled={loading || reportLoading}
              />

              {selectedFile && (
                <div className="mt-4 text-sm text-slate-700">
                  Selected file:
                  <span className="font-semibold ml-1">
                    {selectedFile.name}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={
                  loading ||
                  reportLoading ||
                  !selectedFile
                }
                className="mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Analyzing..."
                  : "Analyze Dataset"}
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                message.includes("successfully")
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}
        </section>

        {/* =================================================
            RESULTS
            ================================================= */}

        {analysis && (
          <>
            {/* =================================================
                REPORT DOWNLOAD
                ================================================= */}

            <section className="bg-white border rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Analysis Report 📄
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Download a complete text report containing
                    the main findings from this dataset.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={
                    reportLoading ||
                    !analysisFileId
                  }
                  className="bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {reportLoading
                    ? "Preparing Report..."
                    : "⬇ Download Report"}
                </button>
              </div>
            </section>

            {/* =================================================
                SUMMARY
                ================================================= */}

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border rounded-2xl p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Rows
                </p>

                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {profile.rows ?? 0}
                </p>
              </div>

              <div className="bg-white border rounded-2xl p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Columns
                </p>

                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {profile.columns ?? 0}
                </p>
              </div>

              <div className="bg-white border rounded-2xl p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Numeric Columns
                </p>

                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {numericColumns.length}
                </p>
              </div>

              <div className="bg-white border rounded-2xl p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Missing Values
                </p>

                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {totalMissingValues}
                </p>
              </div>
            </section>

            {/* =================================================
                GENERATED CHARTS
                ================================================= */}

            <section className="bg-white border rounded-2xl p-6 shadow-sm">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Generated Charts 📊
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Visual charts generated automatically from
                  your numeric dataset.
                </p>
              </div>

              {chartsLoading ? (
                <div className="mt-6 border border-dashed border-slate-300 rounded-xl p-6 text-center">
                  <p className="text-sm text-slate-500">
                    Loading generated charts...
                  </p>
                </div>
              ) : chartEntries.length > 0 ? (
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {chartEntries.map((chart, index) => {
                    const imageUrl =
                      chartUrls[chart.filename];

                    const chartError =
                      chartErrors[chart.filename];

                    const chartTitle =
                      chart.type === "correlation"
                        ? `${chart.column_a} vs ${chart.column_b}`
                        : `${chart.column} Distribution`;

                    return (
                      <div
                        key={`${chart.filename}-${index}`}
                        className="border border-slate-200 rounded-2xl p-4 bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {chartTitle}
                            </p>

                            {chart.type === "correlation" && (
                              <p className="text-xs text-slate-500 mt-1">
                                Correlation:{" "}
                                {chart.correlation}
                              </p>
                            )}
                          </div>
                        </div>

                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={chartTitle}
                            className="w-full rounded-xl border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center bg-white">
                            <p className="text-sm text-red-500">
                              {chartError ||
                                "Chart could not be loaded."}
                            </p>

                            <p className="text-xs text-slate-400 mt-2 break-all">
                              {chart.filename}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 border border-dashed border-slate-300 rounded-xl p-6 text-center">
                  <p className="text-sm text-slate-500">
                    No charts were generated for this dataset.
                  </p>
                </div>
              )}
            </section>

            {/* =================================================
                VISUAL OVERVIEW
                ================================================= */}

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AVERAGE VALUES */}

              <div className="bg-white border rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">
                  Average Values 📊
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Mean value of each numeric column.
                </p>

                <div className="mt-6 space-y-4">
                  {statisticsEntries.length > 0 ? (
                    statisticsEntries.map(
                      ([columnName, stats]) => {
                        const mean =
                          Number(stats.mean || 0);

                        const values =
                          statisticsEntries.map(
                            ([, item]) =>
                              Number(item.mean || 0)
                          );

                        const maximum =
                          Math.max(
                            ...values,
                            1
                          );

                        const width =
                          Math.max(
                            4,
                            Math.min(
                              100,
                              (mean / maximum) * 100
                            )
                          );

                        return (
                          <div key={columnName}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700">
                                {columnName}
                              </span>

                              <span className="text-sm font-semibold text-slate-900">
                                {mean.toFixed(2)}
                              </span>
                            </div>

                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-slate-900 rounded-full transition-all"
                                style={{
                                  width: `${width}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      }
                    )
                  ) : (
                    <p className="text-sm text-slate-500">
                      No numeric data available.
                    </p>
                  )}
                </div>
              </div>

              {/* STRONGEST CORRELATION */}

              <div className="bg-white border rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">
                  Strongest Relationship 🔗
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  The strongest correlation found in the dataset.
                </p>

                {strongestCorrelation ? (
                  <div className="mt-6">
                    <div className="border border-slate-200 rounded-2xl p-5">
                      <p className="text-lg font-bold text-slate-900">
                        {strongestCorrelation.column_a}
                        {" ↔ "}
                        {strongestCorrelation.column_b}
                      </p>

                      <p className="text-sm text-slate-500 mt-2">
                        {strongestCorrelation.strength}{" "}
                        {strongestCorrelation.direction}{" "}
                        correlation
                      </p>

                      <div className="mt-6">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-500">
                            Correlation
                          </span>

                          <span className="font-bold text-slate-900">
                            {strongestCorrelation.correlation}
                          </span>
                        </div>

                        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-900 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.abs(
                                  Number(
                                    strongestCorrelation.correlation
                                  )
                                ) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 border border-dashed border-slate-300 rounded-xl p-5 text-center">
                    <p className="text-sm text-slate-500">
                      Not enough numeric columns.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* =================================================
                AI INSIGHTS
                ================================================= */}

            <section className="bg-white border rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    AI Insights 🤖
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Important findings from your dataset.
                  </p>
                </div>

                <div className="text-2xl">
                  💡
                </div>
              </div>

              {insights.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {insights.map((insight, index) => (
                    <div
                      key={index}
                      className="border border-slate-200 rounded-xl p-4 bg-slate-50"
                    >
                      <div className="flex gap-3">
                        <span className="text-lg">
                          •
                        </span>

                        <p className="text-sm text-slate-700">
                          {insight}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 border border-dashed border-slate-300 rounded-xl p-5 text-center">
                  <p className="text-sm text-slate-500">
                    No insights available.
                  </p>
                </div>
              )}
            </section>

            {/* =================================================
                COLUMN PROFILE
                ================================================= */}

            <section className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">
                Column Profile
              </h3>

              <div className="overflow-x-auto mt-5">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                        Column
                      </th>

                      <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                        Data Type
                      </th>

                      <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                        Missing
                      </th>

                      <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                        Unique
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(profile.column_details || []).map(
                      (column, index) => (
                        <tr
                          key={
                            column.name ||
                            index
                          }
                          className="border-b last:border-b-0"
                        >
                          <td className="px-3 py-3 text-sm text-slate-900 font-medium">
                            {column.name}
                          </td>

                          <td className="px-3 py-3 text-sm text-slate-600">
                            {column.dtype}
                          </td>

                          <td className="px-3 py-3 text-sm text-slate-600">
                            {column.missing}
                          </td>

                          <td className="px-3 py-3 text-sm text-slate-600">
                            {column.unique}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* =================================================
                NUMERIC STATISTICS
                ================================================= */}

            <section className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">
                Numeric Statistics
              </h3>

              {statisticsEntries.length === 0 ? (
                <p className="text-sm text-slate-500 mt-4">
                  No numeric statistics available.
                </p>
              ) : (
                <div className="overflow-x-auto mt-5">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                          Column
                        </th>

                        <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                          Count
                        </th>

                        <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                          Mean
                        </th>

                        <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                          Min
                        </th>

                        <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                          Max
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {statisticsEntries.map(
                        ([columnName, stats]) => (
                          <tr
                            key={columnName}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-3 py-3 text-sm font-medium text-slate-900">
                              {columnName}
                            </td>

                            <td className="px-3 py-3 text-sm text-slate-600">
                              {stats.count ?? "-"}
                            </td>

                            <td className="px-3 py-3 text-sm text-slate-600">
                              {stats.mean != null
                                ? Number(
                                    stats.mean
                                  ).toFixed(2)
                                : "-"}
                            </td>

                            <td className="px-3 py-3 text-sm text-slate-600">
                              {stats.min != null
                                ? Number(
                                    stats.min
                                  ).toFixed(2)
                                : "-"}
                            </td>

                            <td className="px-3 py-3 text-sm text-slate-600">
                              {stats.max != null
                                ? Number(
                                    stats.max
                                  ).toFixed(2)
                                : "-"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* =================================================
                CORRELATIONS
                ================================================= */}

            <section className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">
                Correlations 🔗
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Relationships between numeric columns.
              </p>

              {correlationRelationships.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {correlationRelationships.map(
                    (relationship, index) => (
                      <div
                        key={index}
                        className="border border-slate-200 rounded-xl p-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {relationship.column_a}
                              {" ↔ "}
                              {relationship.column_b}
                            </p>

                            <p className="text-xs text-slate-500 mt-1">
                              {relationship.strength}{" "}
                              {relationship.direction} relationship
                            </p>
                          </div>

                          <div className="text-lg font-bold text-slate-900">
                            {relationship.correlation}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 mt-5">
                  Not enough numeric columns to calculate correlations.
                </p>
              )}
            </section>

            {/* =================================================
                OUTLIERS
                ================================================= */}

            <section className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">
                Outliers ⚠️
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Potential outliers detected using the IQR method.
              </p>

              <div className="overflow-x-auto mt-5">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                        Column
                      </th>

                      <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                        Outliers
                      </th>

                      <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                        Percentage
                      </th>

                      <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                        Lower Bound
                      </th>

                      <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                        Upper Bound
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {Object.keys(outliers).length > 0 ? (
                      Object.entries(outliers).map(
                        ([columnName, data]) => (
                          <tr
                            key={columnName}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-3 py-3 text-sm font-medium text-slate-900">
                              {columnName}
                            </td>

                            <td className="px-3 py-3 text-sm text-slate-600">
                              {data.count ?? 0}
                            </td>

                            <td className="px-3 py-3 text-sm text-slate-600">
                              {data.percentage ?? 0}%
                            </td>

                            <td className="px-3 py-3 text-sm text-slate-600">
                              {data.lower_bound ?? "-"}
                            </td>

                            <td className="px-3 py-3 text-sm text-slate-600">
                              {data.upper_bound ?? "-"}
                            </td>
                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-3 py-5 text-center text-sm text-slate-500"
                        >
                          No outlier data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* =================================================
                TRENDS
                ================================================= */}

            <section className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">
                Trends 📈
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Simple changes across the dataset order.
              </p>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(trends).length > 0 ? (
                  Object.entries(trends).map(
                    ([columnName, trend]) => (
                      <div
                        key={columnName}
                        className="border border-slate-200 rounded-xl p-4"
                      >
                        <p className="font-semibold text-slate-900">
                          {columnName}
                        </p>

                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <p>
                            Direction:{" "}
                            <span className="font-medium text-slate-900">
                              {trend.direction}
                            </span>
                          </p>

                          <p>
                            First value:{" "}
                            {trend.first_value}
                          </p>

                          <p>
                            Last value:{" "}
                            {trend.last_value}
                          </p>

                          <p>
                            Change:{" "}
                            <span className="font-medium text-slate-900">
                              {trend.change}
                            </span>
                          </p>

                          <p>
                            Mean:{" "}
                            {trend.mean}
                          </p>
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-xl p-5">
                    <p className="text-sm text-slate-500">
                      No trend data available.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* =================================================
                DATA PREVIEW
                ================================================= */}

            <section className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">
                Data Preview
              </h3>

              <div className="overflow-x-auto mt-5">
                {(profile.preview || []).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No preview data available.
                  </p>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        {Object.keys(
                          profile.preview[0] || {}
                        ).map((column) => (
                          <th
                            key={column}
                            className="text-left px-3 py-3 text-sm font-semibold text-slate-700"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {profile.preview.map(
                        (row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="border-b last:border-b-0"
                          >
                            {Object.keys(row).map(
                              (column) => (
                                <td
                                  key={column}
                                  className="px-3 py-3 text-sm text-slate-600"
                                >
                                  {row[column] ?? "—"}
                                </td>
                              )
                            )}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default DataAnalysis;