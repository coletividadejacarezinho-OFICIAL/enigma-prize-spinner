import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { BackupCard } from "../components/enigma/BackupCard";
import { BottomNav } from "../components/enigma/BottomNav";
import { DataRecovery } from "../components/enigma/DataRecovery";
import { FirstRun, Opening } from "../components/enigma/FirstRun";
import { OfflineNotice } from "../components/enigma/OfflineNotice";
import { useSnapshot } from "../lib/enigma/repo";
import { initInstallPrompt } from "../lib/enigma/install";
import { settleOnOpen } from "../lib/enigma/restore-import";
import { toast } from "sonner";
import { usePresentation } from "../lib/enigma/presentation";
import { Toaster } from "../components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#2a1240" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Enigma" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "Enigma Premiado — Coletividade Jacarezinho PR" },
      {
        name: "description",
        content: "Roleta de sorteios do Enigma Premiado da Coletividade Jacarezinho PR.",
      },
      { name: "author", content: "Coletividade Jacarezinho PR" },
      { property: "og:title", content: "Enigma Premiado — Coletividade Jacarezinho PR" },
      {
        property: "og:description",
        content: "Roleta de sorteios do Enigma Premiado da Coletividade Jacarezinho PR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // The viewer page shows only audience controls, so the presenter's tabs stay hidden there.
  const isViewerPage = useRouterState({
    select: (s) => s.location.pathname.startsWith("/assistir"),
  });
  // Roleta full screen hides the tabs too.
  const presenting = usePresentation();
  const store = useSnapshot();
  const broken = store?.kind === "broken";
  // First open with no draws: Roleta, Nomes and the invite need a draw, so they show FirstRun.
  const path = useRouterState({ select: (s) => s.location.pathname });
  const needsDraw = path === "/" || path === "/nomes" || path.startsWith("/convite");
  const empty = store?.kind === "ok" && !store.state.draws.some((d) => !d.draft) && needsDraw;
  // Only the active draw screen uses a viewport-locked layout; lists and settings still scroll.
  const wheelReady = path === "/" && store?.kind === "ok" && !empty;
  const [recovery, setRecovery] = useState<"opening" | "ready" | "pending">("opening");
  const recover = async () => {
    setRecovery("opening");
    try {
      const result = await settleOnOpen();
      if (result === "pending") {
        setRecovery("pending");
        return;
      }
      setRecovery("ready");
      if (result === "finished") toast.success("A restauração da cópia foi concluída.");
      if (result === "rolledBack") toast.info("A restauração anterior foi desfeita.");
    } catch {
      setRecovery("pending");
    }
  };
  useEffect(() => { void recover(); }, []);
  useEffect(() => initInstallPrompt(), []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      {/* Opened from the installed icon the app draws under the status bar and gesture area,
          so the frame keeps content inside the phone's safe area (Roleta full screen pads itself). */}
      <div
        className={
          (presenting
            ? "mx-auto min-h-dvh max-w-md"
            : "mx-auto min-h-dvh max-w-md pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]") +
          (wheelReady && recovery === "ready" ? " enigma-roleta-root" : "")
        }
      >
        {recovery === "pending" ? (
          <main className="px-5 py-10">
            <h1 className="text-2xl font-extrabold">Recuperar cópia interrompida</h1>
            <p className="mt-3">Não foi possível concluir a recuperação. Confira o espaço do aparelho e tente novamente. Você também pode guardar uma cópia dos dados disponíveis.</p>
            <button onClick={() => void recover()} className="mt-5 h-14 w-full rounded-2xl bg-primary font-bold text-primary-foreground">
              Tentar recuperar novamente
            </button>
            <div className="mt-5"><BackupCard /></div>
          </main>
        ) : recovery === "opening" || store === null ? (
          <Opening />
        ) : broken ? (
          <DataRecovery raw={store.raw} />
        ) : empty ? (
          <FirstRun />
        ) : (
          <Outlet />
        )}
        <OfflineNotice />
      </div>
      {recovery === "ready" && !isViewerPage && !presenting && store !== null && !broken && <BottomNav />}
      <Toaster
        position="top-center"
        richColors
        duration={2500}
        offset={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
      />
    </QueryClientProvider>
  );
}
