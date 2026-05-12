import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import "@/styles/store-experience.css";

export default function SubAgentLogin() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isSubAgent, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("agent_stores")
        .select("id,agent_id,store_name,slug,is_active")
        .eq("slug", slug)
        .maybeSingle();
      setStore(data);
      setLoading(false);
    })();
  }, [slug]);

  // If already signed in & is a subagent, verify assignment under this store and redirect
  useEffect(() => {
    if (authLoading || !user || !store) return;
    if (!isSubAgent) return;
    setVerifying(true);
    (async () => {
      const { data: assignment } = await supabase
        .from("subagent_assignments")
        .select("id,status")
        .eq("subagent_user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (assignment) {
        toast.success("Welcome back, subagent");
        navigate("/dashboard");
      } else {
        toast.error("No active subagent assignment found. Please complete activation.");
        navigate(`/store/${store.slug}/subagent-program`);
      }
      setVerifying(false);
    })();
  }, [authLoading, user, isSubAgent, store, navigate]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      toast.error("Email and password are required");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      await refreshProfile();

      // After signin, verify the user is a confirmed subagent
      const { data: { user: signedUser } } = await supabase.auth.getUser();
      if (!signedUser) {
        toast.error("Sign-in failed");
        return;
      }

      const [{ data: roles }, { data: assignment }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", signedUser.id),
        supabase
          .from("subagent_assignments")
          .select("id,status")
          .eq("subagent_user_id", signedUser.id)
          .eq("status", "active")
          .maybeSingle(),
      ]);

      const isSub = (roles || []).some((r: any) => r.role === "sub_agent");
      if (!isSub || !assignment) {
        toast.error("This account has not paid the subagent activation fee for this store.");
        await supabase.auth.signOut();
        navigate(`/store/${store.slug}/subagent-program`);
        return;
      }

      toast.success("Welcome back, subagent");
      navigate("/dashboard");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background store-canvas">
        <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
          <Card className="p-8 w-full max-w-xl mx-auto text-center store-panel">
            <h1 className="text-2xl font-bold">Subagent Login</h1>
            <p className="text-muted-foreground mt-2">Store not found.</p>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background store-canvas">
      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
        <div className="w-full max-w-md mx-auto">
          <Card className="p-6 sm:p-8 border-primary/30 store-panel store-panel-strong store-reveal">
            <div className="text-center mb-6">
              <p className="inline-flex rounded-full px-3 py-1 text-xs tracking-wider uppercase store-chip mb-3">Subagent Login</p>
              <h1 className="text-2xl font-bold">{store.store_name}</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Sign in to access your subagent dashboard.
              </p>
            </div>

            <div className="flex flex-col items-center text-center gap-2 mb-5">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <p className="text-xs text-muted-foreground">
                Only verified subagents who paid activation can sign in here.
              </p>
            </div>

            {verifying ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sl-email">Email</Label>
                  <Input id="sl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sl-password">Password</Label>
                  <Input id="sl-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="button" className="w-full" onClick={handleLogin} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sign in to Subagent Dashboard
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center mt-6">
              Not a subagent yet?{" "}
              <Link to={`/store/${store.slug}/subagent-program`} className="text-primary font-medium hover:underline">
                Activate here
              </Link>
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
