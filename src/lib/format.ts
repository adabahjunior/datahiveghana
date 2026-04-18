export const formatGHS = (amount: number | string): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "GH₵ 0.00";
  return `GH₵ ${num.toFixed(2)}`;
};

export const formatVolume = (mb: number): string => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
};

export const formatDate = (d: string | Date): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GH", { year: "numeric", month: "short", day: "numeric" });
};

export const formatDateTime = (d: string | Date): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const networkLabel: Record<string, string> = {
  mtn: "MTN",
  telecel: "Telecel",
  airteltigo_ishare: "AirtelTigo iShare",
  airteltigo_bigtime: "AirtelTigo BigTime",
};

export const networkColor: Record<string, string> = {
  mtn: "mtn",
  telecel: "telecel",
  airteltigo_ishare: "airteltigo",
  airteltigo_bigtime: "airteltigo",
};

// Paystack charge: 1.95% capped at 100 GHS
export const calcPaystackCharge = (amount: number, percent = 1.95, cap = 100): number => {
  const charge = (amount * percent) / 100;
  return Math.min(charge, cap);
};

export const calcTotalWithCharges = (amount: number): number => {
  return amount + calcPaystackCharge(amount);
};

export const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").substring(0, 40);
