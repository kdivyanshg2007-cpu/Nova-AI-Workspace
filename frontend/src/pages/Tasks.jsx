import { useEffect, useState } from "react";

function Tasks({ workspace, onBack }) {
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending");
  const [deadline, setDeadline] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("nova_token");

  const workspaceId =
    workspace?.id ??
    workspace?.workspace_id ??
    localStorage.getItem("nova_workspace_id");

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000";

  const getErrorMessage = (data, fallback) => {
    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          return (
            item?.msg ||
            item?.message ||
            "Validation error"
          );
        })
        .join(", ");
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    return fallback;
  };

  const normalizeTask = (task) => {
    if (Array.isArray(task)) {
      return {
        id: task[0],
        user_id: task[1],
        workspace_id: task[2],
        title: task[3],
        description: task[4],
        priority: task[5],
        status: task[6],
        deadline: task[7],
        created_at: task[8],
        updated_at: task[9],
      };
    }

    return {
      ...task,
      id:
        task?.id ??
        task?.task_id ??
        task?.ID ??
        null,
    };
  };

  const loadTasks = async () => {
    if (!token) {
      setError(
        "Your session has expired. Please login again."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = workspaceId
        ? `?workspace_id=${encodeURIComponent(
            workspaceId
          )}`
        : "";

      const response = await fetch(
        `${API_BASE_URL}/api/v1/productivity/tasks${query}`,
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
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");

        setError(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setError(
          getErrorMessage(
            data,
            `Unable to load tasks. Status: ${response.status}`
          )
        );
        return;
      }

      const normalizedTasks = (
        Array.isArray(data?.tasks)
          ? data.tasks
          : []
      ).map(normalizeTask);

      setTasks(normalizedTasks);
    } catch (err) {
      console.error(
        "LOAD TASKS ERROR:",
        err
      );

      setError(
        "Unable to connect to Nova backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setStatus("pending");
    setDeadline("");
    setEditingId(null);
  };

  const handleSaveTask = async () => {
    if (!token) {
      setError(
        "Your session has expired. Please login again."
      );
      return;
    }

    if (!title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      let response;

      const taskBody = {
        title: title.trim(),
        description:
          description.trim() || null,
        priority,
        status,
        deadline: deadline
          ? new Date(deadline).toISOString()
          : null,
        workspace_id: workspaceId
          ? Number(workspaceId)
          : null,
      };

      if (editingId !== null) {
        response = await fetch(
          `${API_BASE_URL}/api/v1/productivity/tasks/${editingId}`,
          {
            method: "PUT",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: title.trim(),
              description:
                description.trim() || null,
              priority,
              status,
              deadline: deadline
                ? new Date(
                    deadline
                  ).toISOString()
                : null,
            }),
          }
        );
      } else {
        response = await fetch(
          `${API_BASE_URL}/api/v1/productivity/tasks`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(
              taskBody
            ),
          }
        );
      }

      const data =
        await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");

        setError(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setError(
          getErrorMessage(
            data,
            `Unable to save task. Status: ${response.status}`
          )
        );
        return;
      }

      setMessage(
        editingId !== null
          ? "Task updated successfully ✅"
          : "Task created successfully ✅"
      );

      resetForm();

      await loadTasks();
    } catch (err) {
      console.error(
        "SAVE TASK ERROR:",
        err
      );

      setError(
        "Unable to save task."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditTask = (task) => {
    const taskId = task?.id;

    if (
      taskId === null ||
      taskId === undefined
    ) {
      setError(
        "This task does not have a valid ID."
      );
      return;
    }

    setEditingId(taskId);
    setTitle(task?.title || "");
    setDescription(
      task?.description || ""
    );
    setPriority(
      task?.priority || "medium"
    );
    setStatus(
      task?.status || "pending"
    );

    if (task?.deadline) {
      const parsedDate =
        new Date(task.deadline);

      if (!Number.isNaN(parsedDate.getTime())) {
        const year =
          parsedDate.getFullYear();

        const month = String(
          parsedDate.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
          parsedDate.getDate()
        ).padStart(2, "0");

        const hours = String(
          parsedDate.getHours()
        ).padStart(2, "0");

        const minutes = String(
          parsedDate.getMinutes()
        ).padStart(2, "0");

        setDeadline(
          `${year}-${month}-${day}T${hours}:${minutes}`
        );
      } else {
        setDeadline("");
      }
    } else {
      setDeadline("");
    }

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDeleteTask = async (task) => {
    if (!token) {
      setError(
        "Your session has expired. Please login again."
      );
      return;
    }

    const taskId =
      typeof task === "object"
        ? task?.id
        : task;

    if (
      taskId === null ||
      taskId === undefined ||
      taskId === ""
    ) {
      setError(
        "Unable to delete task because its ID is missing."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this task?"
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/productivity/tasks/${encodeURIComponent(
          taskId
        )}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");

        setError(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setError(
          getErrorMessage(
            data,
            `Unable to delete task. Status: ${response.status}`
          )
        );
        return;
      }

      setMessage(
        "Task deleted successfully ✅"
      );

      if (editingId === taskId) {
        resetForm();
      }

      setTasks((currentTasks) =>
        currentTasks.filter(
          (currentTask) =>
            currentTask.id !== taskId
        )
      );

      await loadTasks();
    } catch (err) {
      console.error(
        "DELETE TASK ERROR:",
        err
      );

      setError(
        "Unable to delete task."
      );
    }
  };

  const getPriorityClass = (value) => {
    if (value === "high") {
      return "bg-red-100 text-red-700 border-red-200";
    }

    if (value === "low") {
      return "bg-green-100 text-green-700 border-green-200";
    }

    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  };

  const getStatusClass = (value) => {
    if (value === "completed") {
      return "bg-green-100 text-green-700 border-green-200";
    }

    if (value === "in_progress") {
      return "bg-blue-100 text-blue-700 border-blue-200";
    }

    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const formatDeadline = (value) => {
    if (!value) {
      return "No deadline";
    }

    const parsedDate =
      new Date(value);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return "Invalid deadline";
    }

    return parsedDate.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}

      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Tasks ✅
          </h1>

          <p className="text-sm text-slate-500">
            {workspace?.name || "Workspace"}
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="bg-black text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
        >
          Back to Workspace
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">

        {/* CREATE / EDIT TASK */}

        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {editingId !== null
                  ? "Edit Task"
                  : "Create a Task"}
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Manage your work, deadlines and priorities.
              </p>
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="mt-6 space-y-4">

            {/* TITLE */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(
                    event.target.value
                  )
                }
                placeholder="Enter task title"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
                disabled={saving}
              />
            </div>

            {/* DESCRIPTION */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="Describe the task..."
                rows={4}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300 resize-y"
                disabled={saving}
              />
            </div>

            {/* PRIORITY / STATUS */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Priority
                </label>

                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      event.target.value
                    )
                  }
                  disabled={saving}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="high">
                    High
                  </option>

                  <option value="medium">
                    Medium
                  </option>

                  <option value="low">
                    Low
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value
                    )
                  }
                  disabled={saving}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="pending">
                    Pending
                  </option>

                  <option value="in_progress">
                    In Progress
                  </option>

                  <option value="completed">
                    Completed
                  </option>
                </select>
              </div>

            </div>

            {/* DEADLINE */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Deadline
              </label>

              <input
                type="datetime-local"
                value={deadline}
                onChange={(event) =>
                  setDeadline(
                    event.target.value
                  )
                }
                disabled={saving}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            {/* BUTTONS */}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={
                  handleSaveTask
                }
                disabled={saving}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                  ? "Update Task"
                  : "Create Task"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="border border-slate-300 px-6 py-3 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Clear
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 text-green-700 px-4 py-3 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </section>

        {/* TASK LIST */}

        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Your Tasks
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                {tasks.length} task
                {tasks.length === 1
                  ? ""
                  : "s"} saved.
              </p>
            </div>

            <button
              type="button"
              onClick={loadTasks}
              className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-6 border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-500">
                Loading tasks...
              </p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="mt-6 border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <div className="text-4xl">
                ✅
              </div>

              <p className="font-semibold text-slate-800 mt-3">
                No tasks yet
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Create your first task above.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {tasks.map((task, index) => {
                const taskId =
                  task?.id;

                return (
                  <article
                    key={
                      taskId !== null &&
                      taskId !== undefined
                        ? `task-${taskId}`
                        : `task-index-${index}`
                    }
                    className="border border-slate-200 rounded-2xl p-5 bg-slate-50"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

                      <div className="min-w-0">
                        <h3 className="font-bold text-lg text-slate-900 break-words">
                          {task?.title ||
                            "Untitled Task"}
                        </h3>

                        {task?.description && (
                          <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap break-words">
                            {task.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 mt-4">
                          <span
                            className={`px-3 py-1 rounded-full border text-xs font-medium ${getPriorityClass(
                              task?.priority
                            )}`}
                          >
                            Priority:{" "}
                            {task?.priority ||
                              "medium"}
                          </span>

                          <span
                            className={`px-3 py-1 rounded-full border text-xs font-medium ${getStatusClass(
                              task?.status
                            )}`}
                          >
                            Status:{" "}
                            {task?.status ||
                              "pending"}
                          </span>
                        </div>

                        <div className="mt-4 space-y-1">
                          <p className="text-xs text-slate-500">
                            Deadline:{" "}
                            {formatDeadline(
                              task?.deadline
                            )}
                          </p>

                          {task?.updated_at && (
                            <p className="text-xs text-slate-400">
                              Updated:{" "}
                              {new Date(
                                task.updated_at
                              ).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleEditTask(
                              task
                            )
                          }
                          disabled={
                            taskId === null ||
                            taskId === undefined
                          }
                          className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteTask(
                              task
                            )
                          }
                          disabled={
                            taskId === null ||
                            taskId === undefined
                          }
                          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>

                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Tasks;