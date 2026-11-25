import { create } from "zustand";
import { queryClient } from "@/api/query-client";
import type { MeResponse } from "@/api/types";
import { storage } from "./storage";

const TOKEN_KEY = "khidma.token";
export const meQueryKey = ["me"] as const;

export type SessionStatus = "loading" | "signedOut" | "signedIn" | "error";

interface SessionState {
  status: SessionStatus;
  token: string | null;
  /** Reads the saved token at launch and checks it with the server. */
  restore: (loadMe: () => Promise<MeResponse>) => Promise<void>;
  /** Saves a new token, loads the profile, then switches the app to signed-in. */
  signIn: (token: string, loadMe: () => Promise<MeResponse>) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Session state lives outside React so the API client can read the token and trigger a
 * sign-out on 401. The profile (/me) is loaded *before* the status flips to signedIn, so the
 * route guards always know the user's role and never see a signed-in user with no profile.
 */
export const useSession = create<SessionState>((set, get) => ({
  status: "loading",
  token: null,

  restore: async (loadMe) => {
    set({ status: "loading" });
    const token = await storage.get(TOKEN_KEY);
    if (!token) {
      set({ status: "signedOut", token: null });
      return;
    }
    set({ token });
    try {
      queryClient.setQueryData(meQueryKey, await loadMe());
      set({ status: "signedIn" });
    } catch (error) {
      // A 401 already signed us out via onUnauthorized; anything else is a connection problem.
      if (get().status !== "signedOut") set({ status: "error" });
      throw error;
    }
  },

  signIn: async (token, loadMe) => {
    set({ token });
    try {
      queryClient.setQueryData(meQueryKey, await loadMe());
    } catch (error) {
      set({ token: null });
      throw error;
    }
    await storage.set(TOKEN_KEY, token);
    set({ status: "signedIn" });
  },

  signOut: async () => {
    // Flip the status first so route guards move away from signed-in screens,
    // then drop cached data so the next user never sees the previous one's bookings.
    set({ status: "signedOut", token: null });
    await storage.remove(TOKEN_KEY);
    queryClient.clear();
  },
}));
