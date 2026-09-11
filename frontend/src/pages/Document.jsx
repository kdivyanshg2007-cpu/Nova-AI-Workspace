import { useEffect, useState } from "react";

function Document({ workspace, onBack }) {
  const token = localStorage.getItem("nova_token");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedDocument, setSelectedDocument] =
    useState(null);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000";

  // =========================================================
  // LOAD DOCUMENTS
  // =========================================================

  const loadDocuments = async () => {
    if (!workspace?.id) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/documents?workspace_id=${workspace.id}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message || "Documents load nahi hue."
        );
        return;
      }

      setDocuments(data.documents || []);
    } catch (error) {
      console.error(
        "Load documents error:",
        error
      );

      setMessage(
        "Documents load nahi ho pa rahe."
      );
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [workspace]);

  // =========================================================
  // CREATE DOCUMENT
  // =========================================================

  const createDocument = async () => {
    if (!title.trim() || !content.trim()) {
      setMessage(
        "Title aur content dono enter karo."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/documents?workspace_id=${
          workspace.id
        }&title=${encodeURIComponent(
          title
        )}&content=${encodeURIComponent(
          content
        )}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            "Document create nahi hua."
        );
        return;
      }

      setTitle("");
      setContent("");

      setMessage(
        "Document created successfully ✅"
      );

      await loadDocuments();
    } catch (error) {
      console.error(
        "Create document error:",
        error
      );

      setMessage(
        "Backend se connection nahi ho raha."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // EDIT
  // =========================================================

  const startEditing = (document) => {
    setEditingId(document.id);
    setEditTitle(document.title);
    setEditContent(document.content);
    setSelectedDocument(null);
    setMessage("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  // =========================================================
  // UPDATE
  // =========================================================

  const updateDocument = async () => {
    if (
      !editTitle.trim() ||
      !editContent.trim()
    ) {
      setMessage(
        "Title aur content dono enter karo."
      );
      return;
    }

    setEditLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/documents/${editingId}?title=${encodeURIComponent(
          editTitle
        )}&content=${encodeURIComponent(
          editContent
        )}`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            "Document update nahi hua."
        );
        return;
      }

      setMessage(
        "Document updated successfully ✅"
      );

      cancelEditing();

      await loadDocuments();
    } catch (error) {
      console.error(
        "Update document error:",
        error
      );

      setMessage(
        "Backend se connection nahi ho raha."
      );
    } finally {
      setEditLoading(false);
    }
  };

  // =========================================================
  // DELETE
  // =========================================================

  const deleteDocument = async (
    documentId
  ) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this document?"
    );

    if (!confirmed) return;

    setDeleteLoadingId(documentId);
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/documents/${documentId}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            "Document delete nahi hua."
        );
        return;
      }

      setMessage(
        "Document deleted successfully ✅"
      );

      if (
        editingId === documentId
      ) {
        cancelEditing();
      }

      if (
        selectedDocument?.id ===
        documentId
      ) {
        setSelectedDocument(null);
      }

      await loadDocuments();
    } catch (error) {
      console.error(
        "Delete document error:",
        error
      );

      setMessage(
        "Backend se connection nahi ho raha."
      );
    } finally {
      setDeleteLoadingId(null);
    }
  };

  // =========================================================
  // RAG VECTOR SEARCH
  // =========================================================

  const searchDocuments = async () => {
    if (!searchQuery.trim()) {
      await loadDocuments();
      return;
    }

    setSearchLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/documents/vector-search?workspace_id=${
          workspace.id
        }&query=${encodeURIComponent(
          searchQuery
        )}&limit=5`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            "Semantic search failed."
        );
        return;
      }

      const chunks = data.chunks || [];

      // -------------------------------------------------------
      // Convert returned chunks into document-like objects
      // so the existing UI can display them.
      // -------------------------------------------------------

      const uniqueDocuments = [];
      const seenDocumentIds = new Set();

      for (const chunk of chunks) {
        const documentId =
          chunk.document_id ?? chunk.id;

        if (
          documentId === undefined ||
          documentId === null
        ) {
          continue;
        }

        if (
          seenDocumentIds.has(documentId)
        ) {
          continue;
        }

        seenDocumentIds.add(
          documentId
        );

        uniqueDocuments.push({
          id: documentId,
          workspace_id:
            chunk.workspace_id ??
            workspace.id,
          user_id:
            chunk.user_id ?? null,
          title:
            chunk.title ||
            "Relevant document",
          content:
            chunk.content || "",
          created_at:
            chunk.created_at || null,
          updated_at:
            chunk.updated_at || null,
          similarity:
            chunk.similarity ??
            chunk.distance ??
            null,
          chunk_index:
            chunk.chunk_index ??
            null,
        });
      }

      setDocuments(
        uniqueDocuments
      );

      if (
        uniqueDocuments.length === 0
      ) {
        setMessage(
          "No semantically relevant documents found."
        );
      } else {
        setMessage(
          `Found ${uniqueDocuments.length} relevant document${
            uniqueDocuments.length ===
            1
              ? ""
              : "s"
          } ✅`
        );
      }
    } catch (error) {
      console.error(
        "Vector search error:",
        error
      );

      setMessage(
        "Semantic document search nahi ho pa rahi."
      );
    } finally {
      setSearchLoading(false);
    }
  };

  // =========================================================
  // OPEN DOCUMENT
  // =========================================================

  const openDocument = (document) => {
    setSelectedDocument(document);
    setMessage("");
  };

  const closeDocument = () => {
    setSelectedDocument(null);
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <header className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold truncate">
            {workspace?.name || "Workspace"} - Documents
          </h1>

          <p className="text-sm text-gray-500">
            Nova AI Workspace
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="bg-black text-white px-4 py-2 rounded-lg shrink-0"
        >
          Back
        </button>
      </header>

      <main className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

        {/* Create Document */}
        <div className="bg-white border rounded-2xl p-5 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold">
            Create Document
          </h2>

          <div className="space-y-4 mt-5">

            <input
              type="text"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="Document title"
              className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />

            <textarea
              value={content}
              onChange={(e) =>
                setContent(e.target.value)
              }
              placeholder="Write your document content..."
              rows={8}
              className="w-full border rounded-lg px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-black"
            />

            <button
              type="button"
              onClick={createDocument}
              disabled={loading}
              className="bg-black text-white px-5 py-3 rounded-lg disabled:opacity-50"
            >
              {loading
                ? "Creating..."
                : "Create Document"}
            </button>

          </div>
        </div>

        {/* Semantic Search */}
        <div className="bg-white border rounded-2xl p-5 sm:p-6">

          <h2 className="text-xl font-semibold">
            Semantic Document Search
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Search using meaning, not just exact keywords.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">

            <input
              type="text"
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !searchLoading
                ) {
                  searchDocuments();
                }
              }}
              placeholder="Ask something about your documents..."
              className="flex-1 border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />

            <button
              type="button"
              onClick={searchDocuments}
              disabled={
                searchLoading
              }
              className="bg-black text-white px-5 py-3 rounded-lg disabled:opacity-50"
            >
              {searchLoading
                ? "Searching..."
                : "Search"}
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setMessage("");
                loadDocuments();
              }}
              className="border px-5 py-3 rounded-lg"
            >
              Clear
            </button>

          </div>
        </div>

        {/* Message */}
        {message && (
          <p
            className={`text-sm px-2 ${
              message.includes(
                "successfully"
              ) ||
              message.includes(
                "Found"
              )
                ? "text-green-600"
                : "text-gray-600"
            }`}
          >
            {message}
          </p>
        )}

        {/* Documents */}
        <div className="bg-white border rounded-2xl p-5 sm:p-6">

          <div className="flex items-center justify-between gap-3">

            <div>
              <h2 className="text-xl font-semibold">
                Your Documents
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Click a document to open it.
              </p>
            </div>

            <span className="text-xs text-gray-400">
              {documents.length}{" "}
              {documents.length === 1
                ? "document"
                : "documents"}
            </span>

          </div>

          {documents.length === 0 ? (
            <p className="text-gray-500 mt-4">
              No documents found.
            </p>
          ) : (
            <div className="space-y-3 mt-4">

              {documents.map(
                (document) => (
                  <div
                    key={document.id}
                    className="border rounded-xl p-4"
                  >

                    {editingId ===
                    document.id ? (

                      <div className="space-y-4">

                        <input
                          type="text"
                          value={
                            editTitle
                          }
                          onChange={(e) =>
                            setEditTitle(
                              e.target.value
                            )
                          }
                          className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                        />

                        <textarea
                          value={
                            editContent
                          }
                          onChange={(e) =>
                            setEditContent(
                              e.target.value
                            )
                          }
                          rows={6}
                          className="w-full border rounded-lg px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-black"
                        />

                        <div className="flex flex-wrap gap-3">

                          <button
                            type="button"
                            onClick={
                              updateDocument
                            }
                            disabled={
                              editLoading
                            }
                            className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-50"
                          >
                            {editLoading
                              ? "Saving..."
                              : "Save Changes"}
                          </button>

                          <button
                            type="button"
                            onClick={
                              cancelEditing
                            }
                            disabled={
                              editLoading
                            }
                            className="border px-4 py-2 rounded-lg"
                          >
                            Cancel
                          </button>

                        </div>
                      </div>

                    ) : (

                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">

                        <button
                          type="button"
                          onClick={() =>
                            openDocument(
                              document
                            )
                          }
                          className="flex-1 text-left min-w-0"
                        >

                          <h3 className="font-semibold text-gray-900 break-words">
                            {document.title}
                          </h3>

                          <p className="text-sm text-gray-500 mt-2 line-clamp-3 break-words">
                            {document.content}
                          </p>

                          {document.similarity !==
                            null &&
                            document.similarity !==
                              undefined && (
                              <p className="text-xs text-gray-400 mt-2">
                                Similarity:{" "}
                                {typeof document.similarity ===
                                "number"
                                  ? document.similarity.toFixed(
                                      4
                                    )
                                  : document.similarity}
                              </p>
                            )}

                          <p className="text-xs text-gray-400 mt-3">
                            Click to open →
                          </p>

                        </button>

                        <div className="flex flex-wrap gap-2 shrink-0">

                          <button
                            type="button"
                            onClick={() =>
                              startEditing(
                                document
                              )
                            }
                            className="border px-4 py-2 rounded-lg text-sm"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteDocument(
                                document.id
                              )
                            }
                            disabled={
                              deleteLoadingId ===
                              document.id
                            }
                            className="border border-red-500 text-red-500 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                          >
                            {deleteLoadingId ===
                            document.id
                              ? "Deleting..."
                              : "Delete"}
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

      {/* Document Preview Modal */}
      {selectedDocument && (

        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={closeDocument}
        >

          <div
            className="bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="border-b px-5 sm:px-6 py-4 flex items-center justify-between gap-4">

              <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
                {selectedDocument.title}
              </h2>

              <button
                type="button"
                onClick={closeDocument}
                className="border px-3 py-2 rounded-lg text-sm shrink-0"
              >
                Close
              </button>

            </div>

            <div className="p-5 sm:p-6 overflow-y-auto max-h-[70vh]">

              <div className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-7">
                {selectedDocument.content}
              </div>

              {selectedDocument.created_at && (
                <p className="text-xs text-gray-400 mt-6">
                  Created:{" "}
                  {new Date(
                    selectedDocument.created_at
                  ).toLocaleString()}
                </p>
              )}

              {selectedDocument.updated_at && (
                <p className="text-xs text-gray-400 mt-1">
                  Updated:{" "}
                  {new Date(
                    selectedDocument.updated_at
                  ).toLocaleString()}
                </p>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default Document;