import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Wallet, Receipt, Smartphone, Store, ShoppingBag,
  Banknote, MessageSquareWarning, Settings, Sun, Moon, LogOut, Menu, Shield, ChevronDown, ChevronRight, Users, Search, WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import { formatGHS } from "@/lib/format";
import { LoginNotificationPopup } from "@/components/LoginNotificationPopup";

const buyDataItems = [
  { to: "/buy/mtn", label: "MTN Data" },
  { to: "/buy/telecel", label: "Telecel" },
  { to: "/buy/airteltigo-ishare", label: "AirtelTigo iShare" },
  { to: "/buy/airteltigo-bigtime", label: "AirtelTigo BigTime" },
];

const NavItem = ({ to, icon: Icon, label, end }: { to: string; icon: any; label: string; end?: boolean }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )
    }
  >
    <Icon className="h-[18px] w-[18px]" />
    <span>{label}</span>
  </NavLink>
);

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { profile, isAgent, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [buyOpen, setBuyOpen] = useState(location.pathname.startsWith("/buy"));

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col bg-sidebar" onClick={onNavigate}>
      {/* Brand */}
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">D</span>
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">DataHive</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Ghana</p>
          </div>
        </div>
      </div>

      {/* Wallet snapshot */}
      {profile && (
        <div className="px-4 pt-4">
          <div className="rounded-xl bg-sidebar-accent px-4 py-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Wallet</p>
            <p className="font-bold text-lg mt-0.5">{formatGHS(profile.wallet_balance)}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" end />
        <NavItem to="/wallet" icon={Wallet} label="Wallet" />
        <NavItem to="/transactions" icon={Receipt} label="Transactions" />

        {/* Buy Data group */}
        <button
          onClick={(e) => { e.stopPropagation(); setBuyOpen((o) => !o); }}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
            location.pathname.startsWith("/buy")
              ? "text-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
          )}
        >
          <Smartphone className="h-[18px] w-[18px]" />
          <span className="flex-1 text-left">Buy Data</span>
          {buyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {buyOpen && (
          <div className="ml-4 pl-4 border-l border-sidebar-border space-y-1">
            {buyDataItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  cn(
                    "block px-4 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {it.label}
              </NavLink>
            ))}
          </div>
        )}

        <NavItem to="/my-store" icon={Store} label="My Store" />
        {isAgent && <NavItem to="/my-store/orders" icon={ShoppingBag} label="My Store Orders" />}
        {isAgent && <NavItem to="/flyer-generator" icon={WandSparkles} label="Flyer Generator" />}
        {isAgent && <NavItem to="/withdrawal" icon={Banknote} label="Withdrawal" />}
        {isAgent && <NavItem to="/sub-agents" icon={Users} label="Sub Agents (Coming Soon)" />}
        {isAgent && <NavItem to="/result-checkers" icon={Search} label="Result Checkers (Coming Soon)" />}

        <NavItem to="/report" icon={MessageSquareWarning} label="Report Issue" />
        <NavItem to="/settings" icon={Settings} label="Settings" />

        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-sidebar-border">
            <p className="px-4 py-1 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Admin</p>
            <NavItem to="/admin/overview" icon={Shield} label="Admin Dashboard" end />
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <button
          onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <span className="flex items-center gap-3">
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 px-4 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <LoginNotificationPopup />
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-72 border-r border-sidebar-border fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-background border-b border-border flex items-center justify-between px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">D</span>
          </div>
          <span className="font-bold text-sm">DataHive</span>
        </div>
        <div className="w-9" />
      </header>

      {/* Main */}
      <main className="flex-1 lg:ml-72 pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 lg:py-12">{children}</div>
      </main>
    </div>
  );
};
