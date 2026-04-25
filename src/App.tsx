import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Wallet from "./pages/Wallet";
import Transactions from "./pages/Transactions";
import BuyData from "./pages/BuyData";
import MyStore from "./pages/MyStore";
import MyStoreOrders from "./pages/MyStoreOrders";
import FlyerGenerator from "./pages/FlyerGenerator";
import SubAgents from "./pages/SubAgents";
import ResultCheckers from "./pages/ResultCheckers";
import Withdrawal from "./pages/Withdrawal";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import PublicStore from "./pages/PublicStore";
import SubAgentSignup from "./pages/SubAgentSignup";
import NotFound from "./pages/NotFound";
import AdminLayout from "./components/admin/AdminLayout";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminAgentsPage from "./pages/admin/AdminAgentsPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminWithdrawalsPage from "./pages/admin/AdminWithdrawalsPage";
import AdminPricingPage from "./pages/admin/AdminPricingPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminSiteSettingsPage from "./pages/admin/AdminSiteSettingsPage";

const queryClient = new QueryClient();

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <MaintenanceGate>
      <AppShell>{children}</AppShell>
    </MaintenanceGate>
  </ProtectedRoute>
);

const AdminShell = () => (
  <ProtectedRoute requireAdmin>
    <AdminLayout />
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<MaintenanceGate><Landing /></MaintenanceGate>} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/store/:slug" element={<MaintenanceGate><PublicStore /></MaintenanceGate>} />
              <Route path="/store/:slug/subagent-program" element={<MaintenanceGate><SubAgentSignup /></MaintenanceGate>} />
              <Route path="/store/:slug/subagent" element={<MaintenanceGate><SubAgentSignup /></MaintenanceGate>} />

              <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
              <Route path="/wallet" element={<Shell><Wallet /></Shell>} />
              <Route path="/transactions" element={<Shell><Transactions /></Shell>} />
              <Route path="/buy/:network" element={<Shell><BuyData /></Shell>} />
              <Route path="/my-store" element={<Shell><MyStore /></Shell>} />
              <Route path="/my-store/orders" element={<Shell><ProtectedRoute requireAgent><MyStoreOrders /></ProtectedRoute></Shell>} />
              <Route path="/flyer-generator" element={<Shell><ProtectedRoute requireAgent><FlyerGenerator /></ProtectedRoute></Shell>} />
              <Route path="/withdrawal" element={<Shell><ProtectedRoute requireAgent><Withdrawal /></ProtectedRoute></Shell>} />
              <Route path="/sub-agents" element={<Shell><ProtectedRoute requireAgent><SubAgents /></ProtectedRoute></Shell>} />
              <Route path="/result-checkers" element={<Shell><ResultCheckers /></Shell>} />
              <Route path="/report" element={<Shell><Report /></Shell>} />
              <Route path="/settings" element={<Shell><Settings /></Shell>} />
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<Navigate to="/admin/overview" replace />} />
                <Route path="overview" element={<AdminOverviewPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="agents" element={<AdminAgentsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
                <Route path="pricing" element={<AdminPricingPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="site-settings" element={<AdminSiteSettingsPage />} />
              </Route>

              <Route path="*" element={<MaintenanceGate><NotFound /></MaintenanceGate>} />
            </Routes>
            <FloatingWhatsAppButton />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
