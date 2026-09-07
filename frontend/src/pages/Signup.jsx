import { useState } from "react";

function Signup({ onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!name.trim() || !email.trim() || !password) {
      setMessage("Please complete all fields.");
      return;
    }

    setLoading(true);
    setMessage("Creating your account...");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/signup?name=${encodeURIComponent(
          name.trim()
        )}&email=${encodeURIComponent(
          email.trim()
        )}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(
          data.message ||
            data.detail ||
            `Signup request failed. Status: ${response.status}`
        );
        return;
      }

      if (!data.success) {
        setMessage(data.message || "Unable to create account.");
        return;
      }

      setMessage("Account created successfully ✅");

      window.setTimeout(() => {
        onLogin();
      }, 500);
    } catch (error) {
      console.error("SIGNUP ERROR:", error);
      setMessage("Backend se connection nahi ho raha.");
    } finally {
      setLoading(false);
    }
  };

  const isError =
    message &&
    !message.toLowerCase().includes("successfully") &&
    !message.toLowerCase().includes("creating");

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white text-slate-950 flex items-center justify-center text-xl font-extrabold shadow-xl">
            N
          </div>

          <h1 className="text-3xl font-bold text-white mt-5">
            Create your account
          </h1>

          <p className="text-slate-400 mt-2">
            Start using your Nova AI Workspace
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="signup-name"
                className="block text-sm font-semibold text-slate-800 mb-2"
              >
                Name
              </label>

              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-sm font-semibold text-slate-800 mb-2"
              >
                Email
              </label>

              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-sm font-semibold text-slate-800 mb-2"
              >
                Password
              </label>

              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                autoComplete="new-password"
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 disabled:bg-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-950 text-white py-3.5 font-semibold text-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </div>

          {message && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                isError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {message}
            </div>
          )}

          <div className="text-center text-sm text-slate-500 mt-6 pt-6 border-t border-slate-100">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onLogin}
              disabled={loading}
              className="font-semibold text-slate-950 hover:underline disabled:opacity-50"
            >
              Sign in
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          Create your workspace in a few seconds
        </p>
      </div>
    </div>
  );
}

export default Signup;