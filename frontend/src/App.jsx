function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r min-h-screen p-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-black text-white flex items-center justify-center font-bold">
            N
          </div>

          <h1 className="text-xl font-bold">Nova AI</h1>
        </div>

        <nav className="mt-8 space-y-2">
          <button className="w-full text-left px-4 py-3 rounded-lg bg-gray-100 font-medium">
            Dashboard
          </button>

          <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100">
            AI Chat
          </button>

          <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100">
            Documents
          </button>

          <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100">
            Research
          </button>

          <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100">
            AI Coding
          </button>
        </nav>

        <div className="mt-10 text-sm text-gray-500">
          Nova AI Workspace
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8">
          <div>
            <h2 className="text-xl font-semibold">Dashboard</h2>
            <p className="text-sm text-gray-500">
              Welcome back to Nova AI Workspace
            </p>
          </div>

          <button className="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90">
            New Workspace
          </button>
        </header>

        <section className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">
              Welcome to Nova AI
            </h1>

            <p className="mt-2 text-gray-600">
              Your intelligent workspace for AI-powered productivity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl border p-6 hover:shadow-md transition">
              <h3 className="text-lg font-semibold">AI Chat</h3>
              <p className="mt-2 text-gray-500 text-sm">
                Chat with AI and work with multimodal inputs.
              </p>
            </div>

            <div className="bg-white rounded-xl border p-6 hover:shadow-md transition">
              <h3 className="text-lg font-semibold">Documents</h3>
              <p className="mt-2 text-gray-500 text-sm">
                Create, manage and analyze your documents.
              </p>
            </div>

            <div className="bg-white rounded-xl border p-6 hover:shadow-md transition">
              <h3 className="text-lg font-semibold">AI Research</h3>
              <p className="mt-2 text-gray-500 text-sm">
                Research topics using AI-powered tools.
              </p>
            </div>

            <div className="bg-white rounded-xl border p-6 hover:shadow-md transition">
              <h3 className="text-lg font-semibold">AI Coding</h3>
              <p className="mt-2 text-gray-500 text-sm">
                Write, analyze and improve code with AI.
              </p>
            </div>
          </div>

          <div className="mt-8 bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
            <p className="mt-3 text-gray-500">
              No recent activity yet.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;