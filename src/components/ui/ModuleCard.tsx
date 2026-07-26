import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface ModuleCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  disabled?: boolean;
}

export function ModuleCard({ href, icon: Icon, title, description, disabled }: ModuleCardProps) {
  const content = (
    <div
      className={`flex h-full flex-col gap-3 rounded-xl border p-5 transition ${
        disabled ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60" : "border-navy-100 bg-white hover:border-gold-500 hover:shadow-md"
      }`}
    >
      <Icon size={22} className={disabled ? "text-gray-400" : "text-gold-700"} />
      <div>
        <div className="font-semibold text-navy-900">{title}</div>
        <div className="mt-1 text-xs text-navy-700">{description}</div>
      </div>
      {disabled && <span className="mt-auto text-[11px] font-medium text-gray-400">Em breve</span>}
    </div>
  );

  if (disabled) return content;
  return <Link href={href}>{content}</Link>;
}
