import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import fetch from "node-fetch";

// =========================
// INITIAL SETUP
// =========================
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
const messaging = admin.messaging();

const PENDING_STATUS_REF = db.doc("status/Status1");
const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD || 70);

// --- API Keys ---
const JINA_API_KEY =
  process.env.JINA_API_KEY || functions.config().jina?.api_key || "";
const HF_TOKEN =
  process.env.HF_TOKEN || functions.config().huggingface?.token || "";

// --- Embedding Models ---
const TEXT_MODEL =
  "https://api-inference.huggingface.co/models/intfloat/multilingual-e5-large";
const IMAGE_MODEL = "jina-clip-v1";

// Helper to create document references
function getStatusRef(statusPath: string): FirebaseFirestore.DocumentReference {
  return db.doc(statusPath);
}

// =========================
// TRIGGER FUNCTION (Firebase Functions v2)
// =========================
export const onNewPendingItem = functions.firestore.onDocumentCreated(
  "items/{itemId}",
  async (event) => {
    const snap = event.data;
    const itemId = event.params.itemId;
    
    if (!snap) return;
    
    const newItem = snap.data() as any;

    console.log(`🆕 New pending item detected: ${newItem.item_name} (ID: ${itemId})`);

    // Add docRef to the item data for use in runMatching
    newItem.docRef = snap.ref;
    newItem.docId = itemId;

    await runMatching(newItem);
  }
);

// =========================
// SEND NOTIFICATION
// =========================
async function sendMatchNotification(userId: string, matchData: any, itemType: string) {
  try {
    // Get user document to retrieve FCM token
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.warn(`⚠️ User ${userId} not found`);
      return;
    }

    const fcmToken = userDoc.data()?.fcmToken;
    if (!fcmToken) {
      console.warn(`⚠️ No FCM token for user ${userId}`);
      return;
    }

    // Determine which item is the user's item
    const userItem = itemType === "Found" ? matchData.foundItem : matchData.lostItem;
    const matchedItem = itemType === "Found" ? matchData.lostItem : matchData.foundItem;

    const title = `Your item "${userItem.item_name}" has been matched!`;
    const body = `Confidence: ${matchData.confidence}%`;

    // Send push notification
    await messaging.send({
      notification: {
        title,
        body,
      },
      data: {
        matchId: matchData.matchId,
        confidence: matchData.confidence.toString(),
        accuracyLevel: matchData.accuracyLevel,
        userItemName: userItem.item_name,
        matchedItemName: matchedItem.item_name,
        userItemDescription: userItem.description || "",
        matchedItemDescription: matchedItem.description || "",
        textSimilarity: matchData.textSimilarity?.toString() || "0",
        imageSimilarity: matchData.imageSimilarity?.toString() || "0",
        metadataSimilarity: matchData.metadataSimilarity?.toString() || "0",
      },
      token: fcmToken,
    });

    // Save notification to Firestore
    await db.collection("notifications").add({
      userId,
      type: "match",
      title,
      body,
      matchId: matchData.matchId,
      matchData: {
        confidence: matchData.confidence,
        accuracyLevel: matchData.accuracyLevel,
        lostItemId: matchData.lostItemId,
        foundItemId: matchData.foundItemId,
        lostItem: matchData.lostItem,
        foundItem: matchData.foundItem,
        textSimilarity: matchData.textSimilarity,
        imageSimilarity: matchData.imageSimilarity,
        metadataSimilarity: matchData.metadataSimilarity,
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✉️ Notification sent to user ${userId}`);
  } catch (err) {
    console.error("❌ Error sending notification:", err);
  }
}

// =========================
// ACCURACY LEVEL HELPER
// =========================
function getAccuracyLevel(confidence: number): string {
  if (confidence >= 90) {
    return "highly accurate";
  } else if (confidence >= 80) {
    return "accurate";
  } else if (confidence >= 70) {
    return "moderate";
  } else if (confidence >= 50) {
    return "low similarity";
  }
  return "no match";
}

// =========================
// TEXT PREPROCESSING
// =========================
function preprocessText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// =========================
// METADATA SIMILARITY SCORING
// =========================
function calculateMetadataSimilarity(item1: any, item2: any): number {
  let totalScore = 0;
  let maxScore = 0;

  // Category exact match (25 points)
  maxScore += 25;
  if (item1.category === item2.category) {
    totalScore += 25;
  }

  // Color match (15 points)
  if (item1.color && item2.color) {
    maxScore += 15;
    if (preprocessText(item1.color) === preprocessText(item2.color)) {
      totalScore += 15;
    }
  }

  // Size/Brand match (10 points)
  if (item1.size && item2.size) {
    maxScore += 10;
    if (preprocessText(item1.size) === preprocessText(item2.size)) {
      totalScore += 10;
    }
  }

  // Location match (20 points)
  if (item1.location && item2.location) {
    maxScore += 20;
    const loc1 = preprocessText(item1.location);
    const loc2 = preprocessText(item2.location);
    if (loc1 === loc2) {
      totalScore += 20;
    } else if (loc1.split(" ").some(w => loc2.includes(w))) {
      totalScore += 10;
    }
  }

  // Time proximity (15 points)
  if (item1.created_at && item2.created_at) {
    maxScore += 15;
    const time1 = item1.created_at?.toDate?.() || new Date(item1.created_at);
    const time2 = item2.created_at?.toDate?.() || new Date(item2.created_at);
    const daysDiff = Math.abs((time1 - time2) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 7) {
      totalScore += 15;
    } else if (daysDiff <= 14) {
      totalScore += 10;
    } else if (daysDiff <= 30) {
      totalScore += 5;
    }
  }

  return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
}

// =========================
// TEXT EMBEDDING
// =========================
async function getTextEmbedding(item: any, itemId?: string, forceRefresh = true): Promise<number[]> {
  const text = `${item.item_name || ""} ${item.description || ""} ${item.location || ""} ${item.color || ""} ${item.size || ""}`.trim();
  if (!text) return [];

  if (!forceRefresh && item.text_embedding?.length) return item.text_embedding;

  try {
    console.log("🧠 Fetching Hugging Face text embedding...");
    const res = await fetch(TEXT_MODEL, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text }),
    });

    const data = await res.json();
    const embedding = Array.isArray(data[0]) ? data[0] : data;

    if (Array.isArray(embedding)) {
      const id = item.item_id || itemId;
      if (id) await db.collection("items").doc(id).update({ text_embedding: embedding });
      return embedding;
    }

    console.warn("⚠️ Unexpected text embedding format:", data);
    return [];
  } catch (err) {
    console.error("❌ Text embedding error:", err);
    return [];
  }
}

// =========================
// IMAGE EMBEDDING
// =========================
async function getImageEmbedding(imagePathOrUrl: string, itemId?: string, skip = false): Promise<number[]> {
  if (!imagePathOrUrl || skip) return [];

  let imageUrl = imagePathOrUrl;

  if (!imageUrl.startsWith("http")) {
    try {
      const [signedUrl] = await bucket.file(imageUrl).getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000,
      });
      imageUrl = signedUrl;
    } catch (err) {
      console.warn("⚠️ Failed to sign URL:", err);
      return [];
    }
  }

  try {
    console.log("🧩 Fetching Jina image embedding...");
    const res = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${JINA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: IMAGE_MODEL, input: [imageUrl] }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Jina API error:", res.status, text);
      return [];
    }

    const data = await res.json();
    const embedding = data?.data?.[0]?.embedding;
    if (Array.isArray(embedding) && itemId) {
      await db.collection("items").doc(itemId).update({ image_embedding: embedding });
      return embedding;
    }

    return Array.isArray(embedding) ? embedding : [];
  } catch (err) {
    console.error("❌ Image embedding fetch error:", err);
    return [];
  }
}

// =========================
// COSINE SIMILARITY
// =========================
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return !normA || !normB ? 0 : dot / (normA * normB);
}

// =========================
// MAIN MATCHING FUNCTION
// =========================
export async function runMatching(newItem?: any) {
  if (!newItem || newItem.status?.path !== PENDING_STATUS_REF.path) return;

  const isFound = newItem.type === "Found";
  const oppositeType = isFound ? "Lost" : "Found";
  const docRef = newItem.docRef as FirebaseFirestore.DocumentReference;
  const docId = newItem.docId as string;

  console.log(`🔍 Running AI match for new ${newItem.type}: ${newItem.item_name}`);

  const oppositeSnap = await db
    .collection("items")
    .where("type", "==", oppositeType)
    .where("category", "==", newItem.category)
    .where("status", "==", PENDING_STATUS_REF)
    .get();

  if (oppositeSnap.empty) {
    console.log("❌ No opposite items found in same category.");
    return;
  }

  const textEmbedding = await getTextEmbedding(newItem, docId, true);
  const imageEmbedding = await getImageEmbedding(newItem.image_url, docId, false);

  if (!textEmbedding.length) {
    console.warn("⚠️ No text embedding for new item, skipping match.");
    return;
  }

  const batch = db.batch();
  let matchCount = 0;
  let belowThresholdCount = 0;
  const notificationsToSend: Array<{ userId: string; matchData: any; itemType: string }> = [];

  await Promise.all(
    oppositeSnap.docs.map(async (doc) => {
      const otherItem = doc.data();
      const otherId = doc.id;

      const existingMatch = await db
        .collection("ai_matches")
        .where(isFound ? "foundItemId" : "lostItemId", "==", docId)
        .where(isFound ? "lostItemId" : "foundItemId", "==", otherId)
        .get();
      if (!existingMatch.empty) return;

      const otherTextEmbedding = await getTextEmbedding(otherItem, otherId, true);
      const otherImageEmbedding = await getImageEmbedding(otherItem.image_url, otherId, false);

      // Calculate similarities
      const textSim = cosineSimilarity(textEmbedding, otherTextEmbedding);
      const imageSim = cosineSimilarity(imageEmbedding, otherImageEmbedding);
      const metadataSim = calculateMetadataSimilarity(newItem, otherItem) / 100;

      // Smart weighting: if images exist and are similar, increase image weight
      let textWeight = 0.6;
      let imageWeight = 0.2;
      let metadataWeight = 0.2;

      // If both items have strong image embeddings, increase image weight
      if (imageEmbedding.length > 100 && otherImageEmbedding.length > 100) {
        if (imageSim > 0.7) {
          imageWeight = 0.35;
          textWeight = 0.5;
          metadataWeight = 0.15;
        }
      } else {
        // No valid images, rely more on text
        textWeight = 0.75;
        imageWeight = 0;
        metadataWeight = 0.25;
      }

      // Calculate final confidence
      const weightedSim = (textSim * textWeight) + (imageSim * imageWeight) + (metadataSim * metadataWeight);
      const confidence = Math.round(weightedSim * 100);

      console.log(
        `🧮 "${newItem.item_name}" ↔ "${otherItem.item_name}": text=${Math.round(
          textSim * 100
        )}%, image=${Math.round(imageSim * 100)}%, metadata=${Math.round(metadataSim * 100)}%, final=${confidence}%`
      );

      if (confidence < 50) {
        belowThresholdCount++;
        console.log(`⚠️ Match below 50% threshold (${confidence}%), skipping.`);
        return;
      }

      if (confidence >= MATCH_THRESHOLD) {
        const accuracyLevel = getAccuracyLevel(confidence);
        const matchRef = db.collection("ai_matches").doc();
        const matchId = matchRef.id;

        batch.set(matchRef, {
          lostItemId: isFound ? otherId : docId,
          foundItemId: isFound ? docId : otherId,
          lostItem: isFound ? otherItem : newItem,
          foundItem: isFound ? newItem : otherItem,
          confidence,
          accuracyLevel,
          textSimilarity: Math.round(textSim * 100),
          imageSimilarity: Math.round(imageSim * 100),
          metadataSimilarity: Math.round(metadataSim * 100),
          status: getStatusRef("status/Status2"),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update both items' status to Status2 (as reference)
        const status2Ref = getStatusRef("status/Status2");
        
        console.log(`📋 Updating item ${docId} status to Status2`);
        console.log(`📋 Updating item ${otherId} status to Status2`);
        
        batch.update(docRef, { status: status2Ref });
        batch.update(db.collection("items").doc(otherId), { status: status2Ref });

        matchCount++;
        console.log(`✅ Match added with ${accuracyLevel} accuracy (${confidence}%)`);

        // Queue notifications to be sent after batch commit
        const matchDataForNotif = {
          matchId,
          lostItemId: isFound ? otherId : docId,
          foundItemId: isFound ? docId : otherId,
          lostItem: isFound ? otherItem : newItem,
          foundItem: isFound ? newItem : otherItem,
          confidence,
          accuracyLevel,
          textSimilarity: Math.round(textSim * 100),
          imageSimilarity: Math.round(imageSim * 100),
          metadataSimilarity: Math.round(metadataSim * 100),
        };

        // Queue notifications to be sent after batch commit
        if (newItem.userId) {
          notificationsToSend.push({
            userId: newItem.userId,
            matchData: matchDataForNotif,
            itemType: newItem.type,
          });
        }
        if (otherItem.userId) {
          notificationsToSend.push({
            userId: otherItem.userId,
            matchData: matchDataForNotif,
            itemType: oppositeType,
          });
        }
      }
    })
  );

  if (matchCount > 0) {
    try {
      await batch.commit();
      console.log(`🎯 ${matchCount} matches saved to Firebase.`);
      console.log(`📝 Batch commit successful - items should now be Status2`);

      // Send notifications after batch commit
      for (const notif of notificationsToSend) {
        await sendMatchNotification(notif.userId, notif.matchData, notif.itemType);
      }
    } catch (err) {
      console.error("❌ Error committing batch:", err);
      return;
    }
  } else {
    console.log("❌ No valid matches met threshold.");
  }

  if (belowThresholdCount > 0) {
    console.log(`🚫 ${belowThresholdCount} matches were below 50% and not saved.`);
  }

  console.log("✅ Matching process complete.");
}