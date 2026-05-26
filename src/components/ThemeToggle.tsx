import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
      aria-label="Toggle theme"
      className="w-9 h-9 rounded-xl flex items-center justify-center bg-card/80 border border-border/60 shadow-sm backdrop-blur-sm hover:bg-muted transition-all hover:scale-105 active:scale-95"
    >
      {theme === "dark" ? (
        <Sun size={17} className="text-warning" />
      ) : (
        <Moon size={17} className="text-secondary" />
      )}
    </button>
  );
}
