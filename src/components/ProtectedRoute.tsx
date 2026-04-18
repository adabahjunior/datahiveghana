import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({
  children,
  requireAdmin = false,
  requireAgent = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAgent?: boolean;
}) => {
  const { user, loading, isAdmin, isAgent } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (requireAgent && !isAgent) return <Navigate to="/my-store" replace />;
  return <>{children}</>;
};
