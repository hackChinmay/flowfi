import { describe, it, expect } from "vitest";

/**
 * Domain rules validation & authorization evaluation engine
 * Mirroring the exact logic defined in firestore.rules
 */

const ALLOWED_USER_FIELDS = [
  "fullName", "email", "photoURL", "gender", "profession",
  "spendingLimit", "savingsGoal", "savingsGoalName", "streak"
];

const ALLOWED_TRANSACTION_FIELDS = [
  "userId", "type", "amount", "category", "description", "createdAt", "date"
];

const ALLOWED_CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills", "Health",
  "Entertainment", "Education", "Salary", "Freelance",
  "Business", "Investment", "Gift", "Other"
];

function isValidEmail(email: string): boolean {
  if (typeof email !== "string" || email.length > 100) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function isValidDateString(dateStr: string): boolean {
  if (typeof dateStr !== "string" || dateStr.length > 40) return false;
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z?$/.test(dateStr)
  );
}

interface AuthToken {
  uid: string;
  email?: string;
}

interface RuleContext {
  auth: AuthToken | null;
  resource?: { data: Record<string, any> };
  request: {
    auth: AuthToken | null;
    resource: { data: Record<string, any> };
  };
}

// Rule evaluators mimicking firestore.rules
function evalReadUser(userId: string, ctx: RuleContext): boolean {
  return ctx.auth !== null && ctx.auth.uid === userId;
}

function evalCreateUser(userId: string, ctx: RuleContext): boolean {
  if (!ctx.auth || ctx.auth.uid !== userId) return false;
  const data = ctx.request.resource.data;
  const keys = Object.keys(data);
  if (!keys.every((k) => ALLOWED_USER_FIELDS.includes(k))) return false;
  if (!("fullName" in data) || !("email" in data)) return false;
  if (typeof data.fullName !== "string" || data.fullName.length > 100) return false;
  if (data.email !== null && !isValidEmail(data.email)) return false;
  // Create email binding to auth token
  if (ctx.auth.email && data.email !== ctx.auth.email) return false;
  return true;
}

function evalUpdateUser(userId: string, ctx: RuleContext): boolean {
  if (!ctx.auth || ctx.auth.uid !== userId) return false;
  const data = ctx.request.resource.data;
  const prev = ctx.resource?.data || {};
  // Email immutability on update
  if ("email" in data && prev.email && data.email !== prev.email) return false;
  const keys = Object.keys(data);
  if (!keys.every((k) => ALLOWED_USER_FIELDS.includes(k))) return false;
  if (typeof data.fullName !== "string" || data.fullName.length > 100) return false;
  return true;
}

function evalReadTransaction(ctx: RuleContext): boolean {
  if (!ctx.auth || !ctx.resource) return false;
  return ctx.resource.data.userId === ctx.auth.uid;
}

function evalCreateTransaction(ctx: RuleContext): boolean {
  if (!ctx.auth) return false;
  const data = ctx.request.resource.data;
  const keys = Object.keys(data);
  if (!keys.every((k) => ALLOWED_TRANSACTION_FIELDS.includes(k))) return false;
  if (!("userId" in data) || !("type" in data) || !("amount" in data) || !("category" in data)) return false;
  if (data.userId !== ctx.auth.uid) return false;
  if (!["income", "expense"].includes(data.type)) return false;
  if (typeof data.amount !== "number" || isNaN(data.amount) || data.amount <= 0 || data.amount > 1000000000) return false;
  if (!ALLOWED_CATEGORIES.includes(data.category)) return false;
  if (data.date && !isValidDateString(data.date)) return false;
  return true;
}

function evalUpdateTransaction(ctx: RuleContext): boolean {
  if (!ctx.auth || !ctx.resource) return false;
  if (ctx.resource.data.userId !== ctx.auth.uid) return false;
  const data = ctx.request.resource.data;
  const prev = ctx.resource.data;
  // Immutable userId and createdAt
  if (data.userId !== prev.userId) return false;
  if (prev.createdAt && data.createdAt !== prev.createdAt) return false;
  if (!evalCreateTransaction(ctx)) return false;
  return true;
}

function evalDeleteTransaction(ctx: RuleContext): boolean {
  if (!ctx.auth || !ctx.resource) return false;
  return ctx.resource.data.userId === ctx.auth.uid;
}

function evalUnknownCollection(ctx: RuleContext): boolean {
  // Default deny: match /{document=**} { allow read, write: if false; }
  return false;
}

describe("FlowFi Correction 7: Firestore Security Rules Authorization Logic", () => {
  const userA: AuthToken = { uid: "user_A", email: "user_a@flowfi.com" };
  const userB: AuthToken = { uid: "user_B", email: "user_b@flowfi.com" };

  describe("1. Profile Security Scenarios (Scenarios 1-5)", () => {
    it("Scenario 1: Unauthenticated user attempts to read a profile – DENIED", () => {
      const allowed = evalReadUser("user_A", {
        auth: null,
        request: { auth: null, resource: { data: {} } },
      });
      expect(allowed).toBe(false);
    });

    it("Scenario 2: User A reads their own profile – ALLOWED", () => {
      const allowed = evalReadUser("user_A", {
        auth: userA,
        request: { auth: userA, resource: { data: {} } },
      });
      expect(allowed).toBe(true);
    });

    it("Scenario 3: User A reads User B's profile – DENIED", () => {
      const allowed = evalReadUser("user_B", {
        auth: userA,
        request: { auth: userA, resource: { data: {} } },
      });
      expect(allowed).toBe(false);
    });

    it("Scenario 4: User A updates their own profile for permitted fields – ALLOWED", () => {
      const allowed = evalUpdateUser("user_A", {
        auth: userA,
        resource: { data: { fullName: "User A", email: "user_a@flowfi.com" } },
        request: {
          auth: userA,
          resource: { data: { fullName: "User A Updated", email: "user_a@flowfi.com", spendingLimit: 15000 } },
        },
      });
      expect(allowed).toBe(true);
    });

    it("Scenario 5: User A modifies User B's profile – DENIED", () => {
      const allowed = evalUpdateUser("user_B", {
        auth: userA,
        resource: { data: { fullName: "User B", email: "user_b@flowfi.com" } },
        request: {
          auth: userA,
          resource: { data: { fullName: "Hacked by A", email: "user_b@flowfi.com" } },
        },
      });
      expect(allowed).toBe(false);
    });

    it("Hardening: User A attempts to change their profile email to spoof another identity – DENIED", () => {
      const allowed = evalUpdateUser("user_A", {
        auth: userA,
        resource: { data: { fullName: "User A", email: "user_a@flowfi.com" } },
        request: {
          auth: userA,
          resource: { data: { fullName: "User A", email: "victim@flowfi.com" } },
        },
      });
      expect(allowed).toBe(false);
    });
  });

  describe("2. Transaction Security Scenarios (Scenarios 6-12)", () => {
    it("Scenario 6: User A creates a transaction with their own UID – ALLOWED", () => {
      const allowed = evalCreateTransaction({
        auth: userA,
        request: {
          auth: userA,
          resource: {
            data: {
              userId: "user_A",
              type: "expense",
              amount: 500,
              category: "Food",
              date: "2026-11-27T12:00:00.000Z",
            },
          },
        },
      });
      expect(allowed).toBe(true);
    });

    it("Scenario 7: User A creates a transaction with User B's UID – DENIED", () => {
      const allowed = evalCreateTransaction({
        auth: userA,
        request: {
          auth: userA,
          resource: {
            data: {
              userId: "user_B",
              type: "expense",
              amount: 500,
              category: "Food",
            },
          },
        },
      });
      expect(allowed).toBe(false);
    });

    it("Scenario 8: User A reads their own transactions – ALLOWED", () => {
      const allowed = evalReadTransaction({
        auth: userA,
        resource: { data: { userId: "user_A", amount: 100 } },
        request: { auth: userA, resource: { data: {} } },
      });
      expect(allowed).toBe(true);
    });

    it("Scenario 9: User A reads User B's transactions – DENIED", () => {
      const allowed = evalReadTransaction({
        auth: userA,
        resource: { data: { userId: "user_B", amount: 100 } },
        request: { auth: userA, resource: { data: {} } },
      });
      expect(allowed).toBe(false);
    });

    it("Scenario 10: User A updates their own transaction without changing ownership – ALLOWED", () => {
      const allowed = evalUpdateTransaction({
        auth: userA,
        resource: { data: { userId: "user_A", type: "expense", amount: 100, category: "Food" } },
        request: {
          auth: userA,
          resource: { data: { userId: "user_A", type: "expense", amount: 200, category: "Food" } },
        },
      });
      expect(allowed).toBe(true);
    });

    it("Scenario 11: User A attempts to change transaction ownership – DENIED", () => {
      const allowed = evalUpdateTransaction({
        auth: userA,
        resource: { data: { userId: "user_A", type: "expense", amount: 100, category: "Food" } },
        request: {
          auth: userA,
          resource: { data: { userId: "user_B", type: "expense", amount: 100, category: "Food" } },
        },
      });
      expect(allowed).toBe(false);
    });

    it("Scenario 12: User A deletes User B's transaction – DENIED", () => {
      const allowed = evalDeleteTransaction({
        auth: userA,
        resource: { data: { userId: "user_B", amount: 100 } },
        request: { auth: userA, resource: { data: {} } },
      });
      expect(allowed).toBe(false);
    });
  });

  describe("3. Default Deny & Schema Validation (Scenario 13 & edge cases)", () => {
    it("Scenario 13: An authenticated user accesses an unrelated or unknown collection – DENIED", () => {
      const allowed = evalUnknownCollection({
        auth: userA,
        request: { auth: userA, resource: { data: { secret: "data" } } },
      });
      expect(allowed).toBe(false);
    });

    it("Rejects invalid negative amount (amount <= 0) – DENIED", () => {
      const allowed = evalCreateTransaction({
        auth: userA,
        request: {
          auth: userA,
          resource: { data: { userId: "user_A", type: "expense", amount: -50, category: "Food" } },
        },
      });
      expect(allowed).toBe(false);
    });

    it("Rejects excessive amount exceeding upper ceiling (₹100 Crore) – DENIED", () => {
      const allowed = evalCreateTransaction({
        auth: userA,
        request: {
          auth: userA,
          resource: { data: { userId: "user_A", type: "expense", amount: 1000000001, category: "Food" } },
        },
      });
      expect(allowed).toBe(false);
    });

    it("Rejects unknown category not in enum set – DENIED", () => {
      const allowed = evalCreateTransaction({
        auth: userA,
        request: {
          auth: userA,
          resource: { data: { userId: "user_A", type: "expense", amount: 50, category: "Cryptocurrency" } },
        },
      });
      expect(allowed).toBe(false);
    });

    it("Rejects unexpected or injected fields (e.g. isAdmin) – DENIED", () => {
      const allowed = evalCreateTransaction({
        auth: userA,
        request: {
          auth: userA,
          resource: { data: { userId: "user_A", type: "expense", amount: 50, category: "Food", isAdmin: true } },
        },
      });
      expect(allowed).toBe(false);
    });

    it("Accepts both ISO-8601 calendar date and full timestamp format – ALLOWED", () => {
      expect(isValidDateString("2026-11-27")).toBe(true);
      expect(isValidDateString("2026-11-27T12:00:00.000Z")).toBe(true);
      expect(isValidDateString("invalid-date")).toBe(false);
    });
  });
});
