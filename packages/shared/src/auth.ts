import type { AppRole } from "./permissions";

export type AuthProvider = "local" | "supabase" | "custom";

export type AuthIdentity = {
  provider: AuthProvider;
  providerSubject: string;
  email: string;
};

export type AuthSession = {
  userId: string;
  residentId?: string;
  propertyId?: string;
  email: string;
  roles: AppRole[];
};

export type AuthProviderAdapter = {
  provider: AuthProvider;
  getSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
};
