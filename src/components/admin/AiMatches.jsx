import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

function AiMatches() {
  const [matches, setMatches] = useState([]);
  const [verifiedMatches, setVerifiedMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterVerified, setFilterVerified] = useState(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        // Reference to ai_matches collection
        const matchesRef = collection(db, "ai_matches");

        // Fetch all matches
        const querySnapshot = await getDocs(matchesRef);
        const allMatches = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMatches(allMatches);

        // Fetch verified matches (status reference = /status/Status4)
        const verifiedQuery = query(matchesRef, where("status", "==", "/status/Status4"));
        const verifiedSnapshot = await getDocs(verifiedQuery);
        const verified = verifiedSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setVerifiedMatches(verified);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching Firestore matches:", error);
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  const getConfidenceClass = (confidence) => {
    if (confidence >= 85) return "success";
    if (confidence >= 55) return "warning";
    return "danger";
  };

  const isVerified = (match) => {
    return match.status && typeof match.status === "string" && match.status.includes("Status4");
  };

  const filteredMatches = useMemo(() => {
    if (filterVerified === null) return matches;
    if (filterVerified === true) return verifiedMatches;
    return matches;
  }, [matches, verifiedMatches, filterVerified]);

  if (loading) {
    return (
      <div
        className="container-fluid py-4"
        style={{ backgroundColor: "#fff8e6", minHeight: "100vh" }}
      >
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container-fluid py-4"
      style={{
        backgroundColor: "#fff8e6",
        minHeight: "100vh",
        paddingLeft: "2rem",
        paddingRight: "2rem",
      }}
    >
      {/* Header */}
      <div className="mb-4">
        <h1 className="display-4 fw-bold" style={{ color: "#263054" }}>
          AI Matches Viewer
        </h1>
        <p className="lead text-muted fs-4">
          View all AI-powered item matches and verification status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6">
          <div
            onClick={() => setFilterVerified(null)}
            className="card shadow-sm border-0"
            style={{
              cursor: "pointer",
              transition: "all 0.2s ease",
              backgroundColor: "#fff",
              opacity: filterVerified === null ? 1 : 0.7,
            }}
          >
            <div className="card-body text-center py-4">
              <h6 className="text-muted mb-2">Total Matches</h6>
              <h2 style={{ color: "#263054" }}>{matches.length}</h2>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div
            onClick={() => setFilterVerified(true)}
            className="card shadow-sm border-0"
            style={{
              cursor: "pointer",
              transition: "all 0.2s ease",
              backgroundColor: "#fff",
              opacity: filterVerified === true ? 1 : 0.7,
            }}
          >
            <div className="card-body text-center py-4">
              <h6 className="text-muted mb-2">Verified by Users</h6>
              <h2 style={{ color: "#2e7d32" }}>{verifiedMatches.length}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Matches List */}
      {filteredMatches.length === 0 ? (
        <div className="card shadow-sm border-0">
          <div className="card-body text-center py-5">
            <div style={{ fontSize: "72px", opacity: 0.3 }}>🔍</div>
            <h3 className="text-muted mt-3">No verified matches found</h3>
            <p className="text-muted">Check back later for verified matches</p>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {filteredMatches.map((match) => (
            <div key={match.id} className="col-12">
              <div
                className="card shadow-sm border-0"
                style={{ overflow: "hidden" }}
              >
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h5
                        className="card-title mb-1 fw-bold"
                        style={{ color: "#263054" }}
                      >
                        Match #{match.id.substring(0, 8)}
                      </h5>
                      <small className="text-muted">
                        Created:{" "}
                        {match.createdAt?.toDate
                          ? match.createdAt.toDate().toLocaleString()
                          : "Unknown"}
                      </small>
                    </div>
                    <div className="d-flex gap-2 align-items-center">
                      <span
                        className={`badge bg-${getConfidenceClass(
                          match.confidence
                        )} px-3 py-2 fs-6`}
                      >
                        {match.confidence}% Match
                      </span>
                      <span
                        className={`badge ${
                          isVerified(match)
                            ? "bg-success"
                            : "bg-secondary"
                        } px-3 py-2`}
                      >
                        {isVerified(match) ? "✓ Verified" : "⏳ Pending"}
                      </span>
                    </div>
                  </div>

                  {/* Items Comparison */}
                  <div className="row g-4">
                    {/* Lost Item */}
                    <div className="col-12 col-lg-5">
                      <div
                        className="h-100 p-3 rounded"
                        style={{ backgroundColor: "#fff8e6" }}
                      >
                        <h6 className="text-danger fw-bold mb-3">
                          <span className="badge bg-danger me-2">LOST</span>
                          {match.lostItem?.item_name || "Unknown Item"}
                        </h6>
                        <img
                          src={
                            match.lostItem?.image_url ||
                            "https://via.placeholder.com/400x300?text=No+Image"
                          }
                          alt={match.lostItem?.item_name}
                          className="w-100 rounded mb-3"
                          style={{ height: "250px", objectFit: "cover" }}
                        />
                        <p className="text-muted mb-2">
                          <strong>Description:</strong>{" "}
                          {match.lostItem?.description ||
                            "No description available"}
                        </p>
                        {match.lostItem?.userId && (
                          <p className="text-muted mb-0">
                            <strong>User ID:</strong> {match.lostItem.userId}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="col-12 col-lg-2 d-flex align-items-center justify-content-center">
                      <div className="text-center">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                          style={{
                            width: "80px",
                            height: "80px",
                            background:
                              "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            color: "white",
                            fontSize: "24px",
                          }}
                        >
                          ≈
                        </div>
                      </div>
                    </div>

                    {/* Found Item */}
                    <div className="col-12 col-lg-5">
                      <div
                        className="h-100 p-3 rounded"
                        style={{ backgroundColor: "#e8f5e9" }}
                      >
                        <h6 className="text-success fw-bold mb-3">
                          <span className="badge bg-success me-2">FOUND</span>
                          {match.foundItem?.item_name || "Unknown Item"}
                        </h6>
                        <img
                          src={
                            match.foundItem?.image_url ||
                            "https://via.placeholder.com/400x300?text=No+Image"
                          }
                          alt={match.foundItem?.item_name}
                          className="w-100 rounded mb-3"
                          style={{ height: "250px", objectFit: "cover" }}
                        />
                        <p className="text-muted mb-2">
                          <strong>Description:</strong>{" "}
                          {match.foundItem?.description ||
                            "No description available"}
                        </p>
                        {match.foundItem?.userId && (
                          <p className="text-muted mb-0">
                            <strong>User ID:</strong> {match.foundItem.userId}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Match Details Footer */}
                  <div className="mt-4 pt-3 border-top">
                    <div className="row">
                      <div className="col-12 col-md-6">
                        <small className="text-muted">
                          <strong>Match ID:</strong> {match.id}
                        </small>
                      </div>
                      <div className="col-12 col-md-6 text-end">
                        {isVerified(match) && (
                          <small className="text-success">
                            <strong>✓ User verified this match</strong>
                          </small>
                        )}
                      </div>
                    </div>
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
