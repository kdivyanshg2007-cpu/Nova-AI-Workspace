function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white border-r p-5">
        <h2 className="text-2xl font-bold">Nova AI</h2>
        <p className="mt-6 text-gray-500">Workspace</p>
      </aside>

      <main className="flex-1">
        <header className="h-16 bg-white border-b flex items-center px-6">
          <h1 className="text-xl font-semibold">Nova AI Workspace</h1>
        </header>

        <section className="p-8">
          <h2 className="text-3xl font-bold">Welcome to Nova AI</h2>
          <p className="mt-2 text-gray-600">
            Your intelligent workspace for AI-powered productivity.
          </p>
        </section>
      </main>
    </div>
  )
}

export default App