import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE =
  import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : "http://127.0.0.1:8000/api/v1";

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
  // AI EVALUATION
  // =========================================================

  const [evaluationScores, setEvaluationScores] = useState({});
  const [evaluationFeedback, setEvaluationFeedback] = useState({});
  const [evaluatingMessageId, setEvaluatingMessageId] = useState(null);
  const [evaluatedMessages, setEvaluatedMessages] = useState({});

  // =========================================================
  // ATTACHMENTS
  // =========================================================

  const [attachments, setAttachments] = useState([]);

  // =========================================================
  // VOICE INPUT
  // =========================================================

  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

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

  const speechRecognitionRef = useRef(null);

  // Voice refs
  const voiceBaseMessageRef = useRef("");
  const voiceMessageRef = useRef("");
  const voiceTranscriptRef = useRef("");

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

  const getResponseSourceLabel = (item) => {
    const source =
      item?.source ||
      item?.source_name ||
      item?.metadata?.source ||
      item?.metadata?.source_name;

    if (typeof source === "string" && source.trim()) {
      return source.trim();
    }

    if (item?.file_id) {
      return "Attached file";
    }

    return "Nova AI";
  };

  const getResponseConfidenceLabel = (item) => {
    const rawConfidence =
      item?.confidence ??
      item?.confidence_score ??
      item?.metadata?.confidence ??
      item?.metadata?.confidence_score;

    if (
      typeof rawConfidence === "number" &&
      Number.isFinite(rawConfidence)
    ) {
      const normalized =
        rawConfidence <= 1
          ? rawConfidence * 100
          : rawConfidence;

      return `${Math.round(normalized)}%`;
    }

    if (typeof rawConfidence === "string") {
      const trimmedConfidence = rawConfidence.trim();

      if (trimmedConfidence) {
        return trimmedConfidence;
      }
    }

    return "Not provided";
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
  // VOICE INPUT
  // =========================================================

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    setVoiceSupported(Boolean(SpeechRecognition));

    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // Ignore cleanup errors.
        }
      }

      speechRecognitionRef.current = null;
    };
  }, []);

  const toggleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );
      return;
    }

    if (
      loading ||
      conversationsLoading ||
      !selectedConversationId
    ) {
      return;
    }

    if (isListening) {
      try {
        speechRecognitionRef.current?.stop();
      } catch {
        setIsListening(false);
        speechRecognitionRef.current = null;
      }

      return;
    }

    setError("");

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-IN";

    const existingMessage = message.trim();

    voiceBaseMessageRef.current = existingMessage;
    voiceTranscriptRef.current = "";
    voiceMessageRef.current = existingMessage;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        transcript +=
          event.results[index]?.[0]?.transcript ||
          "";
      }

      const cleanTranscript = transcript.trim();

      const combinedMessage = [
        voiceBaseMessageRef.current,
        cleanTranscript,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      voiceTranscriptRef.current = cleanTranscript;
      voiceMessageRef.current = combinedMessage;

      setMessage(combinedMessage);

      requestAnimationFrame(() => {
        autoResizeTextarea();
      });
    };

    recognition.onerror = (event) => {
      console.error(
        "Voice input error:",
        event
      );

      const errorMessages = {
        "not-allowed":
          "Microphone permission was denied. Please allow microphone access and try again.",
        "audio-capture":
          "No microphone was found. Please connect a microphone and try again.",
        "no-speech":
          "No speech was detected. Please try again and speak clearly.",
        network:
          "Voice input could not connect to the speech service. Please try again.",
      };

      setError(
        errorMessages[event.error] ||
          "Voice input failed. Please try again."
      );

      setIsListening(false);
      speechRecognitionRef.current = null;
      voiceTranscriptRef.current = "";
      voiceMessageRef.current = "";
    };

    recognition.onend = () => {
      setIsListening(false);
      speechRecognitionRef.current = null;

      const finalVoiceMessage =
        voiceMessageRef.current.trim();

      voiceMessageRef.current = "";
      voiceTranscriptRef.current = "";
      voiceBaseMessageRef.current = "";

      requestAnimationFrame(() => {
        autoResizeTextarea();
        textareaRef.current?.focus();
      });

      // =====================================================
      // VOICE AUTO SEND
      // =====================================================

      if (
        finalVoiceMessage &&
        selectedConversationId &&
        !loading &&
        !conversationsLoading
      ) {
        setMessage(finalVoiceMessage);

        requestAnimationFrame(() => {
          sendMessage(finalVoiceMessage);
        });
      }
    };

    speechRecognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (voiceStartError) {
      console.error(
        "Voice input start error:",
        voiceStartError
      );

      setIsListening(false);
      speechRecognitionRef.current = null;

      setError(
        "Unable to start voice input. Please try again."
      );
    }
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

        const backendContentType = String(
          data.attachment?.content_type || ""
        ).trim().toLowerCase();

        const localContentType = String(
          file.type || ""
        ).trim().toLowerCase();

        const normalizedFileName = String(
          file.name || ""
        ).trim().toLowerCase();

        const isImage =
          localContentType.startsWith("image/") ||
          backendContentType.startsWith("image/") ||
          /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(
            normalizedFileName
          );

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
            backendContentType ||
            localContentType,

          is_image: isImage,

          path:
            data.attachment?.path ||
            "",

          preview_url:
            isImage
              ? URL.createObjectURL(file)
              : "",

          workspace_id:
            data.attachment?.workspace_id ??
            workspace.id,
        };

        setAttachments((previous) => [
          ...previous,
          uploadedFile,
        ]);

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

  const revokeAttachmentPreview = (attachment) => {
    if (attachment?.preview_url) {
      URL.revokeObjectURL(
        attachment.preview_url
      );
    }
  };

  const removeAttachment = (indexToRemove) => {
    setAttachments((previous) => {
      const attachmentToRemove =
        previous[indexToRemove];

      revokeAttachmentPreview(
        attachmentToRemove
      );

      return previous.filter(
        (_, index) =>
          index !== indexToRemove
      );
    });
  };

  const clearAttachments = () => {
    setAttachments((previous) => {
      previous.forEach(
        revokeAttachmentPreview
      );

      return [];
    });
  };

  useEffect(() => {
    return () => {
      setAttachments((previous) => {
        previous.forEach(
          revokeAttachmentPreview
        );

        return [];
      });
    };
  }, []);

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
    setEvaluatedMessages({});
    setEvaluationScores({});
    setEvaluationFeedback({});

    loadConversations();
    loadEvaluations();
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
  // SEND MESSAGE
  // =========================================================

  const sendMessage = async (
    messageOverride = null
  ) => {
    const messageToSend =
      String(
        messageOverride ?? message
      ).trim();

    if (
      !messageToSend ||
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
        messageToSend
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
  // AI EVALUATION
  // =========================================================

  const loadEvaluations = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/evaluations`,
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
        return;
      }

      if (!response.ok || !data.success) {
        console.error(
          "Unable to load evaluations:",
          data.message || data.detail
        );

        return;
      }

      const evaluatedMap = {};
      const scoresMap = {};
      const feedbackMap = {};

      for (
        const evaluation of Array.isArray(
          data.evaluations
        )
          ? data.evaluations
          : []
      ) {
        if (!evaluation.message_id) {
          continue;
        }

        evaluatedMap[
          evaluation.message_id
        ] = true;

        scoresMap[
          evaluation.message_id
        ] = evaluation.score;

        feedbackMap[
          evaluation.message_id
        ] =
          evaluation.feedback ||
          "";
      }

      setEvaluatedMessages(
        evaluatedMap
      );

      setEvaluationScores(
        scoresMap
      );

      setEvaluationFeedback(
        feedbackMap
      );
    } catch (evaluationLoadError) {
      console.error(
        "Load evaluations error:",
        evaluationLoadError
      );
    }
  };

  const submitEvaluation = async (
    messageId
  ) => {
    const score = Number(
      evaluationScores[messageId]
    );

    if (
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    ) {
      setError(
        "Please select a rating from 1 to 5."
      );

      return;
    }

    if (
      !workspace?.id ||
      !selectedConversationId ||
      !messageId
    ) {
      setError(
        "Unable to submit evaluation for this response."
      );

      return;
    }

    try {
      setEvaluatingMessageId(
        messageId
      );

      setError("");

      const response = await fetch(
        `${API_BASE}/evaluations`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            workspace_id:
              workspace.id,
            conversation_id:
              selectedConversationId,
            message_id: messageId,
            score,
            feedback:
              evaluationFeedback[
                messageId
              ]?.trim() || null,
            evaluation_type:
              "quality",
          }),
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

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ||
            data.detail ||
            "Unable to submit evaluation."
        );

        return;
      }

      setEvaluatedMessages(
        (previous) => ({
          ...previous,
          [messageId]: true,
        })
      );
    } catch (evaluationError) {
      console.error(
        "Evaluation submission error:",
        evaluationError
      );

      setError(
        "Unable to submit evaluation. Please try again."
      );
    } finally {
      setEvaluatingMessageId(
        null
      );
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

      if (
        !response.ok ||
        !data.success
      ) {
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
                        key={
                          conversation.id
                        }
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
                              value={
                                editTitle
                              }
                              onChange={(
                                event
                              ) =>
                                setEditTitle(
                                  event.target
                                    .value
                                )
                              }
                              onKeyDown={(
                                event
                              ) =>
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
                                onClick={(
                                  event
                                ) => {
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
                                onClick={(
                                  event
                                ) => {
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
                              onClick={(
                                event
                              ) => {
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

            {/* DOCUMENT Q&A */}
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
                      value={
                        documentQuestion
                      }
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
                          (
                            source,
                            index
                          ) => (

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

                          {item.role === "assistant" && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                                <span>Source:</span>
                                <span className="font-medium text-slate-700">
                                  {getResponseSourceLabel(item)}
                                </span>
                              </span>

                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                                <span>Confidence:</span>
                                <span className="font-medium text-slate-700">
                                  {getResponseConfidenceLabel(item)}
                                </span>
                              </span>
                            </div>
                          )}

                          {item.role === "assistant" && (

                            <div className="mt-4 pt-3 border-t border-slate-200">

                              {evaluatedMessages[item.id] ? (

                                <div className="text-xs font-medium text-emerald-600">
                                  ✓ Feedback submitted. Thank you!
                                </div>

                              ) : (

                                <>

                                  <p className="text-xs font-semibold text-slate-600 mb-2">
                                    Rate Nova's response
                                  </p>

                                  <div className="flex flex-wrap items-center gap-2 mb-3">

                                    {[1, 2, 3, 4, 5].map(
                                      (score) => (

                                        <button
                                          key={score}
                                          type="button"
                                          onClick={() =>
                                            setEvaluationScores(
                                              (previous) => ({
                                                ...previous,
                                                [item.id]:
                                                  score,
                                              })
                                            )
                                          }
                                          className={
                                            "w-9 h-9 rounded-lg border text-sm font-semibold transition " +
                                            (
                                              Number(
                                                evaluationScores[
                                                  item.id
                                                ]
                                              ) ===
                                              score
                                                ? "bg-slate-900 text-white border-slate-900"
                                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                                            )
                                          }
                                          aria-label={
                                            "Rate " +
                                            score +
                                            " out of 5"
                                          }
                                        >
                                          {score}
                                        </button>

                                      )
                                    )}

                                  </div>

                                  <textarea
                                    value={
                                      evaluationFeedback[
                                        item.id
                                      ] || ""
                                    }
                                    onChange={(event) =>
                                      setEvaluationFeedback(
                                        (previous) => ({
                                          ...previous,
                                          [item.id]:
                                            event.target.value,
                                        })
                                      )
                                    }
                                    rows={2}
                                    maxLength={500}
                                    placeholder="Optional feedback about this response..."
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none mb-2"
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      submitEvaluation(
                                        item.id
                                      )
                                    }
                                    disabled={
                                      evaluatingMessageId ===
                                        item.id ||
                                      !evaluationScores[
                                        item.id
                                      ]
                                    }
                                    className="bg-slate-900 text-white rounded-lg px-3 py-2 text-xs font-medium hover:bg-slate-800 transition disabled:opacity-40"
                                  >
                                    {evaluatingMessageId ===
                                    item.id
                                      ? "Submitting..."
                                      : "Submit Feedback"}
                                  </button>

                                </>

                              )}

                            </div>

                          )}

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
                          className="flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-2 max-w-full"
                        >

                          {file.is_image &&
                          file.preview_url ? (

                            <img
                              src={
                                file.preview_url
                              }
                              alt={file.name}
                              className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                              onError={(event) => {
                                event.currentTarget.style.display =
                                  "none";
                              }}
                            />

                          ) : (

                            <span className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-xl">
                              📄
                            </span>

                          )}

                          <div className="min-w-0">

                            <p className="text-xs font-medium text-slate-700 truncate max-w-[220px]">
                              {file.name}
                            </p>

                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {file.is_image
                                ? "Image attached"
                                : "File attached"}
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeAttachment(
                                index
                              )
                            }
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-white transition shrink-0"
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

                  <p className="text-[11px] text-slate-400 mb-2">
                    Upload an image to let Nova understand and analyze it.
                  </p>

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

                  {/* VOICE BUTTON */}
                  <button
                    type="button"
                    onClick={
                      toggleVoiceInput
                    }
                    disabled={
                      loading ||
                      conversationsLoading ||
                      !selectedConversationId
                    }
                    title={
                      isListening
                        ? "Stop voice input"
                        : voiceSupported
                          ? "Start voice input"
                          : "Voice input"
                    }
                    aria-label={
                      isListening
                        ? "Stop voice input"
                        : "Start voice input"
                    }
                    aria-pressed={
                      isListening
                    }
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-medium transition shrink-0 ${
                      isListening
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {isListening
                      ? "⏹"
                      : "🎤"}
                  </button>

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

                {isListening && (

                  <p className="text-[10px] sm:text-[11px] text-red-500 text-center mt-2 font-medium">
                    🎙️ Listening... Please speak now.
                  </p>

                )}

                {!isListening && (

                  <p className="text-[10px] sm:text-[11px] text-slate-400 text-center mt-2">
                    Enter to send · Shift + Enter for a new line · 🎤 Voice input
                  </p>

                )}

              </div>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}

export default Chat;