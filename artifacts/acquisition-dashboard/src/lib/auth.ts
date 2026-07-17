import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export type UserRole = "buyer" | "seller" | "agent" | "pending" | "super_admin";

export type SectionKey =
  | "overview" | "documents" | "calls" | "financials"
  | "lease" | "license" | "risk" | "day1" | "plan"
  | "inbox" | "review" | "entity-setup";

export type SectionPermission = {
  visible: boolean;
  hideAfterCompletion: boolean;
};

export type DealUser = {
  id: number;
  clerkUserId: string;
  email: string;
  name: string | null;
  role: UserRole;
  permissions: {
    sections: Record<SectionKey, SectionPermission>;
  };
  notes: string;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ALL_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "overview",   label: "Overview" },
  { key: "documents",  label: "Documents" },
  { key: "calls",      label: "Call Tracker" },
  { key: "financials", label: "Financials" },
  { key: "lease",      label: "Lease" },
  { key: "license",    label: "License & Compliance" },
  { key: "risk",       label: "Risk Tracker" },
  { key: "day1",       label: "Day 1 Takeover" },
  { key: "plan",       label: "30-Day Plan" },
  { key: "inbox",      label: "Invoice Inbox" },
  { key: "review",     label: "Review Queue" },
];

export function useAuthFetch() {
  const { getToken } = useAuth();
  return useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${body}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }, [getToken]);
}

export function useCurrentDealUser() {
  const authFetch = useAuthFetch();
  const { isSignedIn, isLoaded } = useAuth();
  return useQuery<DealUser>({
    queryKey: ["deal-user", "me"],
    queryFn: () => authFetch("/api/users/me"),
    enabled: isLoaded && !!isSignedIn,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAllDealUsers() {
  const authFetch = useAuthFetch();
  return useQuery<DealUser[]>({
    queryKey: ["deal-users"],
    queryFn: () => authFetch("/api/users"),
    staleTime: 10_000,
  });
}

export function useUpdateUserRole() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role, name, notes }: { userId: number; role?: UserRole; name?: string; notes?: string }) =>
      authFetch(`/api/users/${userId}`, { method: "PATCH", body: JSON.stringify({ role, name, notes }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-users"] }),
  });
}

export function useUpdatePermissions() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissions }: { userId: number; permissions: DealUser["permissions"] }) =>
      authFetch(`/api/users/${userId}/permissions`, { method: "PATCH", body: JSON.stringify({ permissions }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-users"] }),
  });
}

export function useCreateUser() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; name: string; role: UserRole; notes?: string }) =>
      authFetch("/api/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-users"] }),
  });
}

export function useDeleteUser() {
  const authFetch = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => authFetch(`/api/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-users"] }),
  });
}

export function isSectionVisible(dealUser: DealUser, key: SectionKey): boolean {
  if (dealUser.role === "buyer" || dealUser.role === "super_admin") return true;
  return dealUser.permissions?.sections?.[key]?.visible ?? false;
}
