const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Import your existing logic
const { handleNewItem } = require("./onNewPendingItem"); 

// HTTP wrapper function
exports.triggerAI = functions.https.onRequest(async (req, res) => {
  try {
    const data = req.body; // data sent from React
    await handleNewItem(data); // call your existing AI logic

    res.status(200).send({ success: true, message: "AI triggered successfully" });
  } catch (err) {
    console.error("Error triggering AI:", err);
    res.status(500).send({ success: false, error: "AI processing failed" });
  }
});
