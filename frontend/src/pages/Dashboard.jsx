import { useEffect, useState } from "react";

function Dashboard({ onLogout, onOpenWorkspace }) {
  const user = JSON.parse(
    localStorage.getItem("nova_user") || "null"
  );

  const token = localStorage.getItem("nova_token");

  // =========================================================
  // WORKSPACE STATES
  // =========================================================

  const [workspaceName, setWorkspaceName] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] =
    useState(true);

  const [editingWorkspaceId, setEditingWorkspaceId] =
    useState(null);

  const [editWorkspaceName, setEditWorkspaceName] =
    useState("");

  const [renamingWorkspace, setRenamingWorkspace] =
    useState(false);

  const [deletingWorkspaceId, setDeletingWorkspaceId] =
    useState(null);

  // =========================================================
  // PREFERENCES STATES
  // =========================================================

  const [preferences, setPreferences] = useState(() => ({
    language:
      localStorage.getItem("nova_language") || "en",

    theme:
      localStorage.getItem("nova_theme") || "light",

    model_preference:
      localStorage.getItem("nova_model_preference") ||
      "gemini-3.6-flash",
  }));

  const [loadingPreferences, setLoadingPreferences] =
    useState(true);

  const [savingPreferences, setSavingPreferences] =
    useState(false);

  // =========================================================
  // DAY 42 - AI EVALUATION + USAGE STATES
  // =========================================================

  const [evaluations, setEvaluations] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);

  // =========================================================
  // THEME
  // =========================================================

  const applyTheme = (theme) => {
    const normalizedTheme =
      theme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute(
      "data-nova-theme",
      normalizedTheme
    );

    localStorage.setItem(
      "nova_theme",
      normalizedTheme
    );
  };

  const applyStoredPreferences = (nextPreferences) => {
    localStorage.setItem(
      "nova_language",
      nextPreferences.language || "en"
    );

    localStorage.setItem(
      "nova_model_preference",
      nextPreferences.model_preference ||
        "gemini-3.6-flash"
    );

    applyTheme(nextPreferences.theme);
  };

  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  // =========================================================
  // UNAUTHORIZED
  // =========================================================

  const handleUnauthorized = () => {
    localStorage.removeItem("nova_token");
    localStorage.removeItem("nova_user");

    setWorkspaces([]);

    setMessage(
      "Your session has expired. Please login again."
    );

    onLogout();
  };

  // =========================================================
  // LOAD PREFERENCES
  // =========================================================

  const loadPreferences = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setLoadingPreferences(true);

      const response = await fetch(
        "http://127.0.0.1:8000/api/v1/preferences",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            data.detail ||
            `Preferences request failed. Status: ${response.status}`
        );
        return;
      }

      if (data.preferences) {
        const nextPreferences = {
          language:
            data.preferences.language || "en",

          theme:
            data.preferences.theme || "light",

          model_preference:
            data.preferences.model_preference ||
            "gemini-3.6-flash",
        };

        setPreferences(nextPreferences);
        applyStoredPreferences(nextPreferences);
      }
    } catch (error) {
      console.error(
        "Load preferences error:",
        error
      );

      setMessage(
        "Unable to load preferences."
      );
    } finally {
      setLoadingPreferences(false);
    }
  };

  // =========================================================
  // SAVE PREFERENCES
  // =========================================================

  const savePreferences = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setSavingPreferences(true);
      setMessage("");

      const response = await fetch(
        "http://127.0.0.1:8000/api/v1/preferences",
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(preferences),
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            data.detail ||
            `Preferences update failed. Status: ${response.status}`
        );
        return;
      }

      if (data.preferences) {
        const nextPreferences = {
          language:
            data.preferences.language || "en",

          theme:
            data.preferences.theme || "light",

          model_preference:
            data.preferences.model_preference ||
            "gemini-3.6-flash",
        };

        setPreferences(nextPreferences);
        applyStoredPreferences(nextPreferences);
      } else {
        applyStoredPreferences(preferences);
      }

      setMessage(
        "Preferences saved successfully ✅"
      );
    } catch (error) {
      console.error(
        "Save preferences error:",
        error
      );

      setMessage(
        "Unable to save preferences."
      );
    } finally {
      setSavingPreferences(false);
    }
  };

  // =========================================================
  // LOAD AI EVALUATIONS
  // =========================================================

  const loadEvaluations = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/v1/evaluations",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        console.error(
          "Evaluations request failed:",
          data
        );
        return;
      }

      setEvaluations(
        data.evaluations || []
      );
    } catch (error) {
      console.error(
        "Load evaluations error:",
        error
      );
    }
  };

  // =========================================================
  // LOAD USAGE LOGS
  // =========================================================

  const loadUsageLogs = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/v1/usage",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        console.error(
          "Usage logs request failed:",
          data
        );
        return;
      }

      setUsageLogs(
        data.usage_logs || []
      );
    } catch (error) {
      console.error(
        "Load usage logs error:",
        error
      );
    }
  };

  // =========================================================
  // LOAD WORKSPACES
  // =========================================================

  const loadWorkspaces = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setLoadingWorkspaces(true);
      setMessage("");

      const response = await fetch(
        "http://127.0.0.1:8000/api/v1/workspaces",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      console.log(
        "WORKSPACE STATUS:",
        response.status
      );

      console.log(
        "WORKSPACE RESPONSE:",
        data
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            data.detail ||
            `Workspace request failed. Status: ${response.status}`
        );
        return;
      }

      const loadedWorkspaces =
        data.workspaces || [];

      setWorkspaces(
        loadedWorkspaces
      );

      if (
        loadedWorkspaces.length === 0
      ) {
        setMessage(
          "You don't have any workspaces yet. Create one below."
        );
      } else {
        setMessage("");
      }
    } catch (error) {
      console.error(
        "Load workspaces error:",
        error
      );

      setMessage(
        "Unable to connect to Nova backend. Make sure the server is running."
      );
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadWorkspaces();
    loadPreferences();
    loadEvaluations();
    loadUsageLogs();
  }, []);

  // =========================================================
  // CREATE WORKSPACE
  // =========================================================

  const createWorkspace = async () => {
    const trimmedWorkspaceName =
      workspaceName.trim();

    if (!trimmedWorkspaceName) {
      setMessage(
        "Workspace name enter karo."
      );
      return;
    }

    if (!token) {
      handleUnauthorized();
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/v1/workspaces?name=${encodeURIComponent(
          trimmedWorkspaceName
        )}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      console.log(
        "CREATE WORKSPACE STATUS:",
        response.status
      );

      console.log(
        "CREATE WORKSPACE RESPONSE:",
        data
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            data.detail ||
            `Create failed. Status: ${response.status}`
        );
        return;
      }

      setWorkspaceName("");

      setMessage(
        "Workspace created successfully ✅"
      );

      await loadWorkspaces();
    } catch (error) {
      console.error(
        "Workspace creation error:",
        error
      );

      setMessage(
        "Unable to connect to Nova backend. Make sure the server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // RENAME WORKSPACE
  // =========================================================

  const startWorkspaceRename = (
    workspace
  ) => {
    setEditingWorkspaceId(
      workspace.id
    );

    setEditWorkspaceName(
      workspace.name || ""
    );

    setMessage("");
  };

  const cancelWorkspaceRename = () => {
    setEditingWorkspaceId(null);
    setEditWorkspaceName("");
  };

  const saveWorkspaceRename = async (
    workspaceId
  ) => {
    const trimmedName =
      editWorkspaceName.trim();

    if (!trimmedName) {
      setMessage(
        "Workspace name cannot be empty."
      );
      return;
    }

    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setRenamingWorkspace(true);
      setMessage("");

      const response = await fetch(
        `http://127.0.0.1:8000/api/v1/workspaces/${workspaceId}?name=${encodeURIComponent(
          trimmedName
        )}`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      console.log(
        "RENAME WORKSPACE STATUS:",
        response.status
      );

      console.log(
        "RENAME WORKSPACE RESPONSE:",
        data
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            data.detail ||
            `Rename failed. Status: ${response.status}`
        );
        return;
      }

      const updatedWorkspace =
        data.workspace;

      setWorkspaces((previous) =>
        previous.map((workspace) =>
          workspace.id === workspaceId
            ? updatedWorkspace
            : workspace
        )
      );

      setEditingWorkspaceId(null);
      setEditWorkspaceName("");

      setMessage(
        "Workspace renamed successfully ✅"
      );
    } catch (error) {
      console.error(
        "Workspace rename error:",
        error
      );

      setMessage(
        "Unable to rename workspace."
      );
    } finally {
      setRenamingWorkspace(false);
    }
  };

  const handleRenameKeyDown = (
    e,
    workspaceId
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();

      saveWorkspaceRename(
        workspaceId
      );

      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();

      cancelWorkspaceRename();
    }
  };

  // =========================================================
  // DELETE WORKSPACE
  // =========================================================

  const deleteWorkspace = async (
    workspaceId
  ) => {
    const workspace =
      workspaces.find(
        (item) =>
          item.id === workspaceId
      );

    const workspaceTitle =
      workspace?.name ||
      "this workspace";

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${workspaceTitle}"?`
      );

    if (!confirmed) {
      return;
    }

    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setDeletingWorkspaceId(
        workspaceId
      );

      setMessage("");

      const response = await fetch(
        `http://127.0.0.1:8000/api/v1/workspaces/${workspaceId}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      console.log(
        "DELETE WORKSPACE STATUS:",
        response.status
      );

      console.log(
        "DELETE WORKSPACE RESPONSE:",
        data
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            data.detail ||
            `Delete failed. Status: ${response.status}`
        );
        return;
      }

      setWorkspaces((previous) =>
        previous.filter(
          (workspace) =>
            workspace.id !==
            workspaceId
        )
      );

      setMessage(
        "Workspace deleted successfully ✅"
      );
    } catch (error) {
      console.error(
        "Workspace delete error:",
        error
      );

      setMessage(
        "Unable to delete workspace."
      );
    } finally {
      setDeletingWorkspaceId(
        null
      );
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    localStorage.removeItem("nova_token");
    localStorage.removeItem("nova_user");

    onLogout();
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      className={`min-h-screen ${
        preferences.theme === "dark"
          ? "nova-dark-theme"
          : "nova-light-theme"
      }`}
    >
      {/* ===================================================
          HEADER
          =================================================== */}

      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            Nova AI Workspace
          </h1>

          <p className="text-xs sm:text-sm text-slate-500">
            Dashboard
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
        >
          Logout
        </button>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 sm:space-y-6">

        {/* =================================================
            WELCOME
            ================================================= */}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Welcome
            {user?.name
              ? `, ${user.name}`
              : ""}{" "}
            👋
          </h2>

          <p className="text-slate-500 mt-2 text-sm">
            You are successfully logged in to Nova AI Workspace.
          </p>

          <p className="text-xs text-slate-400 mt-3">
            Authentication:{" "}
            {token
              ? "Active ✅"
              : "Missing ❌"}
          </p>
        </div>

        {/* =================================================
            CREATE WORKSPACE
            ================================================= */}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
            Create Workspace
          </h3>

          <p className="text-slate-500 mt-1 mb-4 text-sm">
            Create a new workspace to start working.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={workspaceName}
              onChange={(e) =>
                setWorkspaceName(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !loading
                ) {
                  createWorkspace();
                }
              }}
              placeholder="Enter workspace name"
              className="flex-1 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 bg-white outline-none focus:ring-2 focus:ring-slate-900"
            />

            <button
              type="button"
              onClick={createWorkspace}
              disabled={loading}
              className="bg-slate-900 text-white px-5 py-3 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-800 transition"
            >
              {loading
                ? "Creating..."
                : "Create"}
            </button>
          </div>

          {message && (
            <div className="mt-4">
              <p
                className={`text-sm break-words ${
                  message.includes(
                    "successfully"
                  )
                    ? "text-green-600"
                    : "text-slate-600"
                }`}
              >
                {message}
              </p>
            </div>
          )}
        </div>

        {/* =================================================
            PREFERENCES
            ================================================= */}

        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                Preferences
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Customize language, theme, and your preferred AI model.
              </p>
            </div>

            <span className="text-xs font-medium text-slate-400">
              {loadingPreferences
                ? "Loading..."
                : "Saved to account"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">

            {/* Language */}
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Language
              </span>

              <select
                value={
                  preferences.language
                }
                onChange={(e) =>
                  setPreferences(
                    (current) => ({
                      ...current,
                      language:
                        e.target.value,
                    })
                  )
                }
                disabled={
                  loadingPreferences ||
                  savingPreferences
                }
                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 bg-white outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
              >
                <option value="en">
                  English
                </option>

                <option value="hi">
                  Hindi
                </option>
              </select>
            </label>

            {/* Theme */}
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Theme
              </span>

              <select
                value={
                  preferences.theme
                }
                onChange={(e) => {
                  const nextTheme =
                    e.target.value;

                  setPreferences(
                    (current) => ({
                      ...current,
                      theme: nextTheme,
                    })
                  );

                  applyTheme(
                    nextTheme
                  );
                }}
                disabled={
                  loadingPreferences ||
                  savingPreferences
                }
                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 bg-white outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
              >
                <option value="light">
                  Light
                </option>

                <option value="dark">
                  Dark
                </option>
              </select>
            </label>

            {/* Model */}
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-2">
                AI Model
              </span>

              <select
                value={
                  preferences.model_preference
                }
                onChange={(e) =>
                  setPreferences(
                    (current) => ({
                      ...current,
                      model_preference:
                        e.target.value,
                    })
                  )
                }
                disabled={
                  loadingPreferences ||
                  savingPreferences
                }
                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 bg-white outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
              >
                <option value="gemini-3.6-flash">
                  Gemini 3.6 Flash
                </option>

                <option value="gemini-3.6-pro">
                  Gemini 3.6 Pro
                </option>

                <option value="gpt-5.6">
                  GPT-5.6
                </option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Changes are saved to your Nova account.
            </p>

            <button
              type="button"
              onClick={savePreferences}
              disabled={
                loadingPreferences ||
                savingPreferences
              }
              className="bg-slate-900 text-white px-5 py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
            >
              {savingPreferences
                ? "Saving..."
                : "Save Preferences"}
            </button>
          </div>
        </section>

        {/* =================================================
            DAY 42 - AI EVALUATION + USAGE
            ================================================= */}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* =================================================
              AI EVALUATIONS
              ================================================= */}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                  AI Evaluations
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Your AI response evaluation activity.
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 px-3 py-2">
                <p className="text-xl font-bold text-slate-900">
                  {evaluations.length}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              Total evaluations
            </p>

            {evaluations.length > 0 ? (
              <div className="mt-5 space-y-3">
                {evaluations
                  .slice(0, 5)
                  .map(
                    (evaluation, index) => (
                      <div
                        key={
                          evaluation.id ||
                          index
                        }
                        className="border border-slate-200 rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-900">
                            Score:{" "}
                            {evaluation.score ??
                              "N/A"}
                          </span>

                          <span className="text-xs text-slate-400">
                            {evaluation.evaluation_type ||
                              "General"}
                          </span>
                        </div>

                        {evaluation.feedback && (
                          <p className="text-xs text-slate-500 mt-2">
                            {evaluation.feedback}
                          </p>
                        )}
                      </div>
                    )
                  )}
              </div>
            ) : (
              <div className="mt-5 border border-dashed border-slate-300 rounded-xl p-5 text-center">
                <p className="text-sm text-slate-500">
                  No evaluations yet.
                </p>

                <p className="text-xs text-slate-400 mt-1">
                  Evaluation activity will appear here.
                </p>
              </div>
            )}
          </div>

          {/* =================================================
              AI USAGE
              ================================================= */}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                  AI Usage
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Your AI usage activity.
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 px-3 py-2">
                <p className="text-xl font-bold text-slate-900">
                  {usageLogs.length}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              Total usage records
            </p>

            {usageLogs.length > 0 ? (
              <div className="mt-5 space-y-3">
                {usageLogs
                  .slice(0, 5)
                  .map(
                    (usage, index) => (
                      <div
                        key={
                          usage.id ||
                          index
                        }
                        className="border border-slate-200 rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-900">
                            {usage.model ||
                              usage.model_name ||
                              "AI Model"}
                          </span>

                          <span className="text-xs text-slate-400">
                            {usage.tokens ??
                              usage.total_tokens ??
                              0}{" "}
                            tokens
                          </span>
                        </div>

                        {usage.endpoint && (
                          <p className="text-xs text-slate-500 mt-2">
                            {usage.endpoint}
                          </p>
                        )}
                      </div>
                    )
                  )}
              </div>
            ) : (
              <div className="mt-5 border border-dashed border-slate-300 rounded-xl p-5 text-center">
                <p className="text-sm text-slate-500">
                  No usage records yet.
                </p>

                <p className="text-xs text-slate-400 mt-1">
                  Usage activity will appear here.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            WORKSPACES
            ================================================= */}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                Your Workspaces
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Open a workspace to continue.
              </p>
            </div>

            {loadingWorkspaces && (
              <span className="text-xs text-slate-400">
                Loading...
              </span>
            )}
          </div>

          {loadingWorkspaces ? (
            <div className="mt-4 space-y-3">
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="mt-5 border border-dashed border-slate-300 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-500">
                No workspaces yet.
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Create your first workspace above.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {workspaces.map(
                (item) => (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition"
                  >
                    {editingWorkspaceId ===
                    item.id ? (
                      <div>
                        <input
                          type="text"
                          value={
                            editWorkspaceName
                          }
                          onChange={(e) =>
                            setEditWorkspaceName(
                              e.target.value
                            )
                          }
                          onKeyDown={(e) =>
                            handleRenameKeyDown(
                              e,
                              item.id
                            )
                          }
                          autoFocus
                          maxLength={100}
                          disabled={
                            renamingWorkspace
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900"
                        />

                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() =>
                              saveWorkspaceRename(
                                item.id
                              )
                            }
                            disabled={
                              renamingWorkspace
                            }
                            className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                          >
                            {renamingWorkspace
                              ? "Saving..."
                              : "Save"}
                          </button>

                          <button
                            type="button"
                            onClick={
                              cancelWorkspaceRename
                            }
                            disabled={
                              renamingWorkspace
                            }
                            className="bg-slate-200 text-slate-900 px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

                        <button
                          type="button"
                          onClick={() =>
                            onOpenWorkspace(
                              item
                            )
                          }
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="font-semibold text-slate-900 truncate">
                            {item.name}
                          </p>

                          {item.created_at && (
                            <p className="text-xs text-slate-500 mt-1">
                              Created:{" "}
                              {new Date(
                                item.created_at
                              ).toLocaleString()}
                            </p>
                          )}
                        </button>

                        <div className="flex flex-wrap items-center gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              startWorkspaceRename(
                                item
                              )
                            }
                            disabled={
                              deletingWorkspaceId ===
                              item.id
                            }
                            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                          >
                            Rename
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteWorkspace(
                                item.id
                              )
                            }
                            disabled={
                              deletingWorkspaceId ===
                              item.id
                            }
                            className="px-3 py-2 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                          >
                            {deletingWorkspaceId ===
                            item.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onOpenWorkspace(
                                item
                              )
                            }
                            disabled={
                              deletingWorkspaceId ===
                              item.id
                            }
                            className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition disabled:opacity-50"
                          >
                            Open →
                          </button>

                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;