import React, { useState, useEffect } from "react";
import UserManagement from "./UserManagement";
import ItemManagement from "./ItemManagement";
import AIMatches from "./AiMatches";
import { collection, getDocs, query, where, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";

export default function AdminDashboard() {
  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState({
    users: 0,
    items: 0,
    aiMatches: 0,
    forPickup: 0,
  });

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);


  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const itemsSnapshot = await getDocs(collection(db, "items"));
        const aiSnapshot = await getDocs(collection(db, "ai_matches"));

        console.log("Users count:", usersSnapshot.size);
        console.log("Items count:", itemsSnapshot.size);
        console.log("AI Matches count:", aiSnapshot.size);

        let forPickupCount = 0;

        try {
          const forPickupStatusRef = doc(db, "status", "Status4");
          const forPickupStatusDoc = await getDoc(forPickupStatusRef);
          
          if (forPickupStatusDoc.exists()) {
            const statusName = forPickupStatusDoc.data().status_name;
            console.log("For Pickup Status name:", statusName);

            if (statusName === "For Pickup") {
              const forPickupQuery = query(
                collection(db, "items"),
                where("status", "==", forPickupStatusRef)
              );
              const forPickupSnapshot = await getDocs(forPickupQuery);
              forPickupCount = forPickupSnapshot.size;
              console.log("For Pickup count:", forPickupCount);
            }
          } else {
            console.warn("For Pickup status document does not exist");
          }
        } catch (forPickupError) {
          console.error("Error fetching for pickup count:", forPickupError);
        }

        setStats({
          users: usersSnapshot.size,
          items: itemsSnapshot.size,
          aiMatches: aiSnapshot.size,
          forPickup: forPickupCount,
        });

        try {
          const recentItemsQuery = query(
            collection(db, "items"),
            orderBy("createdAt", "desc"),
            limit(5)
          );
          const recentSnapshot = await getDocs(recentItemsQuery);
          const activities = recentSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setRecentActivity(activities);
          console.log("Recent activities:", activities.length);
        } catch (err) {
          console.error("Error fetching recent activity:", err);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, []);

  const handleLogout = () => {
    // Navigate to Hero.jsx - adjust the path as needed
    window.location.href = "/";
  };

  // Navigation items
  const navItems = [
    { key: "dashboard", title: "Dashboard", icon: "🏠" },
    { key: "users", title: "User Management", icon: "👥" },
    { key: "items", title: "Item Management", icon: "📦" },
    { key: "ai", title: "AI Matches", icon: "🤖" },
  ];

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = () => {
    switch (view) {
      case "users":
        return <UserManagement onBack={() => setView("dashboard")} />;
      case "items":
        return <ItemManagement onBack={() => setView("dashboard")} />;
      case "ai":
        return <AIMatches onBack={() => setView("dashboard")} />;
      default:
        return (
          <div className="container-fluid py-5" style={{ minHeight: "100vh", backgroundColor: "#fff8e6" }}>
            <div className="row mb-5">
              <div className="col-12 text-center">
                <h1 className="display-3 fw-bold mb-3" style={{ color: "#263054", letterSpacing: "-1px" }}>
                  Welcome to Admin Dashboard
                </h1>
                <p className="lead text-muted fs-4">
                  Monitor and manage your lost and found system
                </p>
              </div>
            </div>

            <div className="row g-4 px-3">
              {/* Total Users Card */}
              <div className="col-12 col-md-6 col-xl-3">
                <div 
                  className="card border-0 shadow-lg h-100 overflow-hidden position-relative"
                  style={{ 
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-10px)";
                    e.currentTarget.style.boxShadow = "0 20px 40px rgba(102, 126, 234, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <div className="position-absolute top-0 end-0 mt-3 me-3 opacity-25" style={{ fontSize: "80px" }}>
                    👥
                  </div>
                  <div className="card-body text-white p-4 position-relative" style={{ zIndex: 1 }}>
                    <p className="text-uppercase small fw-semibold mb-2 opacity-75">Total Users</p>
                    <h2 className="display-2 fw-bold mb-0">{stats.users}</h2>
                    <div className="mt-3 pt-3 border-top border-white border-opacity-25">
                      <small className="opacity-75">Registered accounts</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Items Card */}
              <div className="col-12 col-md-6 col-xl-3">
                <div 
                  className="card border-0 shadow-lg h-100 overflow-hidden position-relative"
                  style={{ 
                    background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-10px)";
                    e.currentTarget.style.boxShadow = "0 20px 40px rgba(240, 147, 251, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <div className="position-absolute top-0 end-0 mt-3 me-3 opacity-25" style={{ fontSize: "80px" }}>
                    📦
                  </div>
                  <div className="card-body text-white p-4 position-relative" style={{ zIndex: 1 }}>
                    <p className="text-uppercase small fw-semibold mb-2 opacity-75">Total Items</p>
                    <h2 className="display-2 fw-bold mb-0">{stats.items}</h2>
                    <div className="mt-3 pt-3 border-top border-white border-opacity-25">
                      <small className="opacity-75">Lost & Found items</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Matches Card */}
              <div className="col-12 col-md-6 col-xl-3">
                <div 
                  className="card border-0 shadow-lg h-100 overflow-hidden position-relative"
                  style={{ 
                    background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-10px)";
                    e.currentTarget.style.boxShadow = "0 20px 40px rgba(79, 172, 254, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <div className="position-absolute top-0 end-0 mt-3 me-3 opacity-25" style={{ fontSize: "80px" }}>
                    🤖
                  </div>
                  <div className="card-body text-white p-4 position-relative" style={{ zIndex: 1 }}>
                    <p className="text-uppercase small fw-semibold mb-2 opacity-75">AI Matches</p>
                    <h2 className="display-2 fw-bold mb-0">{stats.aiMatches}</h2>
                    <div className="mt-3 pt-3 border-top border-white border-opacity-25">
                      <small className="opacity-75">Smart matches found</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* For Pickup Items Card */}
              <div className="col-12 col-md-6 col-xl-3">
                <div 
                  className="card border-0 shadow-lg h-100 overflow-hidden position-relative"
                  style={{ 
                    background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-10px)";
                    e.currentTarget.style.boxShadow = "0 20px 40px rgba(250, 112, 154, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <div className="position-absolute top-0 end-0 mt-3 me-3 opacity-25" style={{ fontSize: "80px" }}>
                    ✅
                  </div>
                  <div className="card-body text-white p-4 position-relative" style={{ zIndex: 1 }}>
                    <p className="text-uppercase small fw-semibold mb-2 opacity-75">For Pickup</p>
                    <h2 className="display-2 fw-bold mb-0">{stats.forPickup}</h2>
                    <div className="mt-3 pt-3 border-top border-white border-opacity-25">
                      <small className="opacity-75">Ready for collection</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="row mt-5 px-3">
              <div className="col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h4 className="fw-bold mb-0" style={{ color: "#263054" }}>Recent Activity</h4>
                      <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setView("items")}
                      >
                        View All
                      </button>
                    </div>
                    
                    {recentActivity.length > 0 ? (
                      <div className="list-group list-group-flush">
                        {recentActivity.map((activity, index) => (
                          <div key={activity.id} className="list-group-item border-0 px-0 py-3">
                            <div className="d-flex align-items-start gap-3">
                              <div 
                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{ 
                                  width: "48px", 
                                  height: "48px", 
                                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                  color: "white",
                                  fontSize: "20px"
                                }}
                              >
                                📦
                              </div>
                              <div className="flex-grow-1">
                                <div className="d-flex justify-content-between align-items-start">
                                  <div>
                                    <h6 className="mb-1 fw-semibold">{activity.item_name || "Unnamed Item"}</h6>
                                    <p className="text-muted small mb-1">
                                      {activity.description ? activity.description.substring(0, 60) + "..." : "No description"}
                                    </p>
                                    <small className="text-muted">
                                      <span className="badge bg-light text-dark me-2">
                                        {activity.type || "Unknown"}
                                      </span>
                                      {formatDate(activity.createdAt)}
                                    </small>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-5 text-muted">
                        <div className="mb-3" style={{ fontSize: "48px", opacity: 0.3 }}>📋</div>
                        <p>No recent activity</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="d-flex" style={{ minHeight: "100vh", backgroundColor: "#fff8e6" }}>
      {/* Sidebar */}
      <div 
        className={`d-flex flex-column flex-shrink-0 p-3 text-white position-fixed h-100 ${sidebarOpen ? 'translate-x-0' : ''}`}
        style={{ 
          width: "280px", 
          background: "linear-gradient(180deg, #263054 0%, #1a2238 100%)",
          boxShadow: "4px 0 20px rgba(0,0,0,0.1)",
          zIndex: 1050,
          transform: sidebarOpen ? "translateX(0)" : "translateX(0)",
          transition: "transform 0.3s ease"
        }}
      >
        {/* Logo */}
        <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
          <h3 className="fw-bold mb-1" style={{ letterSpacing: "-0.5px" }}>
            Found<span style={{ color: "#f4b400" }}>Link</span>
          </h3>
          <p className="small mb-0 opacity-75">Admin Dashboard</p>
        </div>

        {/* Navigation */}
        <ul className="nav nav-pills flex-column mb-auto">
          {navItems.map((item) => (
            <li key={item.key} className="nav-item mb-1">
              <button
                className={`nav-link w-100 text-start d-flex align-items-center gap-2 border-0 ${
                  view === item.key ? "active" : "text-white"
                }`}
                style={{
                  backgroundColor: view === item.key ? "#f4b400" : "transparent",
                  color: view === item.key ? "#263054" : "white",
                  fontWeight: view === item.key ? "600" : "500",
                  transition: "all 0.2s ease",
                  padding: "12px 16px",
                  borderRadius: "8px"
                }}
                onClick={() => setView(item.key)}
                onMouseEnter={(e) => {
                  if (view !== item.key) {
                    e.currentTarget.style.backgroundColor = "rgba(244, 180, 0, 0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (view !== item.key) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <span style={{ fontSize: "20px", width: "24px" }}>{item.icon}</span>
                <span>{item.title}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Logout Button */}
        <div className="pt-3 border-top border-secondary border-opacity-25">
          <button
            className="btn btn-outline-light w-100 d-flex align-items-center justify-content-center gap-2"
            style={{ 
              borderRadius: "8px",
              padding: "12px",
              transition: "all 0.2s ease"
            }}
            onClick={() => setShowLogoutModal(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M16 17l5-5-5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 12H9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile Toggle Button */}
      <button
        className="btn btn-dark d-md-none position-fixed top-0 start-0 m-3"
        style={{ zIndex: 1051 }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        ☰
      </button>

      {/* Main Content */}
      <div className="flex-grow-1" style={{ marginLeft: "280px", width: "calc(100% - 280px)", overflowY: "auto", height: "100vh" }}>
        {renderContent()}
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-md-none"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1049 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1060 }}
          onClick={() => setShowLogoutModal(false)}
        >
          <div 
            className="bg-white rounded-4 shadow-lg p-4"
            style={{ maxWidth: "400px", width: "90%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div 
                className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                style={{
                  width: "64px",
                  height: "64px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  fontSize: "32px"
                }}
              >
                👋
              </div>
              <h4 className="fw-bold mb-2" style={{ color: "#263054" }}>Confirm Logout</h4>
              <p className="text-muted mb-0">Are you sure you want to logout from the admin dashboard?</p>
            </div>
            
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary flex-fill"
                style={{ 
                  borderRadius: "8px",
                  padding: "12px",
                  fontWeight: "500"
                }}
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn flex-fill text-white"
                style={{ 
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "8px",
                  padding: "12px",
                  fontWeight: "500",
                  border: "none"
                }}
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}