import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { DollarSign, Store, Users, TrendingUp } from "lucide-react";

export default function BecomeAgent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-heading text-4xl font-bold mb-4">
            Become a <span className="text-gradient">DataHive Agent</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-12">
            Get wholesale pricing, run your own online data store, recruit sub-agents, and earn from every sale.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {[
              { icon: DollarSign, title: "Discounted Pricing", desc: "Buy data bundles at agent-exclusive wholesale prices" },
              { icon: Store, title: "Your Own Store", desc: "Get a branded online store with your custom markup pricing" },
              { icon: Users, title: "Recruit Sub-Agents", desc: "Build your team and manage sub-agents under your network" },
              { icon: TrendingUp, title: "Track Profits", desc: "Full dashboard with sales analytics and profit tracking" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-card rounded-xl p-6 text-left">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-heading font-bold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <Button size="lg" className="glow-md" asChild>
            <Link to={user ? "/dashboard" : "/auth"}>
              {user ? "Go to Dashboard" : "Sign Up as Agent"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
