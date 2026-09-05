import { useState } from "react";

function Login({ onSignup, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setMessage("Signing in...");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/v1/auth/login?email=${encodeURIComponent(
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
            `Login request failed. Status: ${response.status}`
        );
        return;
      }

      if (!data.success) {
        setMessage(data.message || "Invalid email or password.");
        return;
      }

      if (data.token) {
        localStorage.setItem("nova_token", data.token);
      }

      if (data.user) {
        localStorage.setItem("nova_user", JSON.stringify(data.user));
      }

      setMessage("Login successful ✅");

      window.setTimeout(() => {
        onLogin();
      }, 400);
    } catch (error) {
      console.error("LOGIN ERROR:", error);
      setMessage("Backend se connection nahi ho raha.");
    } finally {
      setLoading(false);
    }
  };

  const isError =
    message &&
    !message.toLowerCase().includes("successful") &&
    !message.toLowerCase().includes("signing");

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white text-slate-950 flex items-center justify-center text-xl font-extrabold shadow-xl">
            N
          </div>

          <h1 className="text-3xl font-bold text-white mt-5">
            Welcome back
          </h1>

          <p className="text-slate-400 mt-2">
            Sign in to your Nova AI Workspace
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-semibold text-slate-800 mb-2"
              >
                Email
              </label>

              <input
                id="login-email"
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
                htmlFor="login-password"
                className="block text-sm font-semibold text-slate-800 mb-2"
              >
                Password
              </label>

              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 disabled:bg-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-950 text-white py-3.5 font-semibold text-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
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
            Don't have an account?{" "}
            <button
              type="button"
              onClick={onSignup}
              disabled={loading}
              className="font-semibold text-slate-950 hover:underline disabled:opacity-50"
            >
              Sign up
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          Secure access to your AI workspace
        </p>
      </div>
    </div>
  );
}

export default Login;
