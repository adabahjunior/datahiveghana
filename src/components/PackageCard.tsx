import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface PackageCardProps {
  id: string;
  name: string;
  sizeMb: number;
  price: number;
  networkName: string;
  onBuy: () => void;
}

export default function PackageCard({ name, sizeMb, price, networkName, onBuy }: PackageCardProps) {
  const sizeLabel = sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(0)}GB` : `${sizeMb}MB`;

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col gap-3 animate-fade-in hover:glow-sm transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{networkName}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{sizeLabel}</span>
      </div>
      <h3 className="font-heading text-2xl font-bold">{name}</h3>
      <div className="flex items-end justify-between mt-auto pt-3 border-t border-border/30">
        <div>
          <span className="text-2xl font-bold text-gradient">GH₵{price.toFixed(2)}</span>
        </div>
        <Button size="sm" onClick={onBuy} className="glow-sm group-hover:glow-md transition-all">
          <ShoppingCart className="h-4 w-4 mr-1" />
          Buy
        </Button>
      </div>
    </div>
  );
}
