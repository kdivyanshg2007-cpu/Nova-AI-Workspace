import { useEffect, useState } from "react";

function Dashboard({ onLogout, onOpenWorkspace }) {
  const user = JSON.parse(
    localStorage.getItem("nova_user") || "null"
  );

  const token = localStorage.getItem("nova_token");

  const [workspaceName, setWorkspaceName] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const [workspaces, setWorkspaces] = useState([]);
  const [archivedWorkspaces, setArchivedWorkspaces] =
    useState([]);

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

  const [archivingWorkspaceId, setArchivingWorkspaceId] =
    useState(null);

  const [restoringWorkspaceId, setRestoringWorkspaceId] =
    useState(null);

  const [showArchived, setShowArchived] =
    useState(false);

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

  const [evaluations, setEvaluations] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

  const handleUnauthorized = () => {
    localStorage.removeItem("nova_token");
    localStorage.removeItem("nova_user");

    setWorkspaces([]);
    setArchivedWorkspaces([]);

    setMessage(
      "Your session has expired. Please login again."
    );

    onLogout();
  };

  const loadPreferences = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setLoadingPreferences(true);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/preferences`,
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

  const savePreferences = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setSavingPreferences(true);
      setMessage("");

      const response = await fetch(
        `${API_BASE_URL}/api/v1/preferences`,
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

  const loadEvaluations = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/evaluations`,
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

  const loadUsageLogs = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/usage`,
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
        data.usage || []
      );
    } catch (error) {
      console.error(
        "Load usage logs error:",
        error
      );
    }
  };

  const loadWorkspaces = async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setLoadingWorkspaces(true);
      setMessage("");

      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces?include_archived=true`,
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

      const activeWorkspaces =
        loadedWorkspaces.filter(
          (workspace) =>
            !workspace.is_archived
        );

      const loadedArchivedWorkspaces =
        loadedWorkspaces.filter(
          (workspace) =>
            workspace.is_archived
        );

      setWorkspaces(
        activeWorkspaces
      );

      setArchivedWorkspaces(
        loadedArchivedWorkspaces
      );

      if (
        activeWorkspaces.length === 0 &&
        loadedArchivedWorkspaces.length === 0
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

  useEffect(() => {
    loadWorkspaces();
    loadPreferences();
    loadEvaluations();
    loadUsageLogs();
  }, []);

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
        `${API_BASE_URL}/api/v1/workspaces?name=${encodeURIComponent(
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
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}?name=${encodeURIComponent(
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

  const archiveWorkspace = async (
    workspaceId
  ) => {
    if (!token) {
      handleUnauthorized();
      return;
    }

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
        `Archive "${workspaceTitle}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setArchivingWorkspaceId(
        workspaceId
      );

      setMessage("");

      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/archive`,
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
        "ARCHIVE WORKSPACE STATUS:",
        response.status
      );

      console.log(
        "ARCHIVE WORKSPACE RESPONSE:",
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
            `Archive failed. Status: ${response.status}`
        );
        return;
      }

      setWorkspaces((previous) =>
        previous.filter(
          (item) =>
            item.id !== workspaceId
        )
      );

      const archivedWorkspace =
        data.workspace ||
        workspace ||
        null;

      if (archivedWorkspace) {
        setArchivedWorkspaces(
          (previous) => [
            ...previous.filter(
              (item) =>
                item.id !== workspaceId
            ),
            {
              ...archivedWorkspace,
              is_archived: true,
            },
          ]
        );
      }

      setMessage(
        "Workspace archived successfully ✅"
      );
    } catch (error) {
      console.error(
        "Workspace archive error:",
        error
      );

      setMessage(
        "Unable to archive workspace."
      );
    } finally {
      setArchivingWorkspaceId(
        null
      );
    }
  };

  const unarchiveWorkspace = async (
    workspaceId
  ) => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setRestoringWorkspaceId(
        workspaceId
      );

      setMessage("");

      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/unarchive`,
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
        "RESTORE WORKSPACE STATUS:",
        response.status
      );

      console.log(
        "RESTORE WORKSPACE RESPONSE:",
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
            `Restore failed. Status: ${response.status}`
        );
        return;
      }

      const restoredWorkspace =
        data.workspace ||
        archivedWorkspaces.find(
          (item) =>
            item.id === workspaceId
        );

      setArchivedWorkspaces(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !== workspaceId
          )
      );

      if (restoredWorkspace) {
        setWorkspaces(
          (previous) => [
            ...previous.filter(
              (item) =>
                item.id !== workspaceId
            ),
            {
              ...restoredWorkspace,
              is_archived: false,
            },
          ]
        );
      }

      setMessage(
        "Workspace restored successfully ✅"
      );
    } catch (error) {
      console.error(
        "Workspace restore error:",
        error
      );

      setMessage(
        "Unable to restore workspace."
      );
    } finally {
      setRestoringWorkspaceId(
        null
      );
    }
  };

  const deleteWorkspace = async (
    workspaceId,
    fromArchived = false
  ) => {
    const sourceList =
      fromArchived
        ? archivedWorkspaces
        : workspaces;

    const workspace =
      sourceList.find(
        (item) =>
          item.id === workspaceId
      );

    const workspaceTitle =
      workspace?.name ||
      "this workspace";

    const confirmed =
      window.confirm(
        `Are you sure you want to permanently delete "${workspaceTitle}"?`
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
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}`,
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

      setArchivedWorkspaces((previous) =>
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

  const handleLogout = () => {
    localStorage.removeItem("nova_token");
    localStorage.removeItem("nova_user");

    onLogout();
  };

  return (
    <div
      className={`min-h-screen ${
        preferences.theme === "dark"
          ? "nova-dark-theme"
          : "nova-light-theme"
      }`}
    >
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

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

        {/* ACTIVE WORKSPACES */}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
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
                No active workspaces.
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Create a workspace above or restore an archived one.
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
                                item.id ||
                              archivingWorkspaceId ===
                                item.id
                            }
                            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                          >
                            Rename
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              archiveWorkspace(
                                item.id
                              )
                            }
                            disabled={
                              deletingWorkspaceId ===
                                item.id ||
                              archivingWorkspaceId ===
                                item.id
                            }
                            className="px-3 py-2 rounded-lg border border-amber-200 text-xs font-medium text-amber-700 hover:bg-amber-50 transition disabled:opacity-50"
                          >
                            {archivingWorkspaceId ===
                            item.id
                              ? "Archiving..."
                              : "Archive"}
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
                                item.id ||
                              archivingWorkspaceId ===
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

        {/* ARCHIVED WORKSPACES */}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                Archived Workspaces
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Restore workspaces whenever you need them again.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowArchived(
                  (current) => !current
                )
              }
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              {showArchived
                ? "Hide"
                : `Show (${archivedWorkspaces.length})`}
            </button>
          </div>

          {showArchived && (
            <div className="mt-4">
              {archivedWorkspaces.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center">
                  <p className="text-sm text-slate-500">
                    No archived workspaces.
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Archived workspaces will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {archivedWorkspaces.map(
                    (item) => (
                      <div
                        key={item.id}
                        className="border border-slate-200 bg-slate-50 rounded-xl p-4"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">
                              {item.name}
                            </p>

                            <p className="text-xs text-slate-500 mt-1">
                              Archived workspace
                            </p>

                            {item.created_at && (
                              <p className="text-xs text-slate-400 mt-1">
                                Created:{" "}
                                {new Date(
                                  item.created_at
                                ).toLocaleString()}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                unarchiveWorkspace(
                                  item.id
                                )
                              }
                              disabled={
                                restoringWorkspaceId ===
                                  item.id ||
                                deletingWorkspaceId ===
                                  item.id
                              }
                              className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition disabled:opacity-50"
                            >
                              {restoringWorkspaceId ===
                              item.id
                                ? "Restoring..."
                                : "Restore"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteWorkspace(
                                  item.id,
                                  true
                                )
                              }
                              disabled={
                                deletingWorkspaceId ===
                                  item.id ||
                                restoringWorkspaceId ===
                                  item.id
                              }
                              className="px-3 py-2 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                            >
                              {deletingWorkspaceId ===
                              item.id
                                ? "Deleting..."
                                : "Delete Permanently"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;