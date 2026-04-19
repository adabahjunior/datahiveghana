import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "user" | "agent" | "admin";

type Profile = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  wallet_balance: number;
  profit_balance: number;
  is_agent: boolean;
  is_revoked?: boolean;
};

type Ctx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isAgent: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = async (uid: string) => {
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p.data as Profile) || null);
    setRoles((r.data || []).map((x: { role: AppRole }) => x.role));
  };

  const refreshProfile = async () => {
    if (user) await loadProfileAndRoles(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfileAndRoles(sess.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadProfileAndRoles(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isAdmin: roles.includes("admin"),
        isAgent: roles.includes("agent") || profile?.is_agent === true,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
