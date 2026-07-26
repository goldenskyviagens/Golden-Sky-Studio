"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-navy-100 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center rounded-lg bg-navy-900 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/logo-golden-sky.png" alt="Golden Sky Studio" className="h-14 w-auto" />
        </div>
        <p className="mb-6 text-sm text-navy-700">Entre com seu e-mail e senha para acessar.</p>

        <label className="mb-1 block text-xs font-semibold text-navy-800">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
        />

        <label className="mb-1 block text-xs font-semibold text-navy-800">Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
        />

        {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
