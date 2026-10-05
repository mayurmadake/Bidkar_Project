"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, LogIn, User } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(result?.error || "Login failed.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setMessage("Could not sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold">Account Register</h1>
          <p className="mt-1 text-sm text-slate-600">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Username
            <span className="mt-1 flex items-center gap-2 rounded border border-line px-3 py-2">
              <User size={16} className="text-slate-500" />
              <input
                autoComplete="username"
                autoFocus
                className="w-full border-0 bg-transparent p-0 outline-none"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </span>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <span className="mt-1 flex items-center gap-2 rounded border border-line px-3 py-2">
              <LockKeyhole size={16} className="text-slate-500" />
              <input
                autoComplete="current-password"
                className="w-full border-0 bg-transparent p-0 outline-none"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </span>
          </label>

          {message && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>}

          <button
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <LogIn size={16} />
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
