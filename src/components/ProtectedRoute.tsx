import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { AccountRevokedView } from "@/components/AccountRevokedView";

export const ProtectedRoute = ({
  children,
  requireAdmin = false,
  requireAgent = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAgent?: boolean;
}) => {
  const { user, loading, isAdmin, isSeller, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.is_revoked && !isAdmin) return <AccountRevokedView />;
  if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (requireAgent && !isSeller) return <Navigate to="/my-store" replace />;
  return <>{children}</>;
};
