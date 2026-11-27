import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

describe("Firestore Security Rules Emulator Real Authorization Tests", () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = "demo-flowfi-rules-test";
  const rulesPath = path.resolve(__dirname, "../../firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf8");

  beforeAll(async () => {
    // Resolve emulator host from environment (automatically provided by firebase emulators:exec)
    const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

    if (!emulatorHost) {
      console.warn(
        "\n[Notice] FIRESTORE_EMULATOR_HOST is not set. " +
          "Skipping emulator authorization suite during offline runs. Run 'npm run test:rules' to execute against the Firestore emulator.\n"
      );
      return;
    }

    const [host, portStr] = emulatorHost.split(":");
    const port = parseInt(portStr || "8088", 10);

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules: rulesContent,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async (context) => {
    if (!testEnv) {
      context.skip();
      return;
    }

    // Clear data and seed base records using admin context
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      // Seed User A Profile
      await setDoc(doc(adminDb, "users", "user_A"), {
        fullName: "Chinmay Agrawal",
        email: "user_a@flowfi.com",
        photoURL: null,
        gender: "Male",
        profession: "Developer",
        spendingLimit: 10000,
        savingsGoal: 5000,
        savingsGoalName: "Emergency Fund",
        streak: 5,
      });

      // Seed User B Profile
      await setDoc(doc(adminDb, "users", "user_B"), {
        fullName: "Another User",
        email: "user_b@flowfi.com",
        photoURL: null,
        gender: "Female",
        profession: "Designer",
        spendingLimit: 20000,
        savingsGoal: 10000,
        savingsGoalName: "Vacation Fund",
        streak: 2,
      });

      // Seed User A Transaction
      await setDoc(doc(adminDb, "transactions", "txn_a1"), {
        userId: "user_A",
        type: "expense",
        amount: 250,
        category: "Food",
        description: "Lunch at cafe",
        date: "2026-11-27T12:00:00.000Z",
      });

      // Seed User B Transaction
      await setDoc(doc(adminDb, "transactions", "txn_b1"), {
        userId: "user_B",
        type: "income",
        amount: 5000,
        category: "Salary",
        description: "Monthly salary",
        date: "2026-11-27T10:00:00.000Z",
      });
    });
  });

  // 1. Unauthenticated profile read is denied
  it("Case 1: Unauthenticated profile read is denied", async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, "users", "user_A")));
  });

  // 2. User A can read their own profile
  it("Case 2: User A can read their own profile", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertSucceeds(getDoc(doc(userADb, "users", "user_A")));
  });

  // 3. User A cannot read User B's profile
  it("Case 3: User A cannot read User B's profile", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(getDoc(doc(userADb, "users", "user_B")));
  });

  // 4. User A can update permitted fields in their own profile
  it("Case 4: User A can update permitted fields in their own profile", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertSucceeds(
      updateDoc(doc(userADb, "users", "user_A"), {
        spendingLimit: 15000,
        profession: "Entrepreneur",
      })
    );
  });

  // 5. User A cannot modify User B's profile
  it("Case 5: User A cannot modify User B's profile", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(
      updateDoc(doc(userADb, "users", "user_B"), {
        spendingLimit: 99999,
      })
    );
  });

  // 6. User A cannot modify their own email if it is immutable
  it("Case 6: User A cannot modify their own email if it is immutable", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(
      updateDoc(doc(userADb, "users", "user_A"), {
        email: "hijacked@victim.com",
      })
    );
  });

  // 7. User A can create a transaction with their own UID
  it("Case 7: User A can create a transaction with their own UID", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertSucceeds(
      setDoc(doc(userADb, "transactions", "new_txn_a"), {
        userId: "user_A",
        type: "expense",
        amount: 450,
        category: "Transport",
        description: "Metro card recharge",
        date: "2026-11-27T14:30:00.000Z",
      })
    );
  });

  // 8. User A cannot create a transaction using User B's UID
  it("Case 8: User A cannot create a transaction using User B's UID", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(
      setDoc(doc(userADb, "transactions", "fake_txn_b"), {
        userId: "user_B",
        type: "expense",
        amount: 450,
        category: "Food",
        date: "2026-11-27T14:30:00.000Z",
      })
    );
  });

  // 9. User A can read their own transactions
  it("Case 9: User A can read their own transactions", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertSucceeds(getDoc(doc(userADb, "transactions", "txn_a1")));
  });

  // 10. User A cannot read User B's transactions
  it("Case 10: User A cannot read User B's transactions", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(getDoc(doc(userADb, "transactions", "txn_b1")));
  });

  // 11. User A can update their own transaction without changing ownership
  it("Case 11: User A can update their own transaction without changing ownership", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertSucceeds(
      updateDoc(doc(userADb, "transactions", "txn_a1"), {
        amount: 350,
        category: "Transport",
        description: "Updated description",
      })
    );
  });

  // 12. User A cannot change transaction ownership
  it("Case 12: User A cannot change transaction ownership", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(
      updateDoc(doc(userADb, "transactions", "txn_a1"), {
        userId: "user_B",
      })
    );
  });

  // 13. User A cannot delete User B's transaction
  it("Case 13: User A cannot delete User B's transaction", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(deleteDoc(doc(userADb, "transactions", "txn_b1")));
  });

  // 14. Unknown collections are denied
  it("Case 14: Unknown collections are denied by default", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(getDoc(doc(userADb, "internal_admin_audit", "doc1")));
    await assertFails(
      setDoc(doc(userADb, "unmapped_collection", "doc1"), {
        field: "val",
      })
    );
  });

  // 15. Negative and zero amounts are denied
  it("Case 15: Negative and zero amounts are denied", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(
      setDoc(doc(userADb, "transactions", "txn_zero"), {
        userId: "user_A",
        type: "expense",
        amount: 0,
        category: "Food",
      })
    );
    await assertFails(
      setDoc(doc(userADb, "transactions", "txn_neg"), {
        userId: "user_A",
        type: "expense",
        amount: -100,
        category: "Food",
      })
    );
  });

  // 16. Excessive amounts are denied
  it("Case 16: Excessive amounts are denied", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(
      setDoc(doc(userADb, "transactions", "txn_excessive"), {
        userId: "user_A",
        type: "expense",
        amount: 1000000001,
        category: "Food",
      })
    );
  });

  // 17. Invalid transaction categories are denied
  it("Case 17: Invalid transaction categories are denied", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(
      setDoc(doc(userADb, "transactions", "txn_bad_cat"), {
        userId: "user_A",
        type: "expense",
        amount: 50,
        category: "InvalidCategoryEnum",
      })
    );
  });

  // 18. Unauthorized fields such as isAdmin are denied
  it("Case 18: Unauthorized fields such as isAdmin are denied", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertFails(
      setDoc(doc(userADb, "transactions", "txn_extra_fields"), {
        userId: "user_A",
        type: "expense",
        amount: 50,
        category: "Food",
        isAdmin: true,
      })
    );
  });

  // 19. Valid supported date formats are accepted
  it("Case 19: Valid supported date formats (ISO date-time and calendar date) are accepted", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    await assertSucceeds(
      setDoc(doc(userADb, "transactions", "txn_iso_date"), {
        userId: "user_A",
        type: "expense",
        amount: 75,
        category: "Shopping",
        date: "2026-11-27T16:00:00.000Z",
      })
    );
    await assertSucceeds(
      setDoc(doc(userADb, "transactions", "txn_cal_date"), {
        userId: "user_A",
        type: "income",
        amount: 200,
        category: "Gift",
        date: "2026-11-27",
      })
    );
  });

  // 20. Missing required fields are denied
  it("Case 20: Missing required fields are denied", async () => {
    const userADb = testEnv.authenticatedContext("user_A", { email: "user_a@flowfi.com" }).firestore();
    // Missing category
    await assertFails(
      setDoc(doc(userADb, "transactions", "txn_missing_cat"), {
        userId: "user_A",
        type: "expense",
        amount: 100,
      })
    );
    // Missing amount
    await assertFails(
      setDoc(doc(userADb, "transactions", "txn_missing_amount"), {
        userId: "user_A",
        type: "expense",
        category: "Food",
      })
    );
  });
});
