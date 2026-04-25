import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { validateEmailSafety } from "@/lib/emailSafety";

const signUpSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
  full_name: z.string().trim().min(2, "Required").max(100),
  phone: z.string().trim().min(10, "Required").max(20),
});

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signin, setSignin] = useState({ email: "", password: "" });
  const [signup, setSignup] = useState({ email: "", password: "", full_name: "", phone: "" });
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(signin);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate("/dashboard");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(signup);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    const safeEmail = validateEmailSafety(signup.email);
    if (!safeEmail.ok) {
      toast.error(safeEmail.message);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signup.email,
      password: signup.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: signup.full_name, phone: signup.phone },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. Welcome!");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <Link to="/" className="flex items-center gap-2 mb-10">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-xl">D</span>
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">BenzosData</h1>
          <p className="text-xs text-muted-foreground leading-tight">Ghana</p>
        </div>
      </Link>

      <Card className="w-full max-w-md p-8 shadow-sm">
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="si-email">Email</Label>
                <Input id="si-email" type="email" required value={signin.email}
                  onChange={(e) => setSignin({ ...signin, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="si-pw">Password</Label>
                <div className="relative">
                  <Input
                    id="si-pw"
                    type={showSignInPassword ? "text" : "password"}
                    required
                    value={signin.password}
                    onChange={(e) => setSignin({ ...signin, password: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showSignInPassword ? "Hide password" : "Show password"}
                  >
                    {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign In
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="su-name">Full Name</Label>
                <Input id="su-name" required value={signup.full_name}
                  onChange={(e) => setSignup({ ...signup, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" type="email" required value={signup.email}
                  onChange={(e) => setSignup({ ...signup, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-phone">Phone Number</Label>
                <Input id="su-phone" required placeholder="0244000000" value={signup.phone}
                  onChange={(e) => setSignup({ ...signup, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-pw">Password</Label>
                <div className="relative">
                  <Input
                    id="su-pw"
                    type={showSignUpPassword ? "text" : "password"}
                    required
                    value={signup.password}
                    onChange={(e) => setSignup({ ...signup, password: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                  >
                    {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create Account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>

      <p className="text-xs text-muted-foreground mt-6">
        <Link to="/" className="hover:text-foreground">← Back to home</Link>
      </p>
    </div>
  );
}

