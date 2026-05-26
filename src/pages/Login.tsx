import { NativeBiometric } from "capacitor-native-biometric";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Fingerprint,
  LogIn,
  TrendingUp,
  Wallet,
  BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth(); // ✅ added Google
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ✅ EMAIL LOGIN
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await signIn(email, password);

      // Save for fingerprint login
      localStorage.setItem("auth_email", email);
      localStorage.setItem("auth_password", password);

      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Google Login Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  // ✅ FINGERPRINT LOGIN
  const handleFingerprint = async () => {
    try {
      await NativeBiometric.verifyIdentity({
        reason: "Login with fingerprint",
        title: "Authentication"
      });

      const savedEmail = localStorage.getItem("auth_email");
      const savedPassword = localStorage.getItem("auth_password");

      if (!savedEmail || !savedPassword) {
        toast({
          title: "Error",
          description: "Please login once first",
          variant: "destructive"
        });
        return;
      }

      await signIn(savedEmail, savedPassword);
      navigate("/dashboard");

      toast({
        title: "Success",
        description: "Authenticated successfully"
      });
    } catch (error) {
      toast({
        title: "Failed",
        description: "Authentication failed",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-140px] right-[-100px] w-96 h-96 rounded-full gradient-primary opacity-25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-120px] left-[-80px] w-80 h-80 rounded-full gradient-accent opacity-20 blur-3xl pointer-events-none" />

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

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold text-gradient">
              Welcome back!
            </h1>
            <p className="text-muted-foreground text-sm">
              Sign in to manage your finances
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 shadow-2xl space-y-5">
            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-3"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <Button type="submit" className="w-full">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* GOOGLE LOGIN */}
            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <img
                src="https://www.google.com/favicon.ico"
                className="w-4 h-4"
              />
              {googleLoading ? "Signing in..." : "Continue with Google"}
            </Button>

            {/* FINGERPRINT */}
            <button
              onClick={handleFingerprint}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border"
            >
              <Fingerprint size={18} />
              Use Fingerprint
            </button>
          </div>

          <p className="text-center mt-4 text-sm">
            Don’t have an account?{" "}
            <Link to="/signup" className="text-primary font-bold">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}