import { Plane, Flame, Smartphone, Palmtree, Hotel, Car, ShieldCheck, Ticket } from "lucide-react";
import { ShellHeader } from "@/components/layout/ShellHeader";
import { ModuleCard } from "@/components/ui/ModuleCard";

const MODULES = [
  { href: "/passagens", icon: Plane, title: "Passagens", description: "Orçamento rápido de voos a partir de prints ou preenchimento manual.", disabled: false },
  { href: "/promocoes", icon: Flame, title: "Promoções", description: "Orçamento rápido para WhatsApp, Telegram e Instagram.", disabled: true },
  { href: "/redes-sociais", icon: Smartphone, title: "Redes Sociais", description: "Posts, stories e capas de Reels.", disabled: true },
  { href: "/pacotes", icon: Palmtree, title: "Pacotes", description: "Proposta Premium — página web da viagem.", disabled: true },
  { href: "/hoteis", icon: Hotel, title: "Hotéis", description: "Orçamento rápido de hospedagem.", disabled: true },
  { href: "/carros", icon: Car, title: "Aluguel de Carros", description: "Orçamento rápido de locação.", disabled: true },
  { href: "/seguro-viagem", icon: ShieldCheck, title: "Seguro Viagem", description: "Orçamento rápido de seguro.", disabled: true },
  { href: "/passeios", icon: Ticket, title: "Passeios", description: "Orçamento rápido de passeios e ingressos.", disabled: true },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-navy-100">
      <ShellHeader />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-1 text-lg font-bold text-navy-900">Módulos</h1>
        <p className="mb-6 text-sm text-navy-700">Escolha o que você quer criar.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((m) => (
            <ModuleCard key={m.href} {...m} />
          ))}
        </div>
      </main>
    </div>
  );
}
