"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ShellHeader() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-gold-500/40 bg-navy-900 px-6 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/branding/logo-golden-sky.png" alt="Golden Sky Studio" className="h-10 w-auto" />
      <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-white/80 hover:text-gold-500">
        <LogOut size={15} /> Sair
      </button>
    </header>
  );
}
