import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  subtitleClassName?: string;
  showSubtitle?: boolean;
  name?: string;
  subtitle?: string;
};

export function BrandLogo({
  className,
  logoClassName,
  textClassName,
  subtitleClassName,
  showSubtitle = true,
  name = "BenzosData",
  subtitle = "Ghana",
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src="/benzos-data-shop-logo.png"
        alt="Benzos Data Shop logo"
        className={cn("h-9 w-9 rounded-md object-contain", logoClassName)}
        loading="eager"
      />
      <div>
        <p className={cn("font-bold leading-tight", textClassName)}>{name}</p>
        {showSubtitle ? (
          <p className={cn("text-xs text-muted-foreground leading-tight", subtitleClassName)}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}