import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export const AccountRevokedView = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-lg w-full p-8 space-y-4 text-center">
        <h1 className="text-2xl font-bold">Account Access Revoked</h1>
        <p className="text-sm text-muted-foreground">
          Your account has been restricted by an administrator. Contact support for assistance.
        </p>
        <Button className="w-full" onClick={handleSignOut}>Sign Out</Button>
      </Card>
    </div>
  );
};
