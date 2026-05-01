import type { AuthProviderAdapter, AuthSession } from "@voltaria/shared";

export const localAuthAdapter: AuthProviderAdapter = {
  provider: "local",
  async getSession(): Promise<AuthSession | null> {
    return null;
  },
  async signOut(): Promise<void> {
    return undefined;
  }
};
