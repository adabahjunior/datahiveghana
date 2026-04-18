import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Wallet from "./pages/Wallet";
import Transactions from "./pages/Transactions";
import BuyData from "./pages/BuyData";
import MyStore from "./pages/MyStore";
import MyStoreOrders from "./pages/MyStoreOrders";
import Withdrawal from "./pages/Withdrawal";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import PublicStore from "./pages/PublicStore";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><AppShell>{children}</AppShell></ProtectedRoute>
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
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/store/:slug" element={<PublicStore />} />

              <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
              <Route path="/wallet" element={<Shell><Wallet /></Shell>} />
              <Route path="/transactions" element={<Shell><Transactions /></Shell>} />
              <Route path="/buy/:network" element={<Shell><BuyData /></Shell>} />
              <Route path="/my-store" element={<Shell><MyStore /></Shell>} />
              <Route path="/my-store/orders" element={<Shell><ProtectedRoute requireAgent><MyStoreOrders /></ProtectedRoute></Shell>} />
              <Route path="/withdrawal" element={<Shell><ProtectedRoute requireAgent><Withdrawal /></ProtectedRoute></Shell>} />
              <Route path="/report" element={<Shell><Report /></Shell>} />
              <Route path="/settings" element={<Shell><Settings /></Shell>} />
              <Route path="/admin" element={<Shell><ProtectedRoute requireAdmin><Admin /></ProtectedRoute></Shell>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
