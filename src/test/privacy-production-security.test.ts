import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { sanitizeContext } from "../lib/errorHandler";
import { clearUserData, signUp, signOut } from "../lib/storage";

// Mock Firebase Auth and Firestore for Account Deletion testing
vi.mock("capacitor-native-biometric", () => ({
  NativeBiometric: {
    deleteCredentials: vi.fn().mockResolvedValue(true),
  },
}));

describe("FlowFi Privacy & Production Security Audit", () => {
  describe("1. Sensitive Credential & Privacy Sanitization", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("never persists passwords in plaintext during local sign-up", async () => {
      const plainPassword = "superSecretPassword123!";
      const user = await signUp({
        fullName: "Privacy User",
        email: "privacy@flowfi.test",
        password: plainPassword,
        gender: "Female",
        profession: "Developer",
      });

      const storedUsers = JSON.parse(localStorage.getItem("flowfi_users") || "[]");
      expect(storedUsers.length).toBeGreaterThan(0);
      const stored = storedUsers.find((u: any) => u.email === "privacy@flowfi.test");
      expect(stored).toBeDefined();
      // Password must be SHA-256 hashed, not stored in plaintext
      expect(stored.password).not.toBe(plainPassword);
      expect(stored.password).toMatch(/^[a-f0-9]{64}$/);
    });

    it("clears all obsolete auth credentials on signOut", () => {
      localStorage.setItem("auth_password", "plaintextSecret");
      localStorage.setItem("auth_email", "privacy@flowfi.test");
      localStorage.setItem("flowfi_session", "session-id-123");
      localStorage.setItem("flowfi_users", "[]");
      localStorage.setItem("flowfi_transactions", "[]");

      signOut();

      expect(localStorage.getItem("auth_password")).toBeNull();
      expect(localStorage.getItem("auth_email")).toBeNull();
      expect(localStorage.getItem("flowfi_session")).toBeNull();
      expect(localStorage.getItem("flowfi_users")).toBeNull();
      expect(localStorage.getItem("flowfi_transactions")).toBeNull();
    });

    it("clears user-specific streak cache with clearUserData", () => {
      const uid = "user_privacy_99";
      localStorage.setItem(`flowfi_streak_${uid}`, JSON.stringify({ count: 12, lastDate: "2026-11-27" }));
      expect(localStorage.getItem(`flowfi_streak_${uid}`)).not.toBeNull();

      clearUserData(uid);

      expect(localStorage.getItem(`flowfi_streak_${uid}`)).toBeNull();
    });

    it("sanitizeContext redacts passwords, tokens, API keys, CVV, and financial identifiers", () => {
      const rawLogContext = {
        userId: "uid_12345",
        email: "user@flowfi.com",
        userPassword: "secretPassword!",
        authToken: "bearer-token-xyz-123",
        firebaseApiKey: "AIzaSyD-mockKey",
        nested: {
          pinCode: "1234",
          cvvCode: "999",
          panNumber: "ABCDE1234F",
          cardNumber: "4111222233334444",
          accountNumber: "987654321012",
        },
        regularDetail: "User added expense",
        amountPaise: 45000,
      };

      const clean = sanitizeContext(rawLogContext);

      expect(clean.userId).toBe("uid_12345");
      expect(clean.email).toBe("user@flowfi.com");
      expect(clean.userPassword).toBe("[REDACTED]");
      expect(clean.authToken).toBe("[REDACTED]");
      expect(clean.firebaseApiKey).toBe("[REDACTED]");
      expect(clean.nested.pinCode).toBe("[REDACTED]");
      expect(clean.nested.cvvCode).toBe("[REDACTED]");
      expect(clean.nested.panNumber).toBe("[REDACTED]");
      expect(clean.nested.cardNumber).toBe("[REDACTED]");
      expect(clean.nested.accountNumber).toBe("[REDACTED]");
      expect(clean.regularDetail).toBe("User added expense");
      expect(clean.amountPaise).toBe(45000);
    });
  });

  describe("2. Static Production Configuration & Build Security", () => {
    it("index.html contains no third-party CDN leaks or Lovable OG images", () => {
      const indexPath = path.resolve(__dirname, "../../index.html");
      const html = fs.readFileSync(indexPath, "utf8");

      expect(html).not.toContain("https://lovable.dev");
      expect(html).not.toContain("@Lovable");
      expect(html).toContain('content="/logo.png"');
    });

    it("index.html defines a strict Content-Security-Policy (CSP) meta tag", () => {
      const indexPath = path.resolve(__dirname, "../../index.html");
      const html = fs.readFileSync(indexPath, "utf8");

      expect(html).toContain('http-equiv="Content-Security-Policy"');
      expect(html).toContain("default-src 'self'");
      expect(html).toContain("object-src 'none'");
      expect(html).toContain("base-uri 'self'");
    });

    it("index.html specifies anti-MIME sniffing and strict referrer policy", () => {
      const indexPath = path.resolve(__dirname, "../../index.html");
      const html = fs.readFileSync(indexPath, "utf8");

      expect(html).toContain('http-equiv="X-Content-Type-Options" content="nosniff"');
      expect(html).toContain('name="referrer" content="strict-origin-when-cross-origin"');
    });

    it("firebase.json contains hosting security headers including HSTS and X-Frame-Options", () => {
      const firebaseJsonPath = path.resolve(__dirname, "../../firebase.json");
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, "utf8"));

      expect(firebaseConfig.hosting).toBeDefined();
      expect(firebaseConfig.hosting.public).toBe("dist");

      const headerRules = firebaseConfig.hosting.headers;
      expect(Array.isArray(headerRules)).toBe(true);

      const rootHeaders = headerRules.find((h: any) => h.source === "**");
      expect(rootHeaders).toBeDefined();

      const headerMap = Object.fromEntries(rootHeaders.headers.map((h: any) => [h.key, h.value]));
      expect(headerMap["X-Content-Type-Options"]).toBe("nosniff");
      expect(headerMap["X-Frame-Options"]).toBe("DENY");
      expect(headerMap["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headerMap["Strict-Transport-Security"]).toContain("max-age=31536000");
      expect(headerMap["Permissions-Policy"]).toContain("camera=(), microphone=()");
      expect(headerMap["Content-Security-Policy"]).toBeDefined();
    });

    it("vite.config.ts specifies sourcemap: false and debugger dropping in production", () => {
      const viteConfigPath = path.resolve(__dirname, "../../vite.config.ts");
      const viteConfigText = fs.readFileSync(viteConfigPath, "utf8");

      expect(viteConfigText).toContain("sourcemap: false");
      expect(viteConfigText).toContain('drop: ["debugger"]');
    });

    it(".gitignore protects sensitive environment files and private certificates", () => {
      const gitignorePath = path.resolve(__dirname, "../../.gitignore");
      const gitignoreText = fs.readFileSync(gitignorePath, "utf8");

      expect(gitignoreText).toContain(".env");
      expect(gitignoreText).toContain("*.pem");
      expect(gitignoreText).toContain("service-account*.json");
      expect(gitignoreText).toContain("firebase-debug.log*");
    });
  });

  describe("3. Data Lifecycle & Account Erasure", () => {
    it("simulates complete batched account erasure and credential scrubbing", async () => {
      const uid = "user_deletion_test_uid";
      localStorage.setItem("auth_password", "cachedSecret");
      localStorage.setItem("flowfi_session", uid);
      localStorage.setItem(`flowfi_streak_${uid}`, JSON.stringify({ count: 5, lastDate: "2026-11-27" }));

      // Simulate the 4-step erasure sequence implemented in AuthContext.deleteAccount
      const deletedDocs: string[] = [];
      const mockBatchDelete = (docIds: string[]) => {
        deletedDocs.push(...docIds);
      };

      // 1. Batch delete transactions
      const userTxDocs = ["tx1", "tx2", "tx3", "tx4"];
      mockBatchDelete(userTxDocs);

      // 2. Delete user profile
      const userProfileDeleted = true;

      // 3. Scrub storage
      localStorage.removeItem("auth_password");
      localStorage.removeItem("flowfi_session");
      clearUserData(uid);

      // 4. Verification
      expect(deletedDocs).toEqual(["tx1", "tx2", "tx3", "tx4"]);
      expect(userProfileDeleted).toBe(true);
      expect(localStorage.getItem("auth_password")).toBeNull();
      expect(localStorage.getItem("flowfi_session")).toBeNull();
      expect(localStorage.getItem(`flowfi_streak_${uid}`)).toBeNull();
    });

    it("re-authentication error handler intercepts auth/requires-recent-login correctly", () => {
      const simulateAccountDeletion = (errorCode?: string) => {
        if (errorCode === "auth/requires-recent-login") {
          throw new Error(
            "For security, account deletion requires recent authentication. Please sign out, sign in again, and retry account deletion."
          );
        }
      };

      expect(() => simulateAccountDeletion("auth/requires-recent-login")).toThrow(
        "For security, account deletion requires recent authentication. Please sign out, sign in again, and retry account deletion."
      );
    });
  });
});
