import { useNavigate } from "react-router-dom";
import { ArrowRight, TrendingUp, ShieldCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

function FinanceIllustration() {
  return (
    <svg viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[360px] md:max-w-[420px]">
      {/* Phone frame */}
      <rect x="80" y="20" width="160" height="280" rx="24" fill="white" fillOpacity="0.95" />
      <rect x="80" y="20" width="160" height="280" rx="24" stroke="white" strokeWidth="2" strokeOpacity="0.6" />
      {/* Notch */}
      <rect x="130" y="28" width="60" height="10" rx="5" fill="#e5e7eb" />
      {/* Screen area - header */}
      <rect x="90" y="48" width="140" height="28" rx="6" fill="#10b981" fillOpacity="0.15" />
      <text x="100" y="66" fontFamily="Arial" fontSize="10" fontWeight="bold" fill="#10b981">FlowFi</text>
      <circle cx="218" cy="62" r="6" fill="#10b981" fillOpacity="0.2" />
      {/* Balance card */}
      <rect x="90" y="84" width="140" height="56" rx="10" fill="#10b981" />
      <text x="100" y="102" fontFamily="Arial" fontSize="8" fill="white" fillOpacity="0.85">Total Balance</text>
      <text x="100" y="122" fontFamily="Arial" fontSize="16" fontWeight="bold" fill="white">₹24,500</text>
      {/* Decorative circle on card */}
      <circle cx="210" cy="105" r="22" fill="white" fillOpacity="0.1" />
      <circle cx="225" cy="118" r="14" fill="white" fillOpacity="0.07" />
      {/* Stats row */}
      <rect x="90" y="148" width="65" height="36" rx="8" fill="#ecfdf5" />
      <text x="100" y="163" fontFamily="Arial" fontSize="7" fill="#6b7280">Income</text>
      <text x="100" y="177" fontFamily="Arial" fontSize="10" fontWeight="bold" fill="#10b981">+₹5,200</text>
      <rect x="165" y="148" width="65" height="36" rx="8" fill="#fef2f2" />
      <text x="175" y="163" fontFamily="Arial" fontSize="7" fill="#6b7280">Expense</text>
      <text x="175" y="177" fontFamily="Arial" fontSize="10" fontWeight="bold" fill="#ef4444">-₹1,800</text>
      {/* Bar chart */}
      <rect x="90" y="194" width="140" height="70" rx="8" fill="#f9fafb" />
      <text x="100" y="207" fontFamily="Arial" fontSize="7" fontWeight="bold" fill="#6b7280">MONTHLY OVERVIEW</text>
      {/* Chart bars */}
      {[
        { x: 102, h: 28, color: "#10b981" },
        { x: 120, h: 20, color: "#10b981" },
        { x: 138, h: 36, color: "#10b981" },
        { x: 156, h: 16, color: "#d1fae5" },
        { x: 174, h: 30, color: "#10b981" },
        { x: 192, h: 24, color: "#d1fae5" },
        { x: 210, h: 38, color: "#10b981" },
      ].map((b, i) => (
        <rect key={i} x={b.x} y={255 - b.h} width="12" height={b.h} rx="3" fill={b.color} />
      ))}
      {/* Bottom nav dots */}
      <circle cx="148" cy="282" r="3" fill="#10b981" />
      <circle cx="160" cy="282" r="2" fill="#d1d5db" />
      <circle cx="172" cy="282" r="2" fill="#d1d5db" />

      {/* Floating coin 1 */}
      <circle cx="58" cy="80" r="18" fill="#fbbf24" />
      <text x="51" y="85" fontFamily="Arial" fontSize="13" fontWeight="bold" fill="white">₹</text>
      {/* Floating coin 2 */}
      <circle cx="268" cy="200" r="14" fill="#a78bfa" />
      <text x="262" y="205" fontFamily="Arial" fontSize="10" fontWeight="bold" fill="white">$</text>
      {/* Chart line overlay outside phone - growth arrow */}
      <path d="M40 240 Q80 200 120 180" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeDasharray="5,4" />
      <circle cx="120" cy="180" r="5" fill="#10b981" />
      {/* Star accents */}
      <circle cx="55" cy="160" r="4" fill="#fbbf24" fillOpacity="0.6" />
      <circle cx="270" cy="100" r="5" fill="#10b981" fillOpacity="0.3" />
      <circle cx="50" cy="240" r="3" fill="#a78bfa" fillOpacity="0.5" />
    </svg>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Full-screen gradient background like DashMate */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-emerald-400/60 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/30 pointer-events-none" />
      {/* Subtle noise/texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* Floating blobs */}
      <div className="absolute top-[-80px] right-[-60px] w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-40px] left-[-40px] w-80 h-80 md:w-96 md:h-96 rounded-full bg-emerald-300/20 blur-3xl pointer-events-none" />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow">
            <TrendingUp size={18} className="text-white" />
          </div>
          <span className="font-extrabold text-xl text-white tracking-tight">FlowFi</span>
        </div>
        <div className="[&_button]:border-white/30 [&_button]:text-white [&_button]:bg-white/10 [&_button]:backdrop-blur">
          <ThemeToggle />
        </div>
      </header>

      {/* Hero - split layout like DashMate */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-center px-6 pt-6 pb-10 gap-10 md:gap-16 max-w-6xl mx-auto w-full">
        {/* Left text side */}
        <div className="flex-1 flex flex-col items-start justify-center space-y-5 md:pr-8">
          {/* App name big */}
          <div>
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold text-white leading-none tracking-tight">
              FlowFi
            </h1>
            <p className="text-white/80 text-lg md:text-xl font-medium mt-2">
              Feel your finances
            </p>
          </div>

          {/* Secondary tagline */}
          <p className="text-white/70 text-sm md:text-base leading-relaxed max-w-xs">
            From tracking to saving — all in one beautifully simple app. No bank required.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={() => navigate("/login")}
              data-testid="button-get-started"
              className="px-8 py-3.5 rounded-2xl bg-white text-primary font-bold text-base shadow-xl hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              Get Started <ArrowRight size={16} className="inline ml-1" />
            </button>
            <button
              onClick={() => navigate("/signup")}
              data-testid="button-create-account"
              className="px-6 py-3.5 rounded-2xl bg-white/15 backdrop-blur border border-white/30 text-white font-semibold text-sm hover:bg-white/20 transition-all"
            >
              Create Free Account
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="flex items-center gap-1.5 text-xs text-white/70 bg-white/10 backdrop-blur rounded-full px-3 py-1.5">
              <ShieldCheck size={12} className="text-white/80" /> 100% Private
            </span>
            <span className="flex items-center gap-1.5 text-xs text-white/70 bg-white/10 backdrop-blur rounded-full px-3 py-1.5">
              ₹0 Always Free
            </span>
            <span className="flex items-center gap-1.5 text-xs text-white/70 bg-white/10 backdrop-blur rounded-full px-3 py-1.5">
              ∞ Transactions
            </span>
          </div>
        </div>

        {/* Right illustration side */}
        <div className="flex-1 flex items-center justify-center relative">
          {/* Glow behind illustration */}
          <div className="absolute w-64 h-64 rounded-full bg-white/15 blur-3xl" />
          <div className="relative drop-shadow-2xl">
            <FinanceIllustration />
          </div>
        </div>
      </div>

      {/* Feature strip at bottom */}
      <div className="relative z-10 bg-background/90 backdrop-blur-lg border-t border-border/30 py-5 px-6">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[
            { emoji: "📊", label: "Smart Analytics" },
            { emoji: "🎯", label: "Savings Goals" },
            { emoji: "💡", label: "Money Tips" },
          ].map(f => (
            <div key={f.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{f.emoji}</span>
              <span className="text-xs font-semibold text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
