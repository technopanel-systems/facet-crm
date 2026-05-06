"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!email.endsWith("@technopanel.com.sa")) {
      setError("You must use a valid @technopanel.com.sa email address.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      // Catch silent server crashes
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("Server error: Check if SUPABASE_SERVICE_ROLE_KEY is saved in Vercel.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      // This ensures the button ALWAYS un-sticks, even on an error
      setLoading(false);
    }
  }
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!email.endsWith("@technopanel.com.sa")) {
      setError("You must use a valid @technopanel.com.sa email address.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Registration failed.");
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Request Sent</h2>
          <p className="text-sm text-gray-500 mb-6">Your account has been created and is awaiting manager approval. You will be assigned a target SQM soon.</p>
          <Link href="/login" className="btn-primary block w-full text-center">Return to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center">
              <span className="text-white font-bold tracking-tight">FACET</span>
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold">Create Account</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input type="text" className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Omar Ahmed" />
            </div>
            <div>
              <label className="label">Company Email</label>
              <input type="email" className="input" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@technopanel.com.sa" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
              {loading ? "Creating..." : "Request Access"}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account? <Link href="/login" className="text-brand-blue font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
