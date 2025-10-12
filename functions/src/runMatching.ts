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
const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD || 50);

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
// TEXT EMBEDDING
// =========================
async function getTextEmbedding(item: any, itemId?: string, forceRefresh = true): Promise<number[]> {
  const text = `${item.item_name || ""} ${item.description || ""} ${item.location || ""}`.trim();
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
// IMAGE EMBEDDING (Optional)
// =========================
async function getImageEmbedding(imagePathOrUrl: string, itemId?: string, skip = true): Promise<number[]> {
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

  console.log(`🔍 Running AI match for new ${newItem.type}: ${newItem.item_name}`);

  const oppositeSnap = await db
    .collection("items")
    .where("type", "==", oppositeType)
    .where("category", "==", newItem.category)
    .where("status", "==", PENDING_STATUS_REF)
    .get();

  if (oppositeSnap.empty) {
    console.log("❌ No opposite items found.");
    return;
  }

  const textEmbedding = await getTextEmbedding(newItem, newItem.item_id, true);
  const imageEmbedding = await getImageEmbedding(newItem.image_url, newItem.item_id, true);

  if (!textEmbedding.length) {
    console.warn("⚠️ No text embedding for new item, skipping match.");
    return;
  }

  const batch = db.batch();
  let matchCount = 0;

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
      const otherImageEmbedding = await getImageEmbedding(otherItem.image_url, otherId, true);

      const textSim = cosineSimilarity(textEmbedding, otherTextEmbedding);
      const imageSim = cosineSimilarity(imageEmbedding, otherImageEmbedding);

      let textWeight = 0.9;
      let imageWeight = 0.1;
      let calibrationFactor = 0.6;

      if (imageEmbedding.length < 100 || otherImageEmbedding.length < 100) imageWeight = 0.05;
      if (textSim < 0.5 && imageSim > 0.8) calibrationFactor = 0.5;

      const totalSim =
        ((textSim * textWeight) + (imageSim * imageWeight)) / (textWeight + imageWeight);
      const confidence = Math.round(totalSim * 100 * calibrationFactor);

      console.log(
        `🧮 "${newItem.item_name}" ↔ "${otherItem.item_name}": text=${Math.round(
          textSim * 100
        )}%, image=${Math.round(imageSim * 100)}%, adjusted=${confidence}%`
      );

      if (confidence >= MATCH_THRESHOLD) {
        const matchRef = db.collection("ai_matches").doc();
        batch.set(matchRef, {
          lostItemId: isFound ? otherId : newItem.item_id,
          foundItemId: isFound ? newItem.item_id : otherId,
          lostItem: isFound ? otherItem : newItem,
          foundItem: isFound ? newItem : otherItem,
          confidence,
          status: PENDING_STATUS_REF,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        matchCount++;
      }
    })
  );

  if (matchCount > 0) {
    await batch.commit();
    console.log(`🎯 ${matchCount} matches saved.`);
  } else {
    console.log("❌ No valid matches met threshold.");
  }
}
