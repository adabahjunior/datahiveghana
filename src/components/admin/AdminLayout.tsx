import { NavLink, Outlet } from "react-router-dom";
import { Bell, CreditCard, LayoutDashboard, Package, Settings, ShoppingCart, Users, Wallet, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { to: "/admin/agents", label: "Agents", icon: Users },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
  { to: "/admin/pricing", label: "Pricing", icon: CreditCard },
  { to: "/admin/notifications", label: "Notification", icon: Bell },
  { to: "/admin/site-settings", label: "Site Setting", icon: Settings },
];

export default function AdminLayout() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-72 border-r border-border p-4 hidden lg:block">
        <div className="px-3 py-4 border-b border-border mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">BenzosData Ghana</p>
          <h1 className="text-xl font-bold mt-1">Admin Control</h1>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-8 border-t border-border pt-4 space-y-2">
          <Button className="w-full" variant="outline" asChild>
            <NavLink to="/dashboard"><Wrench className="h-4 w-4 mr-2" />Back to App</NavLink>
          </Button>
          <Button className="w-full" variant="ghost" onClick={signOut}>Sign Out</Button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 lg:p-10">
        <div className="lg:hidden mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">BenzosData Ghana</p>
          <h1 className="text-2xl font-bold">Admin Control</h1>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  "px-3 py-2 rounded-lg text-sm border border-border text-center",
                  isActive ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                )}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

