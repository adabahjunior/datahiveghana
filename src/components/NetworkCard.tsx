import { cn } from "@/lib/utils";

interface NetworkCardProps {
  id: string;
  name: string;
  selected: boolean;
  onClick: () => void;
}

const networkColors: Record<string, string> = {
  mtn: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30",
  airteltigo: "from-red-500/20 to-red-600/5 border-red-500/30",
  telecel: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
};

const networkLogos: Record<string, string> = {
  mtn: "📡",
  airteltigo: "📶",
  telecel: "🌐",
};

export default function NetworkCard({ id, name, selected, onClick }: NetworkCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "glass-card relative flex flex-col items-center gap-3 rounded-xl p-6 transition-all duration-300 cursor-pointer",
        "hover:scale-105 hover:glow-md",
        selected && "ring-2 ring-primary glow-md scale-105",
        `bg-gradient-to-b ${networkColors[id] ?? ""}`
      )}
    >
      <span className="text-4xl">{networkLogos[id] ?? "📡"}</span>
      <span className="font-heading font-bold text-lg">{name}</span>
      {selected && (
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <span className="text-xs text-primary-foreground">✓</span>
        </div>
      )}
    </button>
  );
}
