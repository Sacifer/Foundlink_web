import React, { useEffect, useState, useMemo } from "react";
import { 
  collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, addDoc, serverTimestamp 
} from "firebase/firestore";
import app, { db } from "../../firebase.js";

const MATCHED_STATUS_ID = "Status2"; // Matched status

function AiMatches() {
  const [matches, setMatches] = useState([]);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, "ai_matches"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatches(data);
    });
    return () => unsubscribe();
  }, []);

  const getConfidenceClass = (confidence) => {
    if (confidence >= 85) return "success";
    if (confidence >= 55) return "warning";
    return "danger";
  };

  // Send notification to user with FULL match data structure
  const sendNotificationToUser = async (userId, match) => {
    try {
      // Send the complete match data as a structured notification
      await addDoc(collection(db, "notifications"), {
        userId: userId,
        type: "match", // Important: mark as match type
        title: "Match Found!",
        matchId: match.id,
        // Include complete match details
        lostItem: {
          item_name: match.lostItem?.item_name || "Unknown",
          description: match.lostItem?.description || "No description",
          image_url: match.lostItem?.image_url || "",
          userId: match.lostItem?.userId || ""
        },
        foundItem: {
          item_name: match.foundItem?.item_name || "Unknown",
          description: match.foundItem?.description || "No description",
          image_url: match.foundItem?.image_url || "",
          userId: match.foundItem?.userId || ""
        },
        lostItemId: match.lostItemId || "",
        foundItemId: match.foundItemId || "",
        confidence: match.confidence || 0,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending notification to user:", error);
    }
  };

  const approveMatch = async (match, isBulk = false) => {
    try {
      const matchRef = doc(db, "ai_matches", match.id);
      const matchedStatusRef = doc(db, "status", MATCHED_STATUS_ID);

      await updateDoc(matchRef, { status: matchedStatusRef });

      // Update items individually and send notification if the item belongs to a user
      if (match.lostItemId && match.lostItem) {
        const lostRef = doc(db, "items", match.lostItemId);
        await updateDoc(lostRef, { status: matchedStatusRef });
        if (match.lostItem.userId) await sendNotificationToUser(match.lostItem.userId, match);
      }

      if (match.foundItemId && match.foundItem) {
        const foundRef = doc(db, "items", match.foundItemId);
        await updateDoc(foundRef, { status: matchedStatusRef });
        if (match.foundItem.userId) await sendNotificationToUser(match.foundItem.userId, match);
      }

      setMatches(prev => prev.filter(m => m.id !== match.id));
      if (!isBulk) showNotification("Match approved and users notified!", "success");
    } catch (error) {
      console.error("Error approving match:", error);
      if (!isBulk) showNotification("Failed to approve match", "danger");
    }
  };

  const rejectMatch = async (matchId, isBulk = false) => {
    try {
      const matchRef = doc(db, "ai_matches", matchId);
      await deleteDoc(matchRef);
      setMatches(prev => prev.filter(m => m.id !== matchId));
      if (!isBulk) showNotification("Match rejected successfully!", "success");
    } catch (error) {
      console.error("Error rejecting match:", error);
      if (!isBulk) showNotification("Failed to reject match", "danger");
    }
  };

  const approveAll = async () => {
    const filteredMatches = matches.filter(
      m => !m.status?.id?.includes(MATCHED_STATUS_ID)
    );
    if (filteredMatches.length === 0) {
      showNotification("No matches to approve", "warning");
      return;
    }
    try {
      await Promise.all(filteredMatches.map(match => approveMatch(match, true)));
      showNotification(`${filteredMatches.length} matches approved and users notified!`, "success");
    } catch (error) {
      console.error(error);
      showNotification("Failed to approve some matches", "danger");
    }
  };

  const rejectAll = async () => {
    const filteredMatches = matches.filter(
      m => !m.status?.id?.includes(MATCHED_STATUS_ID)
    );
    if (filteredMatches.length === 0) {
      showNotification("No matches to reject", "warning");
      return;
    }
    try {
      await Promise.all(filteredMatches.map(match => rejectMatch(match.id, true)));
      showNotification(`${filteredMatches.length} matches rejected!`, "success");
    } catch (error) {
      console.error(error);
      showNotification("Failed to reject some matches", "danger");
    }
  };

  const filteredMatches = useMemo(
    () => matches.filter(m => !m.status?.id?.includes(MATCHED_STATUS_ID)),
    [matches]
  );

  return (
    <div className="container-fluid py-4" style={{ backgroundColor: "#fff8e6", minHeight: "100vh", paddingLeft: "2rem", paddingRight: "2rem" }}>
      {/* Notification Toast */}
      {notification && (
        <div
          className={`position-fixed top-0 end-0 m-3 alert alert-${notification.type} alert-dismissible fade show`}
          role="alert"
          style={{ zIndex: 9999, minWidth: "300px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", animation: "slideInRight 0.3s ease-out" }}
        >
          <strong>{notification.message}</strong>
          <button type="button" className="btn-close" onClick={() => setNotification(null)}></button>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h1 className="display-4 fw-bold" style={{ color: "#263054" }}>AI Suggested Matches</h1>
        <p className="lead text-muted fs-4">Review and manage AI-powered item matches</p>
      </div>

      {/* Controls */}
      <div className="card shadow-sm mb-4 border-0">
        <div className="card-body p-4">
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn btn-success" onClick={approveAll}>
              ✓ Approve All ({filteredMatches.length})
            </button>
            <button className="btn btn-danger" onClick={rejectAll}>
              ✗ Reject All ({filteredMatches.length})
            </button>
          </div>
        </div>
      </div>

      {/* Matches List */}
      {filteredMatches.length === 0 ? (
        <div className="card shadow-sm border-0">
          <div className="card-body text-center py-5">
            <div style={{ fontSize: "72px", opacity: 0.3 }}>🔍</div>
            <h3 className="text-muted mt-3">No AI matches found</h3>
            <p className="text-muted">Check back later for new suggested matches</p>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {filteredMatches.map((match) => (
            <div key={match.id} className="col-12">
              <div className="card shadow-sm border-0" style={{ overflow: "hidden" }}>
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title mb-0 fw-bold" style={{ color: "#263054" }}>
                      Match #{match.id.substring(0, 8)}
                    </h5>
                    <span className={`badge bg-${getConfidenceClass(match.confidence)} px-3 py-2 fs-6`}>
                      {match.confidence}% Match
                    </span>
                  </div>

                  {/* Items Comparison */}
                  <div className="row g-4">
                    {/* Lost Item */}
                    <div className="col-12 col-lg-5">
                      <div className="h-100 p-3 rounded" style={{ backgroundColor: "#fff8e6" }}>
                        <h6 className="text-danger fw-bold mb-3">
                          <span className="badge bg-danger me-2">LOST</span>
                          {match.lostItem?.item_name || "Unknown Item"}
                        </h6>
                        <img
                          src={match.lostItem?.image_url || "https://via.placeholder.com/400x300?text=No+Image"}
                          alt={match.lostItem?.item_name}
                          className="w-100 rounded mb-3"
                          style={{ height: "250px", objectFit: "cover", cursor: "pointer" }}
                        />
                        <p className="text-muted mb-2">{match.lostItem?.description || "No description available"}</p>
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="col-12 col-lg-2 d-flex align-items-center justify-content-center">
                      <div className="text-center">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                          style={{ width: "80px", height: "80px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white", fontSize: "24px" }}
                        >
                          =
                        </div>
                      </div>
                    </div>

                    {/* Found Item */}
                    <div className="col-12 col-lg-5">
                      <div className="h-100 p-3 rounded" style={{ backgroundColor: "#e8f5e9" }}>
                        <h6 className="text-success fw-bold mb-3">
                          <span className="badge bg-success me-2">FOUND</span>
                          {match.foundItem?.item_name || "Unknown Item"}
                        </h6>
                        <img
                          src={match.foundItem?.image_url || "https://via.placeholder.com/400x300?text=No+Image"}
                          alt={match.foundItem?.item_name}
                          className="w-100 rounded mb-3"
                          style={{ height: "250px", objectFit: "cover", cursor: "pointer" }}
                        />
                        <p className="text-muted mb-2">{match.foundItem?.description || "No description available"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="d-flex gap-2 justify-content-end mt-4">
                    <button className="btn btn-success" onClick={() => approveMatch(match)}>✓ Approve Match</button>
                    <button className="btn btn-danger" onClick={() => rejectMatch(match.id)}>✗ Reject Match</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AiMatches;