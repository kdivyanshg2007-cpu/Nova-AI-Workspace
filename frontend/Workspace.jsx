export default function Workspace({
  workspace,
  onBack,
  onOpenChat,
  onOpenDocument,
  onOpenCoding,
  onOpenResearch,
  onOpenDataAnalysis,
  onOpenNotes,
  onOpenFiles,
  onOpenTasks,
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {workspace?.name || "Workspace"}
          </h1>

          <p className="text-sm text-gray-500">
            Nova AI Workspace
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="bg-black text-white px-4 py-2 rounded-lg cursor-pointer"
        >
          Back to Dashboard
        </button>
      </header>

      <main className="p-6">
        <div className="bg-white border rounded-2xl p-6">
          <h2 className="text-2xl font-bold">
            {workspace?.name || "Workspace"} 👋
          </h2>

          <p className="text-gray-500 mt-2">
            Your workspace is ready.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
            {/* Chats */}
            <button
              type="button"
              onClick={onOpenChat}
              className="border rounded-xl p-5 text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <h3 className="font-semibold">
                💬 Chats
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Your AI conversations
              </p>
            </button>

            {/* Documents */}
            <button
              type="button"
              onClick={onOpenDocument}
              className="border rounded-xl p-5 text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <h3 className="font-semibold">
                📄 Documents
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Manage your documents
              </p>
            </button>

            {/* Coding */}
            <button
              type="button"
              onClick={onOpenCoding}
              className="border rounded-xl p-5 text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <h3 className="font-semibold">
                💻 Coding
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Generate, explain, debug and optimize code
              </p>
            </button>

            {/* Research */}
            <button
              type="button"
              onClick={onOpenResearch}
              className="border rounded-xl p-5 text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <h3 className="font-semibold">
                🔎 Research
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Research topics, sources and citations
              </p>
            </button>

            {/* AI Data Analysis */}
            <button
              type="button"
              onClick={onOpenDataAnalysis}
              className="border rounded-xl p-5 text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <h3 className="font-semibold">
                📊 AI Data Analysis
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Upload CSV/XLSX files and analyze your data
              </p>
            </button>

            {/* Files */}
            <button
              type="button"
              onClick={onOpenFiles}
              className="border rounded-xl p-5 text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <h3 className="font-semibold">
                📁 Files
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Store workspace files
              </p>
            </button>

            {/* Notes */}
            <button
              type="button"
              onClick={onOpenNotes}
              className="border rounded-xl p-5 text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <h3 className="font-semibold">
                📝 Notes
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Keep important notes
              </p>
            </button>

            {/* Tasks */}
            <button
              type="button"
              onClick={onOpenTasks}
              className="border rounded-xl p-5 text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <h3 className="font-semibold">
                ✅ Tasks
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Manage tasks, priorities and deadlines
              </p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
