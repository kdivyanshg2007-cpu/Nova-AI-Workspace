import { useEffect, useState } from "react";

function Files({ workspace, onBack }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
        .map(
          (item) =>
            item?.msg ||
            item?.message ||
            "Validation error",
        )
        .join(", ");
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    return fallback;
  };

  const loadFiles = async () => {
    if (!token) {
      setError(
        "Your session has expired. Please login again.",
      );
      setLoading(false);
      return;
    }

    if (!workspaceId) {
      setError("Workspace ID not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/files?workspace_id=${encodeURIComponent(
          workspaceId,
        )}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data =
        await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");
        localStorage.removeItem("nova_workspace_id");
        localStorage.removeItem("nova_workspace");

        setError(
          "Your session has expired. Please login again.",
        );
        return;
      }

      if (!response.ok) {
        setError(
          getErrorMessage(
            data,
            `Unable to load files. Status: ${response.status}`,
          ),
        );
        return;
      }

      setFiles(
        Array.isArray(data?.files)
          ? data.files
          : [],
      );
    } catch (err) {
      console.error("LOAD FILES ERROR:", err);

      setError(
        "Unable to connect to Nova backend.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const formatFileSize = (bytes) => {
    const size = Number(bytes || 0);

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    if (size < 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(
      size /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  };

  const handleFileSelection = (event) => {
    const file = event.target.files?.[0] || null;

    setSelectedFile(file);
    setError("");
    setMessage("");
  };

  const handleUpload = async () => {
    if (!token) {
      setError(
        "Your session has expired. Please login again.",
      );
      return;
    }

    if (!workspaceId) {
      setError("Workspace ID not found.");
      return;
    }

    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();

      formData.append("workspace_id", String(workspaceId));
      formData.append("file", selectedFile);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/chat/attachments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data =
        await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");
        localStorage.removeItem("nova_workspace_id");
        localStorage.removeItem("nova_workspace");

        setError(
          "Your session has expired. Please login again.",
        );
        return;
      }

      if (!response.ok || data.success === false) {
  setError(
    getErrorMessage(
      data,
      `Upload failed. Status: ${response.status}`,
    ),
  );
  return;
}
      setMessage(
        `${selectedFile.name} uploaded successfully ✅`,
      );

      setSelectedFile(null);

      const fileInput =
        document.getElementById(
          "nova-file-upload-input",
        );

      if (fileInput) {
        fileInput.value = "";
      }

      await loadFiles();
    } catch (err) {
      console.error(
        "FILE UPLOAD ERROR:",
        err,
      );

      setError(
        "Unable to upload file. Please check the backend.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    if (!token) {
      setError(
        "Your session has expired. Please login again.",
      );
      return;
    }

    const fileId = file?.id;

    if (
      fileId === null ||
      fileId === undefined
    ) {
      setError(
        "This file does not have a valid ID.",
      );
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/files/${encodeURIComponent(
          fileId,
        )}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");
        localStorage.removeItem("nova_workspace_id");
        localStorage.removeItem("nova_workspace");

        setError(
          "Your session has expired. Please login again.",
        );
        return;
      }

      if (!response.ok) {
        const data =
          await response.json().catch(() => ({}));

        setError(
          getErrorMessage(
            data,
            `Download failed. Status: ${response.status}`,
          ),
        );
        return;
      }

      const blob = await response.blob();

      const downloadUrl =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = downloadUrl;
      link.download =
        file.filename || "download";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);

      setMessage(
        `${file.filename} downloaded successfully ✅`,
      );
    } catch (err) {
      console.error(
        "FILE DOWNLOAD ERROR:",
        err,
      );

      setError(
        "Unable to download file.",
      );
    }
  };

  const handleDelete = async (file) => {
    if (!token) {
      setError(
        "Your session has expired. Please login again.",
      );
      return;
    }

    const fileId = file?.id;

    if (
      fileId === null ||
      fileId === undefined
    ) {
      setError(
        "This file does not have a valid ID.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${file.filename}"?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/files/${encodeURIComponent(
          fileId,
        )}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data =
        await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem("nova_token");
        localStorage.removeItem("nova_user");
        localStorage.removeItem("nova_workspace_id");
        localStorage.removeItem("nova_workspace");

        setError(
          "Your session has expired. Please login again.",
        );
        return;
      }

      if (!response.ok) {
        setError(
          getErrorMessage(
            data,
            `Delete failed. Status: ${response.status}`,
          ),
        );
        return;
      }

      setFiles((currentFiles) =>
        currentFiles.filter(
          (currentFile) =>
            currentFile.id !== fileId,
        ),
      );

      setMessage(
        "File deleted successfully ✅",
      );
    } catch (err) {
      console.error(
        "DELETE FILE ERROR:",
        err,
      );

      setError(
        "Unable to delete file.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Files 📁
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
        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Upload File
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Upload a file to this workspace.
            </p>
          </div>

          <div className="mt-5 flex flex-col md:flex-row gap-3">
            <input
              id="nova-file-upload-input"
              type="file"
              onChange={handleFileSelection}
              className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            />

            <button
              type="button"
              onClick={handleUpload}
              disabled={
                uploading || !selectedFile
              }
              className="bg-black text-white px-5 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition"
            >
              {uploading
                ? "Uploading..."
                : "Upload"}
            </button>
          </div>

          {selectedFile && (
            <p className="mt-3 text-sm text-slate-600">
              Selected:{" "}
              <span className="font-medium">
                {selectedFile.name}
              </span>
            </p>
          )}
        </section>

        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Workspace Files
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                View, download, and delete files saved
                in this workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={loadFiles}
              className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
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

          {loading ? (
            <div className="mt-6 border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-500">
                Loading files...
              </p>
            </div>
          ) : files.length === 0 ? (
            <div className="mt-6 border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <div className="text-4xl">
                📁
              </div>

              <p className="font-semibold text-slate-800 mt-3">
                No files yet
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Upload your first file above.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                      File
                    </th>

                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                      Type
                    </th>

                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                      Size
                    </th>

                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">
                      Created
                    </th>

                    <th className="text-right px-3 py-3 text-sm font-semibold text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {files.map((file, index) => (
                    <tr
                      key={
                        file?.id != null
                          ? `file-${file.id}`
                          : `file-${index}`
                      }
                      className="border-b last:border-b-0"
                    >
                      <td className="px-3 py-4">
                        <p className="font-medium text-slate-900 break-words">
                          {file.filename}
                        </p>
                      </td>

                      <td className="px-3 py-4 text-sm text-slate-600">
                        {file.mime_type ||
                          "Unknown"}
                      </td>

                      <td className="px-3 py-4 text-sm text-slate-600">
                        {formatFileSize(
                          file.file_size,
                        )}
                      </td>

                      <td className="px-3 py-4 text-sm text-slate-600">
                        {file.created_at
                          ? new Date(
                              file.created_at,
                            ).toLocaleString()
                          : "—"}
                      </td>

                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleDownload(file)
                            }
                            className="border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-white"
                          >
                            Download
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(file)
                            }
                            className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Files;