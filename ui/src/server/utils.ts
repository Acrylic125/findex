export function getTrpcUrl() {
  const base = (() => {
    if (typeof window !== "undefined") return "";
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "https://localhost:3000";
  })();
  return `${base}/api/trpc`;
}
