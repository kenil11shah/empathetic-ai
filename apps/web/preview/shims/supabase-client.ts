// Stand-in for the Supabase browser client in the preview: auth is simulated locally.
import { previewAuth } from "../mock-api";

export function createClient() {
  const ok = { data: { session: {} }, error: null };
  return {
    auth: {
      signInAnonymously: async () => (previewAuth.signIn(true, null), ok),
      signInWithPassword: async ({ email }: { email: string }) => (previewAuth.signIn(false, email), ok),
      signUp: async ({ email }: { email: string }) => (previewAuth.signIn(false, email), ok),
      signOut: async () => (previewAuth.signOut(), { error: null }),
      updateUser: async ({ email }: { email?: string }) => (email && previewAuth.setEmail(email), { data: {}, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
    },
  };
}
