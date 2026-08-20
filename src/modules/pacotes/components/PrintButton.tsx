"use client";

import { Printer } from "lucide-react";
import { GOLD, NAVY_DARK } from "@/core/render-engine/theme";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${GOLD}`, color: NAVY_DARK, fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 8, cursor: "pointer" }}
    >
      <Printer size={15} /> Salvar como PDF
    </button>
  );
}
