const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const formatMoney = (n: number) => money.format(n);

export const formatRange = (min: number, max: number) => `${formatMoney(min)} – ${formatMoney(max)}`;

export function formatRelative(iso: string, now = new Date()) {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
