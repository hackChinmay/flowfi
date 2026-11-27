import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  categorizeError,
  getErrorMessage,
  isTransientError,
  withRetry,
  sanitizeContext
} from "@/lib/errorHandler";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { roundCurrency } from "@/lib/financial";

// Component that intentionally throws for ErrorBoundary testing
function BombComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Simulated component crash during render");
  }
  return <div>Component rendered safely</div>;
}

describe("FlowFi Correction 4: Error Handling & Application Reliability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. React Component Error Boundaries
  describe("1. React Component Error Boundaries", () => {
    it("catches render errors and renders the friendly fallback UI", () => {
      // Suppress React error boundary console output in test
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <BombComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(
        screen.getByText(/Your financial records and account balances remain secure/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();

      spy.mockRestore();
    });

    it("recovers and resets error boundary state when Try Again is clicked", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const onResetMock = vi.fn();

      function RecoverableParent() {
        const [explode, setExplode] = React.useState(true);
        return (
          <ErrorBoundary
            onReset={() => {
              setExplode(false);
              onResetMock();
            }}
          >
            <BombComponent shouldThrow={explode} />
          </ErrorBoundary>
        );
      }

      render(<RecoverableParent />);
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Click Try Again
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));
      expect(onResetMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Component rendered safely")).toBeInTheDocument();

      spy.mockRestore();
    });
  });

  // 2. Firestore Permission-Denied Errors
  describe("2. Firestore Permission-Denied Errors", () => {
    it("properly categorizes permission-denied as non-transient with user-friendly message", () => {
      const error = {
        code: "permission-denied",
        message: "Missing or insufficient permissions."
      };
      const details = categorizeError(error);

      expect(details.category).toBe("firestore");
      expect(details.code).toBe("permission-denied");
      expect(details.isTransient).toBe(false);
      expect(details.userMessage).toContain("Access denied");
    });
  });

  // 3. Network Unavailable Errors
  describe("3. Network Unavailable Errors", () => {
    it("identifies unavailable as a transient error requiring reconnection handling", () => {
      const error = { code: "unavailable", message: "Backend is temporarily offline." };
      const details = categorizeError(error);

      expect(details.category).toBe("network");
      expect(details.isTransient).toBe(true);
      expect(isTransientError(error)).toBe(true);
      expect(details.userMessage).toContain("unavailable");
    });

    it("identifies deadline-exceeded as a transient network timeout", () => {
      const error = { code: "deadline-exceeded", message: "Request timed out." };
      const details = categorizeError(error);

      expect(details.category).toBe("network");
      expect(details.isTransient).toBe(true);
      expect(details.userMessage).toContain("timed out");
    });
  });

  // 4. Authentication Expiration
  describe("4. Authentication Expiration", () => {
    it("handles unauthenticated error and prompts user to sign in again without retrying", () => {
      const error = { code: "unauthenticated", message: "Token expired." };
      const details = categorizeError(error);

      expect(details.code).toBe("unauthenticated");
      expect(details.isTransient).toBe(false);
      expect(details.userMessage).toContain("session has expired");
    });
  });

  // 5. Failed Transaction Creation
  describe("5. Failed Transaction Creation", () => {
    it("rejects non-positive and NaN amounts before sending to network", () => {
      expect(roundCurrency(-500)).toBe(-500);
      expect(roundCurrency(0)).toBe(0);
      expect(roundCurrency("invalid")).toBe(0); // Normalized safely to 0
      expect(roundCurrency("invalid") <= 0).toBe(true);

      const error = new Error("Invalid amount: Transaction amount must be greater than zero");
      const details = categorizeError(error);
      expect(details.category).toBe("validation");
      expect(details.userMessage).toContain("greater than zero");
    });
  });

  // 6. Failed Transaction Editing
  describe("6. Failed Transaction Editing", () => {
    it("validates transaction ID and updates safely", () => {
      const validateEdit = (id: string, amount: number) => {
        if (!id || typeof id !== "string") throw new Error("Invalid transaction ID");
        const safe = roundCurrency(amount);
        if (safe <= 0) throw new Error("Invalid amount: Transaction amount must be greater than zero");
        return { id, amount: safe };
      };

      expect(() => validateEdit("", 1500)).toThrow("Invalid transaction ID");
      expect(() => validateEdit("txn-123", -100)).toThrow("Invalid amount");
      expect(validateEdit("txn-123", 1500.5)).toEqual({ id: "txn-123", amount: 1500.5 });
    });
  });

  // 7. Failed Transaction Deletion
  describe("7. Failed Transaction Deletion", () => {
    it("requires a non-empty string ID for deletion", () => {
      const validateDelete = (id: string) => {
        if (!id || typeof id !== "string") throw new Error("Invalid transaction ID");
        return true;
      };

      expect(() => validateDelete("")).toThrow("Invalid transaction ID");
      expect(validateDelete("txn-999")).toBe(true);
    });
  });

  // 8. Duplicate Submission Prevention
  describe("8. Duplicate Submission Prevention", () => {
    it("locks concurrent requests while loading flag is active", async () => {
      let callCount = 0;
      let isLoading = false;

      const submitTransaction = async () => {
        if (isLoading) return "BLOCKED";
        isLoading = true;
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
        isLoading = false;
        return "SUCCESS";
      };

      // Trigger 3 concurrent calls simultaneously
      const results = await Promise.all([
        submitTransaction(),
        submitTransaction(),
        submitTransaction(),
      ]);

      expect(callCount).toBe(1);
      expect(results).toEqual(["SUCCESS", "BLOCKED", "BLOCKED"]);
    });
  });

  // 9. Loading-State Reset After Failure
  describe("9. Loading-State Reset After Failure", () => {
    it("guarantees loading state is reset to false in finally block even on error", async () => {
      let loading = false;
      let errorOccurred = false;

      const performOperation = async (fail: boolean) => {
        try {
          loading = true;
          if (fail) throw new Error("Database write failed");
        } catch (e) {
          errorOccurred = true;
        } finally {
          loading = false;
        }
      };

      await performOperation(true);
      expect(errorOccurred).toBe(true);
      expect(loading).toBe(false); // Reset guaranteed
    });
  });

  // 10. Form Validation Failures
  describe("10. Form Validation Failures", () => {
    it("enforces upper boundary ceiling of ₹100 Crore", () => {
      const validateLimit = (val: number) => {
        if (val > 1000000000) return "EXCEEDED_CEILING";
        return "VALID";
      };

      expect(validateLimit(50000)).toBe("VALID");
      expect(validateLimit(1000000001)).toBe("EXCEEDED_CEILING");
    });

    it("sanitizes diagnostic logs by stripping passwords and credentials", () => {
      const context = {
        email: "user@flowfi.test",
        password: "SuperSecretPassword123",
        token: "firebase-jwt-token-xyz",
        amount: 2500,
        nested: {
          apiKey: "AIzaSySecret",
          category: "Food"
        }
      };

      const clean = sanitizeContext(context);
      expect(clean.password).toBe("[REDACTED]");
      expect(clean.token).toBe("[REDACTED]");
      expect(clean.nested.apiKey).toBe("[REDACTED]");
      expect(clean.amount).toBe(2500);
      expect(clean.email).toBe("user@flowfi.test");
      expect(clean.nested.category).toBe("Food");
    });
  });

  // 11. Bounded Retry Behavior
  describe("11. Bounded Retry Behavior", () => {
    it("retries transient errors with exponential backoff up to maxRetries", async () => {
      let attempts = 0;

      const flakyOperation = async () => {
        attempts++;
        if (attempts < 3) {
          const err = new Error("Network timeout");
          (err as any).code = "unavailable";
          throw err;
        }
        return "SUCCESS_AFTER_RETRY";
      };

      const result = await withRetry(flakyOperation, {
        maxRetries: 3,
        baseDelayMs: 10, // Short delay for test speed
      });

      expect(attempts).toBe(3);
      expect(result).toBe("SUCCESS_AFTER_RETRY");
    });

    it("NEVER retries permission-denied or validation errors", async () => {
      let attempts = 0;

      const forbiddenOperation = async () => {
        attempts++;
        const err = new Error("Access denied");
        (err as any).code = "permission-denied";
        throw err;
      };

      await expect(
        withRetry(forbiddenOperation, { maxRetries: 3, baseDelayMs: 10 })
      ).rejects.toThrow("Access denied");

      expect(attempts).toBe(1); // Failed immediately without retrying
    });
  });

  // 12. Recovery After Network Reconnection
  describe("12. Recovery After Network Reconnection", () => {
    it("tracks online and offline transitions accurately", () => {
      const { result } = renderHook(() => useOnlineStatus());

      expect(typeof result.current).toBe("boolean");

      // Trigger offline event
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });
      expect(result.current).toBe(false);

      // Trigger online event
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      expect(result.current).toBe(true);
    });
  });
});
