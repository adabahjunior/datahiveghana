import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Wifi, User, LogOut, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const { user, isAdmin, isAgent, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="glass sticky top-0 z-50 border-b border-border/50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Wifi className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-xl font-bold text-gradient">DataHive</span>
          <span className="text-xs text-muted-foreground font-medium mt-1">Ghana</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
          <Link to="/packages" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Packages</Link>
          <Link to="/become-agent" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Become an Agent</Link>
          <Link to="/track-order" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Track Order</Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {(isAdmin || isAgent) && (
                <Button variant="ghost" size="sm" onClick={() => navigate(isAdmin ? "/admin" : "/dashboard")}>
                  <LayoutDashboard className="h-4 w-4 mr-1" />
                  Dashboard
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => navigate("/auth")} className="glow-sm">
              <User className="h-4 w-4 mr-1" />
              Sign In
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
