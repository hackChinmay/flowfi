import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="sticky top-0 z-50 bg-amber-500/90 dark:bg-amber-600/90 text-white backdrop-blur-sm px-4 py-1.5 text-center text-xs font-semibold flex items-center justify-center gap-2 shadow-sm animate-fade-in">
      <WifiOff size={13} className="shrink-0" />
      <span>You are currently offline. Financial changes will sync when connected.</span>
    </div>
  );
}
