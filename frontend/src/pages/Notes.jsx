import { useEffect, useState } from "react";

function Notes({ workspace, onBack }) {
  const [notes, setNotes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("nova_token");

  const workspaceId =
    workspace?.id ??
    workspace?.workspace_id ??
    localStorage.getItem("nova_workspace_id");

  const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

  const normalizeNote = (note) => {
    if (Array.isArray(note)) {
      return {
        id: note[0],
        user_id: note[1],
        workspace_id: note[2],
        title: note[3],
        content: note[4],
        created_at: note[5],
        updated_at: note[6],
      };
    }

    return {
      ...note,
      id:
        note?.id ??
        note?.note_id ??
        note?.ID ??
        null,
    };
  };

  const loadNotes = async () => {
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
        `${API_BASE_URL}/api/v1/productivity/notes${query}`,
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
            `Unable to load notes. Status: ${response.status}`
          )
        );
        return;
      }

      const normalizedNotes = (
        Array.isArray(data?.notes)
          ? data.notes
          : []
      ).map(normalizeNote);

      setNotes(normalizedNotes);
    } catch (err) {
      console.error("LOAD NOTES ERROR:", err);

      setError(
        "Unable to connect to Nova backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setEditingId(null);
  };

  const handleSaveNote = async () => {
    if (!token) {
      setError(
        "Your session has expired. Please login again."
      );
      return;
    }

    if (!title.trim()) {
      setError("Please enter a note title.");
      return;
    }

    if (!content.trim()) {
      setError("Please enter note content.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      let response;

      if (editingId !== null) {
        response = await fetch(
          `${API_BASE_URL}/api/v1/productivity/notes/${editingId}`,
          {
            method: "PUT",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: title.trim(),
              content: content.trim(),
            }),
          }
        );
      } else {
        response = await fetch(
          `${API_BASE_URL}/api/v1/productivity/notes`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: title.trim(),
              content: content.trim(),
              workspace_id: workspaceId
                ? Number(workspaceId)
                : null,
            }),
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
            `Unable to save note. Status: ${response.status}`
          )
        );
        return;
      }

      setMessage(
        editingId !== null
          ? "Note updated successfully ✅"
          : "Note created successfully ✅"
      );

      resetForm();

      await loadNotes();
    } catch (err) {
      console.error("SAVE NOTE ERROR:", err);

      setError("Unable to save note.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditNote = (note) => {
    const noteId = note?.id;

    if (noteId === null || noteId === undefined) {
      setError(
        "This note does not have a valid ID."
      );
      return;
    }

    setEditingId(noteId);
    setTitle(note?.title || "");
    setContent(note?.content || "");

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDeleteNote = async (note) => {
    if (!token) {
      setError(
        "Your session has expired. Please login again."
      );
      return;
    }

    const noteId =
      typeof note === "object"
        ? note?.id
        : note;

    if (
      noteId === null ||
      noteId === undefined ||
      noteId === ""
    ) {
      setError(
        "Unable to delete note because its ID is missing."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this note?"
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/productivity/notes/${encodeURIComponent(
          noteId
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
            `Unable to delete note. Status: ${response.status}`
          )
        );
        return;
      }

      setMessage(
        "Note deleted successfully ✅"
      );

      if (editingId === noteId) {
        resetForm();
      }

      setNotes((currentNotes) =>
        currentNotes.filter(
          (currentNote) =>
            currentNote.id !== noteId
        )
      );

      await loadNotes();
    } catch (err) {
      console.error("DELETE NOTE ERROR:", err);

      setError("Unable to delete note.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}

      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Notes 📝
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
        {/* CREATE / EDIT NOTE */}

        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {editingId !== null
                  ? "Edit Note"
                  : "Create a Note"}
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Save important information inside your
                workspace.
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Enter note title"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Content
              </label>

              <textarea
                value={content}
                onChange={(event) =>
                  setContent(event.target.value)
                }
                placeholder="Write your note..."
                rows={7}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300 resize-y"
                disabled={saving}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={saving}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                  ? "Update Note"
                  : "Create Note"}
              </button>

              {editingId === null && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="border border-slate-300 px-6 py-3 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Clear
                </button>
              )}
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

        {/* NOTES LIST */}

        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Your Notes
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                {notes.length} note
                {notes.length === 1
                  ? ""
                  : "s"} saved.
              </p>
            </div>

            <button
              type="button"
              onClick={loadNotes}
              className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-6 border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-500">
                Loading notes...
              </p>
            </div>
          ) : notes.length === 0 ? (
            <div className="mt-6 border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <div className="text-4xl">
                📝
              </div>

              <p className="font-semibold text-slate-800 mt-3">
                No notes yet
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Create your first note above.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {notes.map((note, index) => {
                const noteId = note?.id;

                return (
                  <article
                    key={
                      noteId !== null &&
                      noteId !== undefined
                        ? `note-${noteId}`
                        : `note-index-${index}`
                    }
                    className="border border-slate-200 rounded-2xl p-5 bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg text-slate-900 break-words">
                          {note?.title || "Untitled Note"}
                        </h3>

                        <p className="text-xs text-slate-500 mt-1">
                          Updated{" "}
                          {note?.updated_at
                            ? new Date(
                                note.updated_at
                              ).toLocaleString()
                            : "recently"}
                        </p>
                      </div>

                      <span className="text-xl">
                        📝
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                        {note?.content || ""}
                      </p>
                    </div>

                    <div className="flex gap-3 mt-5">
                      <button
                        type="button"
                        onClick={() =>
                          handleEditNote(note)
                        }
                        disabled={
                          noteId === null ||
                          noteId === undefined
                        }
                        className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteNote(note)
                        }
                        disabled={
                          noteId === null ||
                          noteId === undefined
                        }
                        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
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

export default Notes;