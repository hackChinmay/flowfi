import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ArrowRightLeft, PlusCircle, BarChart2, User } from "lucide-react";

const NAV_ITEMS = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Home", isAdd: false },
  { path: "/transactions", icon: ArrowRightLeft, label: "History", isAdd: false },
  { path: "/add", icon: PlusCircle, label: "Add", isAdd: true },
  { path: "/analytics", icon: BarChart2, label: "Analytics", isAdd: false },
  { path: "/profile", icon: User, label: "Profile", isAdd: false },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50 safe-bottom shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-1">
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                item.isAdd ? "relative -top-4" : ""
              }`}
            >
              {item.isAdd ? (
                <div className="w-13 h-13 w-[52px] h-[52px] rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/35 hover:scale-105 active:scale-95 transition-transform">
                  <PlusCircle size={26} className="text-white" />
                </div>
              ) : (
                <>
                  {/* Active background pill */}
                  {active && (
                    <div className="absolute inset-0 bg-primary/10 rounded-xl" />
                  )}
                  <div className={`relative transition-all duration-200 ${active ? "text-primary scale-110" : "text-muted-foreground"}`}>
                    <item.icon size={21} strokeWidth={active ? 2.5 : 1.8} />
                  </div>
                  <span className={`text-[10px] font-semibold relative transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                  {/* Active dot indicator */}
                  {active && (
                    <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary" />
                  )}
                </>
              )}
              {item.isAdd && (
                <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">Add</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
