import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Smartphone, Store, TrendingUp, Zap, Shield, Wallet } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function Landing() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">D</span>
            </div>
            <span className="font-bold">BenzosData Ghana</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" asChild><Link to="/auth">Sign In</Link></Button>
            <Button asChild><Link to="/auth">Get Started</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-sm font-medium">
            <Zap className="h-3.5 w-3.5" /> Instant data delivery
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-balance">
            Buy data. <span className="text-primary">Resell data.</span> Earn from anywhere.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
            Affordable bundles for MTN, Telecel and AirtelTigo. Become an agent and run your own branded mini-website with discounted wholesale prices.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" asChild className="gap-2">
              <Link to="/auth">Start Buying <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">Become an Agent</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Smartphone, title: "All major networks", desc: "MTN, Telecel, AirtelTigo iShare and BigTime — all in one place." },
            { icon: Store, title: "Your own store", desc: "Agents get a personal branded mini-website to sell to their customers." },
            { icon: TrendingUp, title: "Set your prices", desc: "Discounted wholesale rates. You decide your margin and keep the profit." },
            { icon: Wallet, title: "Wallet system", desc: "Top up once, pay instantly for any bundle. No repeated checkouts." },
            { icon: Shield, title: "Secure payments", desc: "All transactions encrypted and processed via Paystack." },
            { icon: Zap, title: "Instant delivery", desc: "Bundles arrive on the recipient's phone within seconds." },
          ].map((f, i) => (
            <Card key={i} className="p-7 space-y-3 hover:border-primary/50 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-20 text-center space-y-6">
          <h2 className="text-3xl lg:text-4xl font-bold">Ready to start earning?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Join hundreds of agents already running their data resale business with BenzosData Ghana.
          </p>
          <Button size="lg" asChild>
            <Link to="/auth">Create Free Account</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 text-sm text-muted-foreground flex flex-col sm:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} BenzosData Ghana. All rights reserved.</p>
          <p>Built for resellers. Made in Ghana.</p>
        </div>
      </footer>
    </div>
  );
}

