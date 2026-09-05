import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE = "http://127.0.0.1:8000/api/v1";

function Chat({ workspace, onBack }) {
  const token = localStorage.getItem("nova_token");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] =
    useState(false);

  const [selectedConversationId, setSelectedConversationId] =
    useState(null);

  const [creatingConversation, setCreatingConversation] =
    useState(false);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingConversationId, setEditingConversationId] =
    useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [renamingConversation, setRenamingConversation] =
    useState(false);
  const [deletingConversationId, setDeletingConversationId] =
    useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // =========================================================
  // ATTACHMENTS
  // =========================================================

  const [attachments, setAttachments] = useState([]);

  // =========================================================
  // DOCUMENT Q&A
  // =========================================================

  const [showDocumentQA, setShowDocumentQA] = useState(false);
  const [documentQuestion, setDocumentQuestion] = useState("");
  const [documentAnswer, setDocumentAnswer] = useState("");
  const [documentSources, setDocumentSources] = useState([]);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState("");

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const selectedConversation = conversations.find(
    (conversation) =>
      conversation.id === selectedConversationId
  );

  // =========================================================
  // SESSION
  // =========================================================

  const clearSession = () => {
    localStorage.removeItem("nova_token");
    localStorage.removeItem("nova_user");
  };

  // =========================================================
  // HELPERS
  // =========================================================

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    const maxHeight = 160;

    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      maxHeight
    )}px`;
  };

  const getFriendlyAIError = (
    responseStatus,
    backendMessage
  ) => {
    const normalizedMessage = String(
      backendMessage || ""
    ).toLowerCase();

    if (
      responseStatus === 429 ||
      normalizedMessage.includes("resource_exhausted") ||
      normalizedMessage.includes("quota")
    ) {
      return "Nova is temporarily unavailable because the AI service quota has been reached. Please try again later.";
    }

    if (responseStatus >= 500) {
      return "Nova is temporarily unavailable. Please try again later.";
    }

    return "Nova could not process your message. Please try again.";
  };

  // =========================================================
  // FILE UPLOAD
  // =========================================================

  const handleFileSelect = async (event) => {
    const selectedFiles = Array.from(
      event.target.files || []
    );

    if (selectedFiles.length === 0) {
      return;
    }

    if (!workspace?.id) {
      setError(
        "Please select a workspace before uploading a file."
      );

      return;
    }

    setError("");

    for (const file of selectedFiles) {
      try {
        const formData = new FormData();

        formData.append("file", file);

        formData.append(
          "workspace_id",
          String(workspace.id)
        );

        const response = await fetch(
          `${API_BASE}/chat/attachments`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        let data = {};

        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (response.status === 401) {
          clearSession();

          setAttachments([]);

          setError(
            "Your session has expired. Please login again."
          );

          return;
        }

        if (!response.ok || !data.success) {
          setError(
            data.message ||
              data.detail ||
              "File upload failed."
          );

          continue;
        }

        const uploadedFile = {
          id:
            data.attachment?.id ??
            null,

          name:
            data.attachment?.filename ||
            file.name,

          size:
            data.attachment?.size ||
            file.size,

          type:
            data.attachment?.content_type ||
            file.type,

          path:
            data.attachment?.path ||
            "",

          workspace_id:
            data.attachment?.workspace_id ??
            workspace.id,
        };

        setAttachments((previous) => [
          ...previous,
          uploadedFile,
        ]);

        // Clear old document answer when a new document is uploaded.
        setDocumentAnswer("");
        setDocumentSources([]);
        setDocumentError("");
      } catch (uploadError) {
        console.error(
          "File upload error:",
          uploadError
        );

        setError(
          "Unable to upload the selected file."
        );
      }
    }

    event.target.value = "";
  };

  const removeAttachment = (indexToRemove) => {
    setAttachments((previous) =>
      previous.filter(
        (_, index) =>
          index !== indexToRemove
      )
    );
  };

  const clearAttachments = () => {
    setAttachments([]);
  };

  // =========================================================
  // DOCUMENT Q&A
  // =========================================================

  const askDocumentQuestion = async () => {
    const trimmedQuestion =
      documentQuestion.trim();

    if (
      !trimmedQuestion ||
      documentLoading ||
      !workspace?.id
    ) {
      return;
    }

    setDocumentLoading(true);
    setDocumentError("");
    setDocumentAnswer("");
    setDocumentSources([]);

    try {
      const params = new URLSearchParams();

      params.set(
        "question",
        trimmedQuestion
      );

      params.set(
        "workspace_id",
        String(workspace.id)
      );

      params.set(
        "top_k",
        "5"
      );

      const response = await fetch(
        `${API_BASE}/documents/ask?${params.toString()}`,
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
        clearSession();

        setDocumentError(
          "Your session has expired. Please login again."
        );

        return;
      }

      if (!response.ok) {
        setDocumentError(
          data.message ||
            data.detail ||
            getFriendlyAIError(
              response.status,
              data.message || data.detail
            )
        );

        return;
      }

      if (data.success === false) {
        setDocumentError(
          data.message ||
            "Unable to answer from documents."
        );

        return;
      }

      setDocumentAnswer(
        data.answer ||
          "No answer was generated."
      );

      setDocumentSources(
        Array.isArray(data.sources)
          ? data.sources
          : []
      );
    } catch (documentErrorValue) {
      console.error(
        "Document Q&A error:",
        documentErrorValue
      );

      setDocumentError(
        "Unable to connect to the document Q&A service."
      );
    } finally {
      setDocumentLoading(false);
    }
  };

  const clearDocumentQA = () => {
    setDocumentQuestion("");
    setDocumentAnswer("");
    setDocumentSources([]);
    setDocumentError("");
  };

  const handleDocumentKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        !documentLoading &&
        documentQuestion.trim()
      ) {
        askDocumentQuestion();
      }
    }
  };

  // =========================================================
  // CONVERSATIONS
  // =========================================================

  const createConversationAutomatically =
    async () => {
      if (
        !workspace?.id ||
        creatingConversation
      ) {
        return null;
      }

      try {
        setCreatingConversation(true);
        setError("");

        const params = new URLSearchParams();

        params.set(
          "workspace_id",
          String(workspace.id)
        );

        params.set(
          "title",
          "New Chat"
        );

        const response = await fetch(
          `${API_BASE}/chat/conversations?${params.toString()}`,
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
          clearSession();

          setConversations([]);
          setMessages([]);
          setSelectedConversationId(null);
          clearAttachments();

          setError(
            "Your session has expired. Please login again."
          );

          return null;
        }

        if (!response.ok || !data.success) {
          setError(
            data.message ||
              data.detail ||
              "Unable to create a new conversation."
          );

          return null;
        }

        const newConversation =
          data.conversation;

        setConversations([
          newConversation,
        ]);

        setSelectedConversationId(
          newConversation.id
        );

        setMessages([]);
        clearAttachments();

        return newConversation;
      } catch (conversationError) {
        console.error(
          "Auto create conversation error:",
          conversationError
        );

        setError(
          "Unable to create a new conversation."
        );

        return null;
      } finally {
        setCreatingConversation(false);
      }
    };

  const loadConversations = async () => {
    if (!workspace?.id) {
      return;
    }

    try {
      setConversationsLoading(true);
      setError("");

      const params = new URLSearchParams();

      params.set(
        "workspace_id",
        String(workspace.id)
      );

      const response = await fetch(
        `${API_BASE}/chat/conversations?${params.toString()}`,
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

      if (response.status === 401) {
        clearSession();

        setConversations([]);
        setMessages([]);
        setSelectedConversationId(null);
        clearAttachments();

        setError(
          "Your session has expired. Please login again."
        );

        return;
      }

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            data.detail ||
            `Unable to load conversations. Status: ${response.status}`
        );

        return;
      }

      const loadedConversations =
        data.conversations || [];

      setConversations(
        loadedConversations
      );

      if (loadedConversations.length > 0) {
        const currentConversationStillExists =
          loadedConversations.some(
            (conversation) =>
              conversation.id ===
              selectedConversationId
          );

        if (!currentConversationStillExists) {
          setSelectedConversationId(
            loadedConversations[0].id
          );
        }

        return;
      }

      setSelectedConversationId(null);
      setMessages([]);

      await createConversationAutomatically();
    } catch (conversationError) {
      console.error(
        "Load conversations error:",
        conversationError
      );

      setError(
        "Unable to connect to Nova backend. Make sure the server is running."
      );
    } finally {
      setConversationsLoading(false);
    }
  };

  const loadMessages = async (
    conversationId = selectedConversationId
  ) => {
    if (
      !workspace?.id ||
      !conversationId
    ) {
      setMessages([]);
      return;
    }

    try {
      setError("");

      const params = new URLSearchParams();

      params.set(
        "workspace_id",
        String(workspace.id)
      );

      params.set(
        "conversation_id",
        String(conversationId)
      );

      const response = await fetch(
        `${API_BASE}/chat/messages?${params.toString()}`,
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

      if (response.status === 401) {
        clearSession();

        setMessages([]);
        setSelectedConversationId(null);
        clearAttachments();

        setError(
          "Your session has expired. Please login again."
        );

        return;
      }

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            data.detail ||
            `Unable to load chat messages. Status: ${response.status}`
        );

        return;
      }

      setMessages(data.messages || []);
    } catch (messageError) {
      console.error(
        "Load messages error:",
        messageError
      );

      setError(
        "Unable to connect to Nova backend."
      );
    }
  };

  useEffect(() => {
    setSelectedConversationId(null);
    setMessages([]);
    setSidebarOpen(true);
    clearAttachments();
    clearDocumentQA();

    loadConversations();
  }, [workspace]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    loadMessages(
      selectedConversationId
    );

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResizeTextarea();
    });
  }, [selectedConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    autoResizeTextarea();
  }, [message]);

  const createNewChat = async () => {
    const newConversation =
      await createConversationAutomatically();

    if (!newConversation) {
      return;
    }

    setMessage("");
    setOpenMenuId(null);
    clearAttachments();
    clearDocumentQA();

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResizeTextarea();
    });
  };

  // =========================================================
  // SEND NORMAL CHAT MESSAGE
  // =========================================================

  const sendMessage = async () => {
    const trimmedMessage =
      message.trim();

    if (
      !trimmedMessage ||
      loading ||
      conversationsLoading ||
      !workspace?.id ||
      !selectedConversationId
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const uploadedFileId =
        attachments.length > 0
          ? attachments[0].id
          : null;

      const params = new URLSearchParams();

      params.set(
        "workspace_id",
        String(workspace.id)
      );

      params.set(
        "conversation_id",
        String(selectedConversationId)
      );

      params.set(
        "message",
        trimmedMessage
      );

      if (uploadedFileId) {
        params.set(
          "file_id",
          String(uploadedFileId)
        );
      }

      const response = await fetch(
        `${API_BASE}/chat/messages?${params.toString()}`,
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
        clearSession();

        setMessages([]);
        setSelectedConversationId(null);
        clearAttachments();

        setError(
          "Your session has expired. Please login again."
        );

        return;
      }

      if (!response.ok || !data.success) {
        const backendMessage =
          data.message ||
          data.detail ||
          "";

        setError(
          getFriendlyAIError(
            response.status,
            backendMessage
          )
        );

        return;
      }

      setMessage("");
      clearAttachments();

      requestAnimationFrame(() => {
        autoResizeTextarea();
      });

      await loadMessages(
        selectedConversationId
      );

      await loadConversations();

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (sendError) {
      console.error(
        "Send message error:",
        sendError
      );

      setError(
        "Unable to connect to Nova. Please check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        !loading &&
        !conversationsLoading &&
        selectedConversationId &&
        message.trim()
      ) {
        sendMessage();
      }

      return;
    }

    if (
      event.key === "Enter" &&
      event.shiftKey
    ) {
      requestAnimationFrame(() => {
        autoResizeTextarea();
      });
    }
  };

  // =========================================================
  // RENAME
  // =========================================================

  const startRename = (
    conversation
  ) => {
    setOpenMenuId(null);

    setEditingConversationId(
      conversation.id
    );

    setEditTitle(
      conversation.title ||
        "New Chat"
    );

    setError("");
  };

  const cancelRename = () => {
    setEditingConversationId(null);
    setEditTitle("");
  };

  const saveRename = async (
    conversationId
  ) => {
    const trimmedTitle =
      editTitle.trim();

    if (!trimmedTitle) {
      setError(
        "Conversation title cannot be empty."
      );

      return;
    }

    try {
      setRenamingConversation(true);
      setError("");

      const params = new URLSearchParams();

      params.set(
        "workspace_id",
        String(workspace.id)
      );

      params.set(
        "title",
        trimmedTitle
      );

      const response = await fetch(
        `${API_BASE}/chat/conversations/${conversationId}?${params.toString()}`,
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
        clearSession();

        setError(
          "Your session has expired. Please login again."
        );

        return;
      }

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            data.detail ||
            "Unable to rename conversation."
        );

        return;
      }

      const updatedConversation =
        data.conversation;

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id ===
          conversationId
            ? updatedConversation
            : conversation
        )
      );

      setEditingConversationId(null);
      setEditTitle("");
    } catch (renameError) {
      console.error(
        "Rename conversation error:",
        renameError
      );

      setError(
        "Unable to rename conversation."
      );
    } finally {
      setRenamingConversation(false);
    }
  };

  const handleRenameKeyDown = (
    event,
    conversationId
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveRename(conversationId);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  // =========================================================
  // DELETE
  // =========================================================

  const deleteChat = async (
    conversationId
  ) => {
    const conversation =
      conversations.find(
        (item) =>
          item.id === conversationId
      );

    const confirmed =
      window.confirm(
        `Delete "${
          conversation?.title ||
          "this conversation"
        }"?`
      );

    if (!confirmed) {
      setOpenMenuId(null);
      return;
    }

    try {
      setDeletingConversationId(
        conversationId
      );

      setError("");
      setOpenMenuId(null);

      const params = new URLSearchParams();

      params.set(
        "workspace_id",
        String(workspace.id)
      );

      const response = await fetch(
        `${API_BASE}/chat/conversations/${conversationId}?${params.toString()}`,
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
        clearSession();

        setMessages([]);
        setSelectedConversationId(null);
        clearAttachments();

        setError(
          "Your session has expired. Please login again."
        );

        return;
      }

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            data.detail ||
            "Unable to delete conversation."
        );

        return;
      }

      const remainingConversations =
        conversations.filter(
          (item) =>
            item.id !== conversationId
        );

      setConversations(
        remainingConversations
      );

      if (
        selectedConversationId ===
        conversationId
      ) {
        clearAttachments();
        clearDocumentQA();

        if (
          remainingConversations.length >
          0
        ) {
          setSelectedConversationId(
            remainingConversations[0].id
          );
        } else {
          await createConversationAutomatically();
        }
      }
    } catch (deleteError) {
      console.error(
        "Delete conversation error:",
        deleteError
      );

      setError(
        "Unable to delete conversation."
      );
    } finally {
      setDeletingConversationId(
        null
      );
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-sm">

        <div className="flex items-center min-w-0">

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(
                (previous) => !previous
              )
            }
            className="md:hidden mr-3 w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100"
            aria-label="Toggle conversations"
          >
            ☰
          </button>

          <div className="min-w-0">

            <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">
              {workspace?.name ||
                "Workspace"}{" "}
              - Chat
            </h1>

            <p className="text-[11px] sm:text-sm text-slate-500">
              Nova AI Workspace
            </p>

          </div>

        </div>

        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={() =>
              setShowDocumentQA(
                (previous) => !previous
              )
            }
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
              showDocumentQA
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            📄 Ask Document
          </button>

          <button
            type="button"
            onClick={onBack}
            className="bg-slate-900 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-slate-800 transition"
          >
            Back
          </button>

        </div>

      </header>

      <main className="flex-1 p-0 sm:p-4 md:p-6">

        <div className="max-w-7xl mx-auto bg-white sm:border border-slate-200 sm:rounded-2xl shadow-sm min-h-[calc(100vh-90px)] sm:min-h-[calc(100vh-120px)] flex overflow-hidden relative">

          {/* MOBILE OVERLAY */}
          {sidebarOpen && (
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(false)
              }
              className="md:hidden fixed inset-0 bg-black/30 z-30"
              aria-label="Close conversations"
            />
          )}

          {/* SIDEBAR */}
          <aside
            className={`absolute md:static left-0 top-0 bottom-0 z-40 md:z-auto w-[280px] sm:w-72 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 transition-transform duration-200 ${
              sidebarOpen
                ? "translate-x-0"
                : "-translate-x-full md:translate-x-0"
            }`}
          >

            <div className="p-4 border-b border-slate-200">

              <button
                type="button"
                onClick={createNewChat}
                disabled={
                  creatingConversation
                }
                className="w-full bg-slate-900 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50"
              >
                {creatingConversation
                  ? "Creating..."
                  : "+ New Chat"}
              </button>

            </div>

            <div className="px-4 pt-4 pb-3">

              <h2 className="font-semibold text-slate-900">
                Conversations
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Your recent chats
              </p>

            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3">

              {conversationsLoading ? (

                <div className="space-y-2">

                  <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />

                  <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />

                  <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />

                </div>

              ) : conversations.length === 0 ? (

                <div className="text-center py-8 px-3">

                  <p className="text-sm text-slate-500">
                    No conversations yet.
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    A new chat will be created automatically.
                  </p>

                </div>

              ) : (

                <div className="space-y-2">

                  {conversations.map(
                    (conversation) => (

                      <div
                        key={conversation.id}
                        className={`relative rounded-xl border transition ${
                          selectedConversationId ===
                          conversation.id
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-900 hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >

                        {editingConversationId ===
                        conversation.id ? (

                          <div className="p-3 bg-white rounded-xl text-slate-900">

                            <input
                              type="text"
                              value={editTitle}
                              onChange={(event) =>
                                setEditTitle(
                                  event.target.value
                                )
                              }
                              onKeyDown={(event) =>
                                handleRenameKeyDown(
                                  event,
                                  conversation.id
                                )
                              }
                              autoFocus
                              maxLength={100}
                              disabled={
                                renamingConversation
                              }
                              className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                            />

                            <div className="flex gap-2 mt-2">

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  saveRename(
                                    conversation.id
                                  );
                                }}
                                disabled={
                                  renamingConversation
                                }
                                className="flex-1 bg-slate-900 text-white rounded-lg px-3 py-2 text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                              >
                                {renamingConversation
                                  ? "Saving..."
                                  : "Save"}
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  cancelRename();
                                }}
                                disabled={
                                  renamingConversation
                                }
                                className="flex-1 bg-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs font-medium hover:bg-slate-300 disabled:opacity-50"
                              >
                                Cancel
                              </button>

                            </div>

                          </div>

                        ) : (

                          <div className="flex items-stretch">

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedConversationId(
                                  conversation.id
                                );

                                setOpenMenuId(
                                  null
                                );

                                clearAttachments();
                                clearDocumentQA();
                              }}
                              className="flex-1 min-w-0 text-left px-3 py-3"
                            >

                              <p className="font-medium text-sm truncate pr-2">
                                {conversation.title ||
                                  "New Chat"}
                              </p>

                              {conversation.updated_at && (
                                <p
                                  className={`text-[10px] sm:text-[11px] mt-1 ${
                                    selectedConversationId ===
                                    conversation.id
                                      ? "text-slate-300"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {new Date(
                                    conversation.updated_at
                                  ).toLocaleString()}
                                </p>
                              )}

                            </button>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();

                                setOpenMenuId(
                                  openMenuId ===
                                  conversation.id
                                    ? null
                                    : conversation.id
                                );
                              }}
                              className={`px-3 text-lg font-bold transition ${
                                selectedConversationId ===
                                conversation.id
                                  ? "text-white hover:bg-slate-800"
                                  : "text-slate-500 hover:bg-slate-100"
                              }`}
                              aria-label="Conversation menu"
                            >
                              ⋮
                            </button>

                          </div>

                        )}

                        {openMenuId ===
                          conversation.id &&
                          editingConversationId !==
                            conversation.id && (

                          <div className="absolute right-2 top-12 z-50 w-32 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden text-slate-900">

                            <button
                              type="button"
                              onClick={() =>
                                startRename(
                                  conversation
                                )
                              }
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-100 transition"
                            >
                              Rename
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteChat(
                                  conversation.id
                                )
                              }
                              disabled={
                                deletingConversationId ===
                                conversation.id
                              }
                              className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                            >
                              {deletingConversationId ===
                              conversation.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>

                          </div>

                        )}

                      </div>

                    )
                  )}

                </div>

              )}

            </div>

          </aside>

          {/* CHAT AREA */}
          <section className="flex-1 flex flex-col min-w-0 bg-white">

            <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between">

              <div className="min-w-0">

                <p className="text-sm font-semibold text-slate-900 truncate">
                  {selectedConversation?.title ||
                    "Nova Chat"}
                </p>

                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                  Your private conversation
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSidebarOpen(true)
                }
                className="md:hidden ml-3 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Chats
              </button>

            </div>

            {/* DOCUMENT Q&A PANEL */}
            {showDocumentQA && (

              <div className="border-b border-slate-200 bg-white px-3 sm:px-6 py-4">

                <div className="max-w-4xl mx-auto">

                  <div className="flex items-center justify-between gap-3 mb-3">

                    <div>

                      <h2 className="text-sm sm:text-base font-bold text-slate-900">
                        📄 Ask Your Document
                      </h2>

                      <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                        Ask questions using documents available in this workspace.
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={clearDocumentQA}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Clear
                    </button>

                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">

                    <textarea
                      value={documentQuestion}
                      onChange={(event) =>
                        setDocumentQuestion(
                          event.target.value
                        )
                      }
                      onKeyDown={
                        handleDocumentKeyDown
                      }
                      rows={2}
                      placeholder="Ask something about your documents..."
                      className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                    />

                    <button
                      type="button"
                      onClick={
                        askDocumentQuestion
                      }
                      disabled={
                        documentLoading ||
                        !documentQuestion.trim()
                      }
                      className="sm:self-end bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition disabled:opacity-40"
                    >
                      {documentLoading
                        ? "Thinking..."
                        : "Ask"}
                    </button>

                  </div>

                  {documentError && (

                    <div className="mt-3 border border-red-200 bg-red-50 text-red-700 rounded-xl px-3 py-2.5 text-sm">
                      {documentError}
                    </div>

                  )}

                  {documentAnswer && (

                    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">

                      <p className="text-xs font-semibold text-slate-500 mb-2">
                        Nova's Answer
                      </p>

                      <div className="text-sm leading-7 text-slate-900">

                        <ReactMarkdown
                          remarkPlugins={[
                            remarkGfm,
                          ]}
                        >
                          {documentAnswer}
                        </ReactMarkdown>

                      </div>

                    </div>

                  )}

                  {documentSources.length > 0 && (

                    <div className="mt-3">

                      <p className="text-xs font-semibold text-slate-500 mb-2">
                        Sources
                      </p>

                      <div className="space-y-2">

                        {documentSources.map(
                          (source, index) => (

                            <div
                              key={`${source.chunk_id || index}-${source.file_id || "source"}`}
                              className="border border-slate-200 rounded-lg px-3 py-2 bg-white"
                            >

                              <p className="text-xs font-medium text-slate-800 truncate">
                                📄{" "}
                                {source.filename ||
                                  `File ${source.file_id}`}
                              </p>

                              <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-500">

                                <span>
                                  Page:{" "}
                                  {source.page ??
                                    "N/A"}
                                </span>

                                <span>
                                  Similarity:{" "}
                                  {source.similarity ??
                                    "N/A"}
                                </span>

                                <span>
                                  Chunk:{" "}
                                  {source.chunk_id ??
                                    "N/A"}
                                </span>

                              </div>

                            </div>

                          )
                        )}

                      </div>

                    </div>

                  )}

                </div>

              </div>

            )}

            {/* MESSAGES */}
            <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-slate-50">

              {messages.length === 0 &&
              !loading ? (

                <div className="h-full flex items-center justify-center">

                  <div className="text-center max-w-md px-6">

                    <div className="text-4xl mb-4 text-slate-700">
                      ✦
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900">
                      Welcome to Nova
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      Ask Nova anything. Your
                      conversations stay organized
                      on the left.
                    </p>

                  </div>

                </div>

              ) : (

                <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5">

                  {messages.map(
                    (item) => (

                      <div
                        key={item.id}
                        className={
                          item.role ===
                          "user"
                            ? "flex justify-end"
                            : "flex justify-start"
                        }
                      >

                        <div
                          className={
                            item.role ===
                            "user"
                              ? "max-w-[92%] sm:max-w-[80%] bg-slate-900 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-sm"
                              : "max-w-[92%] sm:max-w-[80%] bg-white text-slate-900 border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm"
                          }
                        >

                          <p className="text-xs font-semibold mb-2 opacity-70">
                            {item.role ===
                            "user"
                              ? "You"
                              : "Nova"}
                          </p>

                          <div className="text-sm leading-7 break-words">

                            <ReactMarkdown
                              remarkPlugins={[
                                remarkGfm,
                              ]}
                            >
                              {item.content}
                            </ReactMarkdown>

                          </div>

                        </div>

                      </div>

                    )
                  )}

                  {loading && (

                    <div className="flex justify-start">

                      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">

                        <p className="text-xs font-semibold text-slate-500 mb-2">
                          Nova
                        </p>

                        <span className="text-sm text-slate-500 animate-pulse">
                          Nova is thinking...
                        </span>

                      </div>

                    </div>

                  )}

                  <div ref={messagesEndRef} />

                </div>

              )}

            </div>

            {/* ERROR */}
            {error && (

              <div className="mx-3 sm:mx-4 mt-3 border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>

            )}

            {/* ATTACHMENTS */}
            {attachments.length > 0 && (

              <div className="border-t border-slate-200 bg-white px-3 sm:px-4 pt-3">

                <div className="max-w-4xl mx-auto">

                  <div className="flex flex-wrap gap-2">

                    {attachments.map(
                      (file, index) => (

                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2"
                        >

                          <span>
                            📄
                          </span>

                          <span className="text-xs text-slate-700 truncate max-w-[220px]">
                            {file.name}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              removeAttachment(
                                index
                              )
                            }
                            className="text-slate-500 hover:text-red-600"
                            aria-label={`Remove ${file.name}`}
                          >
                            ×
                          </button>

                        </div>

                      )
                    )}

                    <button
                      type="button"
                      onClick={
                        clearAttachments
                      }
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      Clear
                    </button>

                  </div>

                </div>

              </div>

            )}

            {/* INPUT */}
            <div className="border-t border-slate-200 bg-white p-3 sm:p-4">

              <div className="max-w-4xl mx-auto">

                <div className="mb-3">

                  <input
                    id="nova-chat-file-upload"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
                    onChange={
                      handleFileSelect
                    }
                    className="block w-full text-sm text-slate-600
                      file:mr-3
                      file:py-2
                      file:px-4
                      file:rounded-lg
                      file:border-0
                      file:bg-slate-900
                      file:text-white
                      file:cursor-pointer
                      hover:file:bg-slate-800"
                  />

                </div>

                <div className="flex gap-2 sm:gap-3 items-end border border-slate-300 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-slate-200">

                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(event) =>
                      setMessage(
                        event.target.value
                      )
                    }
                    onKeyDown={
                      handleKeyDown
                    }
                    disabled={
                      loading ||
                      conversationsLoading ||
                      !selectedConversationId
                    }
                    rows={1}
                    placeholder={
                      selectedConversationId
                        ? "Ask Nova anything..."
                        : "Preparing your chat..."
                    }
                    className="flex-1 min-h-[42px] max-h-[160px] border-0 px-2 py-2 resize-none overflow-y-auto focus:outline-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400"
                  />

                  <button
                    type="button"
                    onClick={
                      sendMessage
                    }
                    disabled={
                      loading ||
                      conversationsLoading ||
                      !message.trim() ||
                      !selectedConversationId
                    }
                    className="bg-slate-900 text-white px-4 sm:px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-slate-800 transition shrink-0"
                  >
                    {loading
                      ? "Sending..."
                      : "Send"}
                  </button>

                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-400 text-center mt-2">
                  Enter to send · Shift + Enter for a new line
                </p>

              </div>

            </div>

          </section>
        </div>
      </main>
    </div>
  );
}

export default Chat;