import * as admin from "firebase-admin";
import * as functions from "firebase-functions"; // v1
import { runMatching } from "./runMatching";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Firestore trigger v1, Asia Southeast region
export const onNewPendingItem = functions
  .region("asia-southeast1") // ✅ deploy to Asia Southeast
  .firestore.document("items/{itemId}")
  .onCreate(async (snapshot, context) => {
    const newItem = snapshot.data();
    const itemId = context.params.itemId;

    if (!newItem) {
      console.log("⚠️ No item data found.");
      return;
    }

    const statusRef = newItem.status;

    if (!statusRef?.path) {
      console.log("⚠️ No status reference found, skipping.");
      return;
    }

    try {
      const statusDoc = await db.doc(statusRef.path).get();
      const statusName = statusDoc.exists
        ? statusDoc.data()?.status_name
        : "unknown";

      if (statusName?.toLowerCase() !== "pending") {
        console.log(`⏭️ Skipping — status is ${statusName}`);
        return;
      }

      console.log(
        `🆕 New pending item detected: ${newItem.item_name} (ID: ${itemId})`
      );
      console.log("🤖 Running Hugging Face AI matching...");

      await runMatching({ ...newItem, item_id: itemId });

      console.log("✅ Matching process complete.");
    } catch (error) {
      console.error("❌ Error in onNewPendingItem:", error);
    }
  });
