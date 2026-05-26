import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, UserPlus, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";

const PROFESSIONS = ["Student", "Developer", "Designer", "Entrepreneur", "Freelancer", "Manager", "Other"];
const GENDERS = ["Male", "Female", "Other"];

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", gender: "Male", profession: PROFESSIONS[0] });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) return;
    if (form.password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await signUp({
        fullName: form.fullName,
        email: form.email,
        password: form.password
      });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-120px] left-[-80px] w-80 h-80 rounded-full gradient-primary opacity-20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-60px] w-72 h-72 rounded-full gradient-cool opacity-15 blur-3xl pointer-events-none" />
      <div className="absolute top-[45%] right-[-30px] w-48 h-48 rounded-full gradient-pink opacity-10 blur-2xl pointer-events-none" />

      {/* Floating decorative elements */}
      <div className="absolute top-14 right-8 w-9 h-9 rounded-2xl gradient-accent opacity-30 flex items-center justify-center -rotate-12 pointer-events-none">
        <Sparkles size={15} className="text-white" />
      </div>
      <div className="absolute bottom-40 left-6 w-10 h-10 rounded-2xl gradient-cool opacity-25 flex items-center justify-center rotate-6 pointer-events-none">
        <TrendingUp size={17} className="text-white" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center shadow">
            <TrendingUp size={15} className="text-white" />
          </div>
          <span className="font-bold text-base text-gradient">FlowFi</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-5 py-6 relative z-10">
        <div className="w-full max-w-sm">
          {/* Hero above card */}
          <div className="text-center mb-5 space-y-1">
            <h1 className="text-3xl font-extrabold text-gradient">Join FlowFi</h1>
            <p className="text-muted-foreground text-sm">Create your free account in seconds</p>
          </div>

          {/* Glass card */}
          <div className="glass-card rounded-3xl p-6 shadow-2xl space-y-4 border border-border/40">
            {/* Card header */}
            <div className="flex items-center gap-3 pb-2 border-b border-border/40">
              <div className="w-10 h-10 rounded-2xl gradient-accent flex items-center justify-center shadow-sm">
                <UserPlus size={17} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-base">Create Account</p>
                <p className="text-xs text-muted-foreground">Fill in your details below</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Full name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name</label>
                <Input
                  placeholder="John Doe"
                  value={form.fullName}
                  onChange={e => update("fullName", e.target.value)}
                  required
                  data-testid="input-fullname"
                  className="h-11 rounded-xl bg-background/60"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => update("email", e.target.value)}
                  required
                  data-testid="input-email"
                  className="h-11 rounded-xl bg-background/60"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</label>
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={form.password}
                    onChange={e => update("password", e.target.value)}
                    required
                    data-testid="input-password"
                    className="h-11 rounded-xl pr-10 bg-background/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => update("gender", g)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                        form.gender === g
                          ? "gradient-primary text-white shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profession */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profession</label>
                <select
                  value={form.profession}
                  onChange={e => update("profession", e.target.value)}
                  className="w-full h-11 rounded-xl bg-background/60 border border-border px-3 text-sm text-foreground"
                >
                  {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="button-sign-up"
                className="w-full h-11 rounded-xl gradient-primary text-white font-bold shadow-md shadow-primary/30 hover:opacity-90 transition-all mt-1"
              >
                <UserPlus size={16} className="mr-2" />
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Sign In →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
