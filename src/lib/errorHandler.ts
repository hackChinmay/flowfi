/**
 * FlowFi Centralized Error Handler & Reliability Utilities
 * Provides user-friendly error mapping, sanitized diagnostic logging,
 * and transient-error retry capabilities for fintech operations.
 */

export interface AppErrorDetails {
  code: string;
  category: "auth" | "firestore" | "network" | "validation" | "unknown";
  userMessage: string;
  isTransient: boolean;
}

/**
 * Maps raw Firebase, network, and runtime errors to user-friendly messages and categories.
 */
export function categorizeError(error: unknown): AppErrorDetails {
  if (!error) {
    return {
      code: "unknown",
      category: "unknown",
      userMessage: "An unexpected error occurred. Please try again.",
      isTransient: false,
    };
  }

  const err = error as any;
  const rawCode: string = err.code || "";
  const rawMessage: string = err.message || String(error);

  // 1. Firebase Authentication Errors
  if (rawCode.startsWith("auth/")) {
    switch (rawCode) {
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return {
          code: rawCode,
          category: "auth",
          userMessage: "Invalid email or password. Please check your credentials.",
          isTransient: false,
        };
      case "auth/email-already-in-use":
        return {
          code: rawCode,
          category: "auth",
          userMessage: "This email address is already in use. Please sign in instead.",
          isTransient: false,
        };
      case "auth/weak-password":
        return {
          code: rawCode,
          category: "auth",
          userMessage: "Password is too weak. Please use at least 6 characters.",
          isTransient: false,
        };
      case "auth/invalid-email":
        return {
          code: rawCode,
          category: "auth",
          userMessage: "Please enter a valid email address.",
          isTransient: false,
        };
      case "auth/user-disabled":
        return {
          code: rawCode,
          category: "auth",
          userMessage: "This account has been suspended. Please contact support.",
          isTransient: false,
        };
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return {
          code: rawCode,
          category: "auth",
          userMessage: "Sign-in was cancelled.",
          isTransient: false,
        };
      case "auth/too-many-requests":
        return {
          code: rawCode,
          category: "auth",
          userMessage: "Too many unsuccessful attempts. Please wait a few moments before trying again.",
          isTransient: true,
        };
      case "auth/network-request-failed":
        return {
          code: rawCode,
          category: "network",
          userMessage: "Network connection lost. Please verify your internet and try again.",
          isTransient: true,
        };
      default:
        return {
          code: rawCode,
          category: "auth",
          userMessage: "Authentication failed. Please verify your details and try again.",
          isTransient: false,
        };
    }
  }

  // 2. Cloud Firestore & Database Errors
  if (
    rawCode === "permission-denied" ||
    rawCode === "firestore/permission-denied" ||
    rawMessage.includes("permission-denied") ||
    rawMessage.includes("Missing or insufficient permissions")
  ) {
    return {
      code: "permission-denied",
      category: "firestore",
      userMessage: "Access denied. You do not have permission to view or modify this record.",
      isTransient: false,
    };
  }

  if (rawCode === "unauthenticated" || rawCode === "firestore/unauthenticated") {
    return {
      code: "unauthenticated",
      category: "firestore",
      userMessage: "Your session has expired. Please sign in again.",
      isTransient: false,
    };
  }

  if (rawCode === "unavailable" || rawCode === "firestore/unavailable") {
    return {
      code: "unavailable",
      category: "network",
      userMessage: "Database service is temporarily unavailable. Reconnecting...",
      isTransient: true,
    };
  }

  if (rawCode === "deadline-exceeded" || rawCode === "firestore/deadline-exceeded") {
    return {
      code: "deadline-exceeded",
      category: "network",
      userMessage: "Request timed out. Please check your internet connection.",
      isTransient: true,
    };
  }

  if (rawCode === "resource-exhausted" || rawCode === "firestore/resource-exhausted") {
    return {
      code: "resource-exhausted",
      category: "firestore",
      userMessage: "System rate limit exceeded. Please wait a moment before retrying.",
      isTransient: true,
    };
  }

  if (rawCode === "not-found" || rawCode === "firestore/not-found") {
    return {
      code: "not-found",
      category: "firestore",
      userMessage: "The requested financial record could not be found.",
      isTransient: false,
    };
  }

  if (rawCode === "already-exists" || rawCode === "firestore/already-exists") {
    return {
      code: "already-exists",
      category: "firestore",
      userMessage: "This transaction or record already exists.",
      isTransient: false,
    };
  }

  if (rawCode === "failed-precondition" || rawCode === "firestore/failed-precondition") {
    return {
      code: "failed-precondition",
      category: "firestore",
      userMessage: "Operation cannot be completed in current state. Indexing may be in progress.",
      isTransient: false,
    };
  }

  // 3. Network and Connectivity Errors
  if (
    rawMessage.includes("Failed to fetch") ||
    rawMessage.includes("NetworkError") ||
    rawMessage.includes("network request failed") ||
    rawMessage.includes("offline")
  ) {
    return {
      code: "network-error",
      category: "network",
      userMessage: "You appear to be offline. Financial changes will sync once connection is restored.",
      isTransient: true,
    };
  }

  // 4. Financial & Form Validation Errors
  if (rawMessage.startsWith("Invalid amount") || rawMessage.includes("greater than zero")) {
    return {
      code: "invalid-amount",
      category: "validation",
      userMessage: rawMessage,
      isTransient: false,
    };
  }

  if (rawMessage.startsWith("Unauthorized")) {
    return {
      code: "unauthorized",
      category: "auth",
      userMessage: "You must be signed in to perform this financial operation.",
      isTransient: false,
    };
  }

  // 5. Default Fallback
  return {
    code: rawCode || "general-error",
    category: "unknown",
    userMessage: rawMessage && rawMessage.length < 120 ? rawMessage : "An unexpected error occurred. Please try again.",
    isTransient: false,
  };
}

/**
 * Returns a clean, user-facing error message string.
 */
export function getErrorMessage(error: unknown): string {
  return categorizeError(error).userMessage;
}

/**
 * Checks whether an error is transient (e.g. network disconnect, timeout) and safe to retry.
 * Non-transient errors (permission-denied, invalid-argument, auth failures) must NEVER be retried automatically.
 */
export function isTransientError(error: unknown): boolean {
  return categorizeError(error).isTransient;
}

/**
 * Sanitizes context objects to ensure credentials, passwords, tokens, and PII are never logged.
 */
export function sanitizeContext(context?: Record<string, any>): Record<string, any> {
  if (!context) return {};
  const sanitized: Record<string, any> = {};

  const SENSITIVE_KEYS = [
    "password",
    "token",
    "auth",
    "secret",
    "credential",
    "pin",
    "cvv",
    "key",
    "apiKey",
    "accessToken",
    "pan",
    "ssn",
    "aadhaar",
    "cardnumber",
    "accountnumber",
  ];

  for (const [key, value] of Object.entries(context)) {
    const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
      key.toLowerCase().includes(sensitive.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeContext(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitized diagnostic logger. Excludes sensitive data and stack dumps in production.
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const details = categorizeError(error);
  const cleanContext = sanitizeContext(context);

  // In testing/dev, log categorized diagnostics
  if (typeof console !== "undefined" && console.error) {
    console.error(`[FlowFi ${details.category.toUpperCase()} ERROR]`, {
      code: details.code,
      message: details.userMessage,
      context: cleanContext,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Executes an async operation with bounded exponential backoff retries.
 * Strictly guarantees that non-transient errors (such as permission-denied or validation errors)
 * are NEVER retried.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 400, onRetry } = options;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const isTransient = isTransientError(err);

      // Only retry transient network/timeout errors, up to maxRetries
      if (!isTransient || attempt > maxRetries) {
        throw err;
      }

      if (onRetry) {
        onRetry(attempt, err);
      }

      // Exponential backoff with small random jitter
      const jitter = Math.random() * 100;
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
