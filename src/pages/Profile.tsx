import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/contexts/TransactionContext";
import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun, User, Mail, Briefcase, Wallet, Pencil, Check, X, Target, Flame, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { getStreak, calculateStreakFromTransactions, formatCurrency } from "@/lib/storage";
import { roundCurrency } from "@/lib/financial";
import { getErrorMessage } from "@/lib/errorHandler";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PROFESSIONS = ["Student", "Developer", "Designer", "Entrepreneur", "Freelancer", "Manager", "Other"];

export default function Profile() {
  const { user, signOut, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const [limit, setLimit] = useState(user?.spendingLimit ? user.spendingLimit.toString() : "10000");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: "", gender: "Male", profession: PROFESSIONS[0] });
  const [savingsGoal, setSavingsGoal] = useState(user?.savingsGoal ? user.savingsGoal.toString() : "5000");
  const [savingsGoalName, setSavingsGoalName] = useState(user?.savingsGoalName || "Emergency Fund");
  const [limitLoading, setLimitLoading] = useState(false);
  const [goalLoading, setGoalLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { transactions: txns } = useTransactions();

  useEffect(() => {
    if (user) {
      if (user.spendingLimit !== undefined && user.spendingLimit !== null) {
        setLimit(user.spendingLimit.toString());
      }
      if (user.savingsGoal !== undefined && user.savingsGoal !== null) {
        setSavingsGoal(user.savingsGoal.toString());
      }
      if (user.savingsGoalName) {
        setSavingsGoalName(user.savingsGoalName);
      }
    }
  }, [user]);

  const streak = useMemo(() => {
    if (!user) return 0;
    return Math.max(calculateStreakFromTransactions(txns), getStreak(user.uid));
  }, [txns, user]);

  const handleLogout = async () => {
    if (logoutLoading) return;
    try {
      setLogoutLoading(true);
      await signOut();
      navigate("/");
    } catch (err) {
      toast({
        title: "Logout Failed",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== "DELETE") {
      toast({
        title: "Confirmation Required",
        description: 'Please type "DELETE" exactly to confirm account deletion.',
        variant: "destructive",
      });
      return;
    }

    try {
      setDeleteLoading(true);
      await deleteAccount();
      toast({
        title: "Account Permanently Deleted",
        description: "Your profile, transactions, and settings have been completely erased.",
      });
      navigate("/");
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      toast({
        title: "Account Deletion Failed",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
    }
  };

  const handleSaveLimit = async () => {
    if (!user || limitLoading) return;

    const val = roundCurrency(limit);
    if (isNaN(val) || val < 0 || val > 1000000000) {
      toast({ title: "Invalid Limit", description: "Please enter a valid amount (up to ₹100 Crore)", variant: "destructive" });
      return;
    }

    try {
      setLimitLoading(true);
      if (auth.currentUser?.uid !== user.uid) {
        throw new Error("Session mismatch: Save aborted because user account changed");
      }
      await updateDoc(doc(db, "users", user.uid), {
        spendingLimit: val,
      });

      toast({
        title: "Updated ✅",
        description: `Spending limit set to ${formatCurrency(val)}`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Update Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLimitLoading(false);
    }
  };

  const handleSaveSavingsGoal = async () => {
    if (!user || goalLoading) return;

    const val = roundCurrency(savingsGoal);
    if (isNaN(val) || val < 0 || val > 1000000000) {
      toast({ title: "Invalid Goal", description: "Please enter a valid amount (up to ₹100 Crore)", variant: "destructive" });
      return;
    }

    try {
      setGoalLoading(true);
      if (auth.currentUser?.uid !== user.uid) {
        throw new Error("Session mismatch: Save aborted because user account changed");
      }
      await updateDoc(doc(db, "users", user.uid), {
        savingsGoal: val,
        savingsGoalName: savingsGoalName.trim() || "Emergency Fund",
      });

      toast({
        title: "Goal updated! 🎯",
        description: `${savingsGoalName.trim() || "Emergency Fund"}: ${formatCurrency(val)}`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Update Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setGoalLoading(false);
    }
  };

  const startEditing = () => {
    if (!user) return;
    setEditForm({
      fullName: user?.fullName || "",
      gender: user?.gender && user.gender !== "Not specified" ? user.gender : "Male",
      profession: user?.profession && user.profession !== "Not specified" ? user.profession : PROFESSIONS[0],
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!user || profileSaving) return;

    if (!editForm.fullName.trim()) {
      toast({ title: "Error", description: "Name cannot be empty", variant: "destructive" });
      return;
    }

    try {
      setProfileSaving(true);
      await updateDoc(doc(db, "users", user.uid), {
        fullName: editForm.fullName.trim(),
        gender: editForm.gender,
        profession: editForm.profession,
      });

      setEditing(false);

      toast({ title: "Profile updated! ✨" });
    } catch (err) {
      console.error(err);
      toast({ title: "Update Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profile</h1>
        <ThemeToggle />
      </div>

      {/* Avatar & Name */}
      <div className="glass-card rounded-2xl p-5 flex items-center gap-4 relative animate-fade-in-up">
        <div className="w-14 h-14 rounded-full gradient-accent flex items-center justify-center text-accent-foreground text-xl font-bold shadow-lg" aria-hidden="true">
          {user?.fullName?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-lg">{user?.fullName || "User"}</p>
          <p className="text-sm text-muted-foreground">{user?.profession || "Profession not set"}</p>
        </div>
        {!editing && (
          <button
            onClick={startEditing}
            aria-label="Edit Profile"
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Edit Profile"
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {editing && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up border-primary/20" role="region" aria-label="Edit Profile Form">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold">Edit Profile</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setEditing(false)}
                aria-label="Cancel editing profile"
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              >
                <X size={16} aria-hidden="true" />
              </button>
              <button
                disabled={profileSaving}
                onClick={saveEdit}
                aria-label="Save profile changes"
                className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Check size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <label htmlFor="profile-fullname" className="sr-only">Full Name</label>
          <Input
            id="profile-fullname"
            aria-label="Full Name"
            value={editForm.fullName}
            onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
            placeholder="Full Name"
            className="h-10 rounded-xl"
          />
          <div className="flex gap-2" role="radiogroup" aria-label="Gender">
            {["Male", "Female", "Other"].map(g => (
              <button
                key={g}
                role="radio"
                aria-checked={editForm.gender === g}
                aria-label={g}
                onClick={() => setEditForm(f => ({ ...f, gender: g }))}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${editForm.gender === g ? "gradient-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {g}
              </button>
            ))}
          </div>
          <label htmlFor="profile-profession" className="sr-only">Profession</label>
          <select
            id="profile-profession"
            aria-label="Profession"
            value={editForm.profession}
            onChange={e => setEditForm(f => ({ ...f, profession: e.target.value }))}
            className="w-full h-10 rounded-xl bg-muted border border-border px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 animate-fade-in-up stagger-1">
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="w-10 h-10 rounded-full bg-warning/15 text-warning flex items-center justify-center mx-auto mb-2" aria-hidden="true">
            <Flame size={20} />
          </div>
          <p className="text-2xl font-bold">{streak}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Day Streak</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="w-10 h-10 rounded-full gradient-cool flex items-center justify-center mx-auto mb-2 text-secondary-foreground" aria-hidden="true">
            <Target size={20} />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(user.savingsGoal || 0)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {user.savingsGoalName || "Savings Goal"}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-2">
        <div className="flex items-center gap-3"><Mail size={16} className="text-secondary" aria-hidden="true" /><span className="text-sm">{user.email}</span></div>
        <div className="flex items-center gap-3"><User size={16} className="text-accent" aria-hidden="true" /><span className="text-sm">{user.gender || "Not specified"}</span></div>
        <div className="flex items-center gap-3"><Briefcase size={16} className="text-cat-bills" aria-hidden="true" /><span className="text-sm">{user.profession || "Not specified"}</span></div>
      </div>

      {/* Spending Limit */}
      <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-3">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-primary" aria-hidden="true" />
          <label htmlFor="spending-limit-input" className="text-sm font-medium">Monthly Spending Limit</label>
        </div>
        <div className="flex gap-2">
          <Input
            id="spending-limit-input"
            aria-label="Monthly spending limit in rupees"
            type="number"
            value={limit}
            onChange={e => setLimit(e.target.value)}
            className="h-10 rounded-xl"
            min="0"
            placeholder="e.g. 10000"
          />
          <Button
            disabled={limitLoading}
            onClick={handleSaveLimit}
            aria-label="Save spending limit"
            className="rounded-xl gradient-primary text-primary-foreground px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {limitLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Savings Goal */}
      <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-3 border-accent/20">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-accent" aria-hidden="true" />
          <label htmlFor="savings-goal-name-input" className="text-sm font-medium">Savings Goal</label>
        </div>
        <Input
          id="savings-goal-name-input"
          aria-label="Savings Goal Name"
          placeholder="Goal name (e.g. Emergency Fund)"
          value={savingsGoalName}
          onChange={e => setSavingsGoalName(e.target.value)}
          className="h-10 rounded-xl"
        />
        <div className="flex gap-2">
          <label htmlFor="savings-goal-amount-input" className="sr-only">Savings Goal Target Amount</label>
          <Input
            id="savings-goal-amount-input"
            aria-label="Savings Goal Target Amount in rupees"
            type="number"
            value={savingsGoal}
            onChange={e => setSavingsGoal(e.target.value)}
            className="h-10 rounded-xl"
            min="0"
            placeholder="Target amount"
          />
          <Button
            disabled={goalLoading}
            onClick={handleSaveSavingsGoal}
            aria-label="Save savings goal"
            className="rounded-xl gradient-accent text-accent-foreground px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {goalLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between animate-fade-in-up stagger-4">
        <div className="flex items-center gap-2">
          {dark ? <Moon size={16} className="text-secondary" aria-hidden="true" /> : <Sun size={16} className="text-warning" aria-hidden="true" />}
          <span className="text-sm font-medium">{dark ? "Dark Mode" : "Light Mode"}</span>
        </div>
        <button
          onClick={toggleTheme}
          role="switch"
          aria-checked={dark}
          aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
          className={`w-12 h-6 rounded-full transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${dark ? "gradient-accent" : "bg-muted"}`}
        >
          <div className={`w-5 h-5 rounded-full bg-card absolute top-0.5 transition-all shadow ${dark ? "left-6" : "left-0.5"}`} />
        </button>
      </div>

      {/* Logout */}
      <Button
        onClick={handleLogout}
        disabled={logoutLoading}
        variant="outline"
        aria-label="Log out of FlowFi"
        className="w-full h-12 rounded-xl border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground animate-fade-in-up stagger-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
      >
        <LogOut className="mr-2" size={18} aria-hidden="true" />
        {logoutLoading ? "Logging out..." : "Logout"}
      </Button>

      {/* Account Data & Privacy */}
      <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-5 border-destructive/20">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-destructive" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Account Data &amp; Privacy</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          FlowFi respects your privacy. You can permanently erase all your personal financial transactions, spending limits, savings goals, and account profile from Cloud Firestore at any time.
        </p>
        <Button
          onClick={() => {
            setDeleteConfirmText("");
            setDeleteDialogOpen(true);
          }}
          variant="outline"
          aria-label="Delete FlowFi account and data"
          className="w-full rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive text-xs h-10 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        >
          <Trash2 className="mr-2" size={14} aria-hidden="true" />
          Delete Account &amp; Financial Data
        </Button>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 size={20} aria-hidden="true" />
              Permanently Delete Account?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left text-xs leading-relaxed text-muted-foreground">
              <span>
                This action is <strong className="text-foreground">irreversible</strong>.
                All of your recorded financial transactions, monthly spending limits, savings goals, and profile records will be permanently deleted from Cloud Firestore.
              </span>
              <span className="block pt-2">
                To confirm, type <strong className="text-destructive font-mono">DELETE</strong> below:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              aria-label="Type DELETE to confirm account deletion"
              className="h-10 rounded-xl font-mono text-center tracking-wider text-sm"
            />
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              disabled={deleteLoading}
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText("");
              }}
              className="rounded-xl"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              disabled={deleteConfirmText.trim() !== "DELETE" || deleteLoading}
              onClick={handleDeleteAccount}
              variant="destructive"
              className="rounded-xl"
            >
              {deleteLoading ? "Deleting..." : "Permanently Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
