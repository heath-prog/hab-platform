import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  DashboardState,
  loadState, saveState, hasLocalState,
  loadWorkspaceFromDB, saveWorkspaceToDB, saveWorkspaceToDBDebounced,
  loadPortfolio, getBusiness, type Business,
} from "./storage";

type DashboardContextType = {
  state: DashboardState;
  businessId: string;
  business: Business | undefined;
  setState: (updater: (prev: DashboardState) => DashboardState) => void;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({
  children,
  businessId = "true-blue",
  business: businessProp,
}: {
  children: React.ReactNode;
  businessId?: string;
  business?: Business;
}) {
  // Start from the localStorage cache for instant render; the DB (authoritative)
  // hydrates over it below.
  const [state, setStateRaw] = useState<DashboardState>(() => loadState(businessId));

  // Prefer the DB-loaded business passed down from BusinessWorkspace;
  // fall back to the localStorage cache only when no prop is provided.
  const localBusiness = useMemo(() => getBusiness(loadPortfolio(), businessId), [businessId]);
  const business = businessProp ?? localBusiness;

  // Hydrate workspace state from the Postgres-backed API. If the DB has no
  // workspace yet but localStorage does, push the local snapshot up once
  // (one-time localStorage → DB migration for pre-existing data).
  useEffect(() => {
    let cancelled = false;
    loadWorkspaceFromDB(businessId).then(({ ok, workspace }) => {
      if (cancelled) return;
      if (workspace) {
        setStateRaw(workspace);
        saveState(workspace, businessId); // refresh the local cache
      } else if (ok && hasLocalState(businessId)) {
        void saveWorkspaceToDB(businessId, loadState(businessId));
      }
    });
    return () => { cancelled = true; };
  }, [businessId]);

  const setState = useCallback(
    (updater: (prev: DashboardState) => DashboardState) => {
      setStateRaw((prev) => {
        const next = updater(prev);
        saveState(next, businessId);                 // local cache (instant render / offline)
        saveWorkspaceToDBDebounced(businessId, next); // authoritative write
        return next;
      });
    },
    [businessId]
  );

  return (
    <DashboardContext.Provider value={{ state, setState, businessId, business }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextType {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
