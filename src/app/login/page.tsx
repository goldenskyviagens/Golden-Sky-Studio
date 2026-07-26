"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "set-password";

export default function LoginPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
    return supabaseRef.current;
  }

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Instancia o cliente já na montagem: é isso que faz o Supabase processar o
    // token de convite/redefinição de senha (#access_token=...) presente na URL.
    getSupabase();

    // O hash (#access_token=..., #error=...) só existe no navegador — nunca no
    // HTML gerado pelo servidor — então essa leitura tem que acontecer aqui,
    // depois da montagem, e não pode ser expressa como estado inicial puro.
    // Alguns navegadores/webviews (ex: apps de e-mail) só populam o hash da URL
    // um instante depois do primeiro paint — por isso também escutamos
    // "hashchange", além de checar uma vez já na montagem.
    function processHash() {
      const hash = window.location.hash;
      if (!hash) return;
      const params = new URLSearchParams(hash.slice(1));
      const errorCode = params.get("error_code");
      const errorDescription = params.get("error_description");
      const type = params.get("type");

      if (errorCode) {
        setError(
          errorCode === "otp_expired"
            ? "Esse link de convite expirou ou já foi usado. Peça um novo convite para o administrador."
            : decodeURIComponent(errorDescription || "Não foi possível validar o link.").replace(/\+/g, " ")
        );
        // Sem token válido aqui — seguro limpar a URL imediatamente.
        window.history.replaceState(null, "", window.location.pathname);
      } else if (type === "invite" || type === "recovery") {
        setMode("set-password");
        // Não mexe na URL aqui: o cliente Supabase ainda está processando o
        // access_token do hash de forma assíncrona (mesma leitura que fizemos
        // acima). Se limpássemos o hash agora, entraríamos numa corrida e a
        // sessão nunca seria estabelecida a tempo — o próprio Supabase limpa
        // a URL sozinho quando termina de processar o token.
      }
    }

    processHash();
    window.addEventListener("hashchange", processHash);
    return () => window.removeEventListener("hashchange", processHash);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: signInError } = await getSupabase().auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui definir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-100 px-4">
      <form onSubmit={mode === "set-password" ? handleSetPassword : handleLogin} className="w-full max-w-sm rounded-xl border border-navy-100 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center rounded-lg bg-navy-900 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/logo-golden-sky.png" alt="Golden Sky Studio" className="h-14 w-auto" />
        </div>

        {mode === "set-password" ? (
          <>
            <p className="mb-6 text-sm text-navy-700">Defina sua senha de acesso.</p>
            <label className="mb-1 block text-xs font-semibold text-navy-800">Nova senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
            />
            <label className="mb-1 block text-xs font-semibold text-navy-800">Confirmar senha</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
            />
            {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Definir senha e entrar"}
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </form>
    </div>
  );
}
