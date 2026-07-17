import { useEffect, useRef, useState } from "react";
import { loadIntegrationConfigs } from "@/lib/integrationConfig";
import { setTokenGetter, apiFetch } from "@/lib/apiFetch";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardProvider } from "@/lib/context";
import { Sidebar } from "@/components/Sidebar";
import { useCurrentDealUser, type DealUser } from "@/lib/auth";
import { loadPortfolio, loadPortfolioFromDB, getBusiness, type Business } from "@/lib/storage";

import Overview           from "@/pages/Overview";
import Documents          from "@/pages/Documents";
import Contacts           from "@/pages/Contacts";
import Financials         from "@/pages/Financials";
import FinancialManagement from "@/pages/FinancialManagement";
import Lease              from "@/pages/Lease";
import License            from "@/pages/License";
import Risks              from "@/pages/Risks";
import Day1               from "@/pages/Day1";
import Plan               from "@/pages/Plan";
import Reports            from "@/pages/Reports";
import InvoiceInbox       from "@/pages/InvoiceInbox";
import ReviewQueue        from "@/pages/ReviewQueue";
import EntitySetup        from "@/pages/EntitySetup";
import Landing            from "@/pages/Landing";
import SellerPortal       from "@/pages/SellerPortal";
import AdminConsole       from "@/pages/AdminConsole";
import PortfolioHome      from "@/pages/PortfolioHome";
import JoinPage           from "@/pages/JoinPage";
import BillingSuspended   from "@/pages/BillingSuspended";
import NotFound           from "@/pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey   = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath      = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

// ─── Auth screens ─────────────────────────────────────────────────────────────

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function PendingAccess() {
  const { signOut } = useClerk();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Access Pending
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Your account is waiting for approval from the deal administrator. You'll receive access once it's confirmed.
        </p>
        <p className="text-xs text-muted-foreground mb-6">HAB Enterprises — Healthy Auto Business Acquisition OS</p>
        <button
          onClick={() => signOut()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-white text-sm font-bold">HA</span>
        </div>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    </div>
  );
}

// ─── Business workspace ───────────────────────────────────────────────────────

function renderSection(sectionKey: string, businessId: string) {
  switch (sectionKey) {
    case "":            return <Overview />;
    case "documents":   return <Documents />;
    case "contacts":    return <Contacts />;
    case "financials":  return <Financials />;
    case "finance":     return <FinancialManagement businessId={businessId} />;
    case "lease":       return <Lease />;
    case "license":     return <License />;
    case "risks":       return <Risks />;
    case "day1":        return <Day1 />;
    case "plan":        return <Plan />;
    case "reports":       return <Reports />;
    case "invoice-inbox":  return <InvoiceInbox />;
    case "review-queue":   return <ReviewQueue />;
    case "entity-setup":   return <EntitySetup />;
    default:               return <NotFound />;
  }
}

function BusinessWorkspaceContent({
  businessId,
  business,
  dealUser,
  sectionKey,
}: {
  businessId: string;
  business?: Business;
  dealUser: DealUser | null;
  sectionKey: string;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar businessId={businessId} business={business} dealUser={dealUser} />
      <main className="flex-1 ml-64 p-8 max-w-5xl">
        {renderSection(sectionKey, businessId)}
      </main>
    </div>
  );
}

function BusinessWorkspace({
  id,
  section = "",
}: {
  id: string;
  section?: string;
}) {
  // Start with localStorage for instant render, then override with DB (authoritative)
  const [business, setBusiness] = useState<Business | undefined>(
    () => getBusiness(loadPortfolio(), id)
  );
  const { data: dealUser, isLoading: dealUserLoading } = useCurrentDealUser();
  const sectionKey = section.split("/")[0];

  useEffect(() => {
    loadPortfolioFromDB()
      .then((portfolio) => {
        const found = getBusiness(portfolio, id);
        if (found) setBusiness(found);
      })
      .catch(() => {});
  }, [id]);

  // Gate on resolved auth state — rendering before the role is known briefly
  // flashed the full (ungated) sidebar.
  if (dealUserLoading) return <LoadingScreen />;

  return (
    <DashboardProvider businessId={id} business={business}>
      <BusinessWorkspaceContent
        businessId={id}
        business={business}
        dealUser={dealUser ?? null}
        sectionKey={sectionKey}
      />
    </DashboardProvider>
  );
}

// ─── Past-due banner ──────────────────────────────────────────────────────────

function PastDueBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-amber-950 text-xs font-semibold text-center py-2 px-4">
      Your account has a past-due balance. Please update your payment method to avoid interruption.
    </div>
  );
}

// ─── Authenticated routing ────────────────────────────────────────────────────

type BillingState = "loading" | "active" | "past_due" | "suspended";

function AuthenticatedApp() {
  const { data: dealUser, isLoading } = useCurrentDealUser();
  const [billingState, setBillingState] = useState<BillingState>("active");

  // Load integration configs from DB into module-level cache as soon as auth resolves.
  useEffect(() => {
    if (dealUser) loadIntegrationConfigs().catch(() => {});
  }, [dealUser]);

  // Fetch billing status once the user is loaded
  useEffect(() => {
    if (!dealUser) return;
    apiFetch(`${basePath}/api/billing/status`)
      .then((r) => r.json())
      .then((d: { billingStatus?: string }) => {
        const s = d.billingStatus ?? "active";
        setBillingState(s as BillingState);
      })
      .catch(() => setBillingState("active"));
  }, [dealUser]);

  if (isLoading || billingState === "loading") return <LoadingScreen />;
  if (!dealUser) return <LoadingScreen />;

  // Billing gate — suspended users see only the payment appeal page
  if (billingState === "suspended") return <BillingSuspended />;

  if (dealUser.role === "seller")  return <SellerPortal dealUser={dealUser} />;
  if (dealUser.role === "pending") return <PendingAccess />;

  return (
    <>
      {billingState === "past_due" && <PastDueBanner />}
      <Switch>
        {/* Business workspace — section routes */}
        <Route path="/b/:id/*">
          {(params) =>
            params ? (
              <BusinessWorkspace id={params.id} section={params["*"]} />
            ) : null
          }
        </Route>
        {/* Business workspace — root (overview) */}
        <Route path="/b/:id">
          {(params) =>
            params ? <BusinessWorkspace id={params.id} section="" /> : null
          }
        </Route>
        {/* Portfolio admin */}
        <Route path="/admin" component={AdminConsole} />
        {/* Portfolio home — default */}
        <Route component={PortfolioHome} />
      </Switch>
    </>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <AuthenticatedApp />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

/** Injects the Clerk token getter into apiFetch synchronously on every render
 *  so it is always available before any child effects make API calls. */
function TokenGetterInitializer() {
  const { getToken } = useAuth();
  setTokenGetter(getToken);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl || undefined}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TokenGetterInitializer />
        <TooltipProvider>
          <Switch>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/join" component={JoinPage} />
            <Route component={HomeRedirect} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  if (!clerkPubKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Auth configuration missing.</p>
      </div>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
