import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun, User, Mail, Briefcase, Wallet, Pencil, Check, X, Target, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getStreak, formatCurrency } from "@/lib/storage";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";

const PROFESSIONS = ["Student", "Developer", "Designer", "Entrepreneur", "Freelancer", "Manager", "Other"];

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const [limit, setLimit] = useState(user?.spendingLimit?.toString() || "10000");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: "", gender: "", profession: "" });
  const [savingsGoal, setSavingsGoal] = useState(user?.savingsGoal?.toString() || "5000");
  const [savingsGoalName, setSavingsGoalName] = useState(user?.savingsGoalName || "Emergency Fund");

  useEffect(() => {
    if (user) {
      setLimit(user.spendingLimit?.toString() || "0");
      setSavingsGoal(user.savingsGoal?.toString() || "0");
      setSavingsGoalName(user.savingsGoalName || "Emergency Fund");
    }
  }, [user]);


  const handleLogout = () => { 
    signOut(); 
    navigate("/"); // 👈 FIXED (landing page)
  };

  const handleSaveLimit = async () => {
    if (!user) return;

    const val = Number(limit);
    if (val <= 0) return;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        spendingLimit: val,
      });

      toast({
        title: "Updated ✅",
        description: `Spending limit set to ${formatCurrency(val)}`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSavingsGoal = async () => {
    if (!user) return;

    const val = Number(savingsGoal);
    if (val <= 0) return;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        savingsGoal: val,
        savingsGoalName,
      });

      toast({
        title: "Goal updated! 🎯",
        description: `${savingsGoalName}: ${formatCurrency(val)}`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const startEditing = () => {
    if (!user) return;
    setEditForm({
      fullName: user?.fullName || "",
      gender: user?.gender || "",
      profession: user?.profession || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!user) return;

    if (!editForm.fullName.trim()) {
      toast({ title: "Error", description: "Name cannot be empty", variant: "destructive" });
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        fullName: editForm.fullName.trim(),
        gender: editForm.gender,
        profession: editForm.profession,
      });

      setEditing(false);

      toast({ title: "Profile updated! ✨" });
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;
  const streak = getStreak(user.uid);

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profile</h1>
        <ThemeToggle />
      </div>

      {/* Avatar & Name */}
      <div className="glass-card rounded-2xl p-5 flex items-center gap-4 relative animate-fade-in-up">
        <div className="w-14 h-14 rounded-full gradient-accent flex items-center justify-center text-accent-foreground text-xl font-bold shadow-lg">
          {user?.fullName?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-lg">{user?.fullName || ""}</p>
          <p className="text-sm text-muted-foreground">{user.profession}</p>
        </div>
        {!editing && (
          <button onClick={startEditing} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
            <Pencil size={16} />
          </button>
        )}
      </div>

      {editing && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up border-primary/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold">Edit Profile</p>
            <div className="flex gap-1.5">
              <button onClick={() => setEditing(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"><X size={16} /></button>
              <button onClick={saveEdit} className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground"><Check size={16} /></button>
            </div>
          </div>
          <Input value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Full Name" className="h-10 rounded-xl" />
          <div className="flex gap-2">
            {["Male", "Female", "Other"].map(g => (
              <button key={g} onClick={() => setEditForm(f => ({ ...f, gender: g }))} className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${editForm.gender === g ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{g}</button>
            ))}
          </div>
          <select value={editForm.profession} onChange={e => setEditForm(f => ({ ...f, profession: e.target.value }))} className="w-full h-10 rounded-xl bg-muted border border-border px-3 text-sm text-foreground">
            {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 animate-fade-in-up stagger-1">
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="w-10 h-10 rounded-full bg-warning/15 text-warning flex items-center justify-center mx-auto mb-2">
            <Flame size={20} />
          </div>
          <p className="text-2xl font-bold">{streak}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Day Streak</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="w-10 h-10 rounded-full gradient-cool flex items-center justify-center mx-auto mb-2 text-secondary-foreground">
            <Target size={20} />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(user.savingsGoal || 0)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Savings Goal</p>
        </div>
      </div>

      {/* Details */}
      <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-2">
        <div className="flex items-center gap-3"><Mail size={16} className="text-secondary" /><span className="text-sm">{user.email}</span></div>
        <div className="flex items-center gap-3"><User size={16} className="text-accent" /><span className="text-sm">{user.gender}</span></div>
        <div className="flex items-center gap-3"><Briefcase size={16} className="text-cat-bills" /><span className="text-sm">{user.profession}</span></div>
      </div>

      {/* Spending Limit */}
      <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-3">
        <div className="flex items-center gap-2"><Wallet size={16} className="text-primary" /><span className="text-sm font-medium">Monthly Spending Limit</span></div>
        <div className="flex gap-2">
          <Input type="number" value={limit} onChange={e => setLimit(e.target.value)} className="h-10 rounded-xl" min="1" />
          <Button onClick={handleSaveLimit} className="rounded-xl gradient-primary text-primary-foreground px-4">Save</Button>
        </div>
      </div>

      {/* Savings Goal */}
      <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-3 border-accent/20">
        <div className="flex items-center gap-2"><Target size={16} className="text-accent" /><span className="text-sm font-medium">Savings Goal</span></div>
        <Input placeholder="Goal name (e.g. Vacation)" value={savingsGoalName} onChange={e => setSavingsGoalName(e.target.value)} className="h-10 rounded-xl" />
        <div className="flex gap-2">
          <Input type="number" value={savingsGoal} onChange={e => setSavingsGoal(e.target.value)} className="h-10 rounded-xl" min="1" placeholder="Target amount" />
          <Button onClick={handleSaveSavingsGoal} className="rounded-xl gradient-accent text-accent-foreground px-4">Save</Button>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between animate-fade-in-up stagger-4">
        <div className="flex items-center gap-2">
          {dark ? <Moon size={16} className="text-secondary" /> : <Sun size={16} className="text-warning" />}
          <span className="text-sm font-medium">{dark ? "Dark Mode" : "Light Mode"}</span>
        </div>
        <button onClick={toggleTheme} className={`w-12 h-6 rounded-full transition-all relative ${dark ? "gradient-accent" : "bg-muted"}`}>
          <div className={`w-5 h-5 rounded-full bg-card absolute top-0.5 transition-all shadow ${dark ? "left-6" : "left-0.5"}`} />
        </button>
      </div>

      {/* Logout */}
      <Button onClick={handleLogout} variant="outline" className="w-full h-12 rounded-xl border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground animate-fade-in-up stagger-5">
        <LogOut className="mr-2" size={18} />
        Logout
      </Button>
    </div>
  );
}
