import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1"; // Explicitly use v1
import { runMatching } from "./runMatching";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Firestore trigger (v1)
export const onNewPendingItem = functions
  .region("asia-southeast1")
  .firestore.document("items/{itemId}")
  .onCreate(async (snapshot, context) => {
    const newItem = snapshot.data();
    const itemId = context.params.itemId;

    if (!newItem) return;

    const statusRef = newItem.status;
    if (!statusRef?.path) return;

    try {
      const statusDoc = await db.doc(statusRef.path).get();
      const statusName = statusDoc.exists ? statusDoc.data()?.status_name : "unknown";
      if (statusName?.toLowerCase() !== "pending") return;

      console.log(`🆕 New pending item detected: ${newItem.item_name} (ID: ${itemId})`);
      await runMatching({ ...newItem, item_id: itemId });
      console.log("✅ Matching process complete.");
    } catch (error) {
      console.error("❌ Error in onNewPendingItem:", error);
    }
  });

// HTTP trigger (v1)
export const triggerAI = functions
  .region("asia-southeast1")
  .https.onRequest(async (req, res) => {
    try {
      const newItem = req.body;
      if (!newItem || !newItem.item_id || !newItem.status?.path) {
        res.status(400).send({ success: false, error: "Invalid item data" });
      }

      console.log(`🌐 HTTP trigger received for item: ${newItem.item_name} (ID: ${newItem.item_id})`);
      await runMatching(newItem);

      res.status(200).send({ success: true, message: "AI triggered successfully" });
    } catch (err) {
      console.error("❌ Error triggering AI:", err);
      res.status(500).send({ success: false, error: "AI processing failed" });
    }
  });
