import { Link } from "@tanstack/react-router";
import { Disc3, Settings, Ticket, Users } from "lucide-react";

const tabs = [
  { to: "/", label: "Roleta", icon: Disc3, exact: true },
  { to: "/nomes", label: "Nomes", icon: Users, exact: false },
  { to: "/sorteios", label: "Sorteios", icon: Ticket, exact: false },
  { to: "/ajustes", label: "Ajustes", icon: Settings, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-nav pb-[env(safe-area-inset-bottom)]"
      aria-label="Menu principal"
    >
      <ul className="grid h-16 grid-cols-4">
        {tabs.map(({ to, label, icon: Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact }}
              className="group flex h-full flex-col items-center justify-center gap-0.5 text-xs font-bold text-muted-foreground data-[status=active]:text-gold"
            >
              <span className="flex h-7 w-12 items-center justify-center rounded-full group-data-[status=active]:bg-secondary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
