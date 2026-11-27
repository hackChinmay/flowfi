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
import { getErrorMessage } from "@/lib/errorHandler";

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

      // Clean up any legacy insecure plaintext password storage
      localStorage.removeItem("auth_password");
      localStorage.setItem("auth_email", email);

      // Securely store credentials in device keychain/keystore via Capacitor NativeBiometric if available
      try {
        await NativeBiometric.setCredentials({
          server: "flowfi.app",
          username: email,
          password: password,
        });
      } catch {
        // Ignored on web/unsupported platforms
      }

      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: getErrorMessage(err),
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
        description: getErrorMessage(err),
        variant: "destructive"
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  // ✅ SECURE BIOMETRIC LOGIN
  const handleFingerprint = async () => {
    try {
      await NativeBiometric.verifyIdentity({
        reason: "Login with fingerprint",
        title: "Authentication"
      });

      let creds: { username?: string; password?: string } | null = null;
      try {
        creds = await NativeBiometric.getCredentials({ server: "flowfi.app" });
      } catch {
        creds = null;
      }

      if (!creds?.username || !creds?.password) {
        toast({
          title: "Error",
          description: "Please sign in with email and password first to enable biometric login",
          variant: "destructive"
        });
        return;
      }

      await signIn(creds.username, creds.password);
      navigate("/dashboard");

      toast({
        title: "Success",
        description: "Authenticated successfully"
      });
    } catch (error) {
      toast({
        title: "Failed",
        description: "Biometric authentication failed or cancelled",
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
              <div className="space-y-1">
                <label htmlFor="login-email" className="sr-only">Email</label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Email"
                  aria-label="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="login-password" className="sr-only">Password</label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Password"
                    aria-label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl pr-10 focus-visible:ring-2 focus-visible:ring-primary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    {showPwd ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* GOOGLE LOGIN */}
            <Button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              variant="outline"
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt=""
                className="w-4 h-4"
                aria-hidden="true"
              />
              {googleLoading ? "Signing in..." : "Continue with Google"}
            </Button>

            {/* FINGERPRINT */}
            <button
              type="button"
              onClick={handleFingerprint}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Fingerprint size={18} aria-hidden="true" />
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