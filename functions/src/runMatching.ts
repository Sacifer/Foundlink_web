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
  if (item1.createdAt && item2.createdAt) {
    maxScore += 15;
    const time1 = item1.createdAt?.toDate?.() || new Date(item1.createdAt);
    const time2 = item2.createdAt?.toDate?.() || new Date(item2.createdAt);
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
// LOG NOTIFICATIONS TO DATABASE
// =========================
async function logNotificationToDatabase(
  lostUserId: string,
  foundUserId: string,
  lostItem: any,
  foundItem: any,
  lostItemId: string,
  foundItemId: string,
  confidence: number,
  accuracyLevel: string
): Promise<void> {
  try {
    // Notification for lost item owner
    await db.collection("notifications").add({
      userId: lostUserId,
      type: "match",
      title: "🎉 Potential Match Found!",
      body: `We found a "${foundItem.item_name}" that might be your lost "${lostItem.item_name}"`,
      lostItemId,
      foundItemId,
      confidence,
      accuracyLevel,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Notification saved for lost item owner (${lostUserId})`);

    // Notification for found item owner
    await db.collection("notifications").add({
      userId: foundUserId,
      type: "match",
      title: "🎉 Potential Match Found!",
      body: `Someone is looking for a "${lostItem.item_name}" that matches your found "${foundItem.item_name}"`,
      lostItemId,
      foundItemId,
      confidence,
      accuracyLevel,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Notification saved for found item owner (${foundUserId})`);
  } catch (err) {
    console.error("❌ Error logging notification to database:", err);
  }
}

// =========================
// MAIN MATCHING FUNCTION
// =========================
export async function runMatching(newItem?: any) {
  if (!newItem || newItem.status?.path !== PENDING_STATUS_REF.path) return;

  const isFound = newItem.type === "Found";
  const oppositeType = isFound ? "Lost" : "Found";

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

  const textEmbedding = await getTextEmbedding(newItem, newItem.item_id, true);
  const imageEmbedding = await getImageEmbedding(newItem.image_url, newItem.item_id, false);

  if (!textEmbedding.length) {
    console.warn("⚠️ No text embedding for new item, skipping match.");
    return;
  }

  const batch = db.batch();
  let matchCount = 0;
  let belowThresholdCount = 0;

  await Promise.all(
    oppositeSnap.docs.map(async (doc) => {
      const otherItem = doc.data();
      const otherId = doc.id;

      const existingMatch = await db
        .collection("ai_matches")
        .where(isFound ? "foundItemId" : "lostItemId", "==", newItem.item_id)
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
        const matchedStatusRef = db.doc("status/Status2");
        
        const lostItemDocId = isFound ? otherId : (newItem.item_id || newItem.itemId);
        const foundItemDocId = isFound ? (newItem.item_id || newItem.itemId) : otherId;
        
        // Save match to ai_matches with Matched status
        batch.set(matchRef, {
          lostItemId: lostItemDocId,
          foundItemId: foundItemDocId,
          lostItem: isFound ? otherItem : newItem,
          foundItem: isFound ? newItem : otherItem,
          confidence,
          accuracyLevel,
          textSimilarity: Math.round(textSim * 100),
          imageSimilarity: Math.round(imageSim * 100),
          metadataSimilarity: Math.round(metadataSim * 100),
          status: matchedStatusRef,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Update status for both items to "Matched" AFTER match is created
        batch.update(db.collection("items").doc(lostItemDocId), { status: matchedStatusRef });
        batch.update(db.collection("items").doc(foundItemDocId), { status: matchedStatusRef });
        
        matchCount++;
        console.log(`✅ Match added with ${accuracyLevel} accuracy (${confidence}%)`);
        console.log(`📝 Status will be updated to "Matched" for both items`);

        // Log notifications to database for both users
        const lostUserId = isFound ? otherItem.userId : newItem.userId;
        const foundUserId = isFound ? newItem.userId : otherItem.userId;
        await logNotificationToDatabase(
          lostUserId,
          foundUserId,
          isFound ? otherItem : newItem,
          isFound ? newItem : otherItem,
          lostItemDocId,
          foundItemDocId,
          confidence,
          accuracyLevel
        );
      }
    })
  );

  if (matchCount > 0) {
    await batch.commit();
    console.log(`🎯 ${matchCount} matches saved to Firebase.`);
  } else {
    console.log("❌ No valid matches met threshold.");
  }

  if (belowThresholdCount > 0) {
    console.log(`🚫 ${belowThresholdCount} matches were below 50% and not saved.`);
  }

  console.log("✅ Matching process complete.");
}