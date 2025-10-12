import React, { useState, useMemo, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs, updateDoc, doc, addDoc, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmEdit, setConfirmEdit] = useState(null);
  const [confirmAdd, setConfirmAdd] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", email: "", role: "user", password: "" });
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const usersCollection = collection(db, "users");
      const userSnapshot = await getDocs(usersCollection);
      const userList = userSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(userList);
    };

    fetchUsers();
  }, []);

  const fetchArchivedUsers = async () => {
    const archivedUsersCollection = collection(db, "archived_users");
    const archivedUserSnapshot = await getDocs(archivedUsersCollection);
    const archivedUserList = archivedUserSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setArchivedUsers(archivedUserList);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return showArchived ? archivedUsers : users;
    return (showArchived ? archivedUsers : users).filter(
      (u) =>
        String(u.id).includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, archivedUsers, search, showArchived]);

  function openEdit(user) {
    setEditingUser({ ...user });
    setShowPassword(false);
  }

  const validateAndConfirmAddUser = () => {
    if (!newUser.username.trim()) {
      showNotification("Username is required", "warning");
      return;
    }
    if (!newUser.email.trim()) {
      showNotification("Email is required", "warning");
      return;
    }
    if (!newUser.password.trim()) {
      showNotification("Password is required", "warning");
      return;
    }
    if (newUser.password.length < 6) {
      showNotification("Password must be at least 6 characters long", "warning");
      return;
    }
    setConfirmAdd(true);
  };

  const handleAddUser = async () => {
    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newUser.email,
        newUser.password
      );
      const user = userCredential.user;

      const userToSave = {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        uid: user.uid,
      };
      const newUserRef = await addDoc(collection(db, "users"), userToSave);
      setUsers([...users, { id: newUserRef.id, ...userToSave }]);
      setNewUser({ username: "", email: "", role: "user", password: "" });
      setShowAddUserModal(false);
      setConfirmAdd(false);
      showNotification("User added successfully!", "success");
    } catch (error) {
      console.error("Error adding user: ", error);
      showNotification(error.message, "danger");
    }
  };

  const confirmSaveEdit = () => {
    setConfirmEdit({ ...editingUser });
  };

  const saveEdit = async () => {
    try {
      const userRef = doc(db, showArchived ? "archived_users" : "users", confirmEdit.id);
      await updateDoc(userRef, {
        username: confirmEdit.username,
        email: confirmEdit.email,
        role: confirmEdit.role,
      });
      
      if (showArchived) {
        setArchivedUsers((prevArchivedUsers) =>
          prevArchivedUsers.map((u) => (u.id === confirmEdit.id ? { ...confirmEdit } : u))
        );
      } else {
        setUsers((prevUsers) =>
          prevUsers.map((u) => (u.id === confirmEdit.id ? { ...confirmEdit } : u))
        );
      }
      
      setEditingUser(null);
      setConfirmEdit(null);
      showNotification("User updated successfully!", "success");
    } catch (error) {
      console.error("Error updating user:", error);
      showNotification("Failed to update user", "danger");
    }
  };

  const confirmArchiveUser = (user) => {
    setConfirmArchive(user);
  };

  const doArchive = async () => {
    if (!confirmArchive) return;

    try {
      const userRef = doc(db, "users", confirmArchive.id);
      const archiveRef = doc(db, "archived_users", confirmArchive.id);

      await setDoc(archiveRef, {
        ...confirmArchive,
        archivedAt: new Date().toISOString(),
      });

      await deleteDoc(userRef);

      setUsers((prevUsers) => prevUsers.filter((u) => u.id !== confirmArchive.id));

      setConfirmArchive(null);
      showNotification("User archived successfully!", "success");
    } catch (error) {
      console.error("Error archiving user:", error);
      showNotification("Failed to archive user", "danger");
    }
  };

  const restoreArchivedUser = async (user) => {
    try {
      const archiveRef = doc(db, "archived_users", user.id);
      const userRef = doc(db, "users", user.id);

      await setDoc(userRef, {
        ...user,
        archivedAt: null,
      });

      await deleteDoc(archiveRef);

      setUsers((prevUsers) => [...prevUsers, user]);
      setArchivedUsers((prevArchivedUsers) =>
        prevArchivedUsers.filter((u) => u.id !== user.id)
      );

      showNotification("User restored successfully!", "success");
    } catch (error) {
      console.error("Error restoring user:", error);
      showNotification("Failed to restore user", "danger");
    }
  };

  return (
    <div className="container-fluid py-4" style={{ backgroundColor: "#fff8e6", minHeight: "100vh", paddingLeft: "2rem", paddingRight: "2rem" }}>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      
      {/* Notification Toast */}
      {notification && (
        <div
          className={`position-fixed top-0 end-0 m-3 alert alert-${notification.type} alert-dismissible fade show`}
          role="alert"
          style={{
            zIndex: 9999,
            minWidth: "300px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            animation: "slideInRight 0.3s ease-out"
          }}
        >
          <strong>{notification.message}</strong>
          <button type="button" className="btn-close" onClick={() => setNotification(null)}></button>
        </div>
      )}
      
      {/* Header */}
      <div className="mb-4">
        <h1 className="display-4 fw-bold" style={{ color: "#263054" }}>User Management</h1>
        <p className="lead text-muted fs-5">Manage user accounts and permissions</p>
      </div>

      {/* Search and Actions Bar */}
      <div className="card shadow-sm mb-4 border-0">
        <div className="card-body p-4">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-md-6">
              <input
                type="text"
                className="form-control form-control-lg"
                placeholder="Search by ID, email, or username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ borderRadius: "12px" }}
              />
            </div>
            <div className="col-12 col-md-6 d-flex gap-2 justify-content-md-end">
              <button
                className="btn btn-success d-flex align-items-center gap-2"
                onClick={() => setShowAddUserModal(true)}
                style={{ borderRadius: "10px", padding: "12px 24px" }}
              >
                <span style={{ fontSize: "18px" }}>+</span> Add User
              </button>
              <button
                className="btn btn-outline-primary d-flex align-items-center gap-2"
                onClick={() => {
                  if (!showArchived) fetchArchivedUsers();
                  setShowArchived((prev) => !prev);
                }}
                style={{ borderRadius: "10px", padding: "12px 24px" }}
              >
                {showArchived ? "View Active" : "View Archived"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead style={{ background: "linear-gradient(135deg, #263054 0%, #1a2238 100%)", color: "white" }}>
                <tr>
                  <th className="py-3 px-4" style={{ width: "100px" }}>ID</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-end" style={{ width: "250px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      <div style={{ fontSize: "48px", opacity: 0.3 }}>📭</div>
                      <p className="mb-0 mt-2">No users found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.id} style={{ transition: "background-color 0.2s" }}>
                      <td className="py-3 px-4 fw-semibold" style={{ color: "#263054" }}>{u.id}</td>
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4 fw-medium">{u.username}</td>
                      <td className="py-3 px-4">
                        <span className={`badge px-3 py-2 ${u.role?.toLowerCase() === 'admin' ? 'bg-success' : 'bg-primary'}`}>
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                            onClick={() => openEdit(u)}
                            style={{ borderRadius: "8px" }}
                          >
                            Edit
                          </button>
                          {!showArchived && (
                            <button
                              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                              onClick={() => confirmArchiveUser(u)}
                              style={{ borderRadius: "8px" }}
                            >
                              Archive
                            </button>
                          )}
                          {showArchived && (
                            <button
                              className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                              onClick={() => restoreArchivedUser(u)}
                              style={{ borderRadius: "8px" }}
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Edit User</h5>
                <button type="button" className="btn-close" onClick={() => setEditingUser(null)}></button>
              </div>
              <div className="modal-body pt-2">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser.username || ""}
                    onChange={(e) => setEditingUser((s) => ({ ...s, username: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={editingUser.email || ""}
                    onChange={(e) => setEditingUser((s) => ({ ...s, email: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Role</label>
                  <select
                    className="form-select"
                    value={editingUser.role || "user"}
                    onChange={(e) => setEditingUser((s) => ({ ...s, role: e.target.value }))}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={confirmSaveEdit}>
                  Update User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Add New User</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddUserModal(false)}></button>
              </div>
              <div className="modal-body pt-2">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newUser.username}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={newUser.email}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Role</label>
                  <select
                    className="form-select"
                    value={newUser.role}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Password</label>
                  <div className="input-group">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      value={newUser.password}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                    />
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-success" onClick={validateAndConfirmAddUser}>
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {confirmArchive && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-danger text-white">
                <h5 className="modal-title fw-bold">Confirm Archive</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setConfirmArchive(null)}></button>
              </div>
              <div className="modal-body pt-3">
                <p className="mb-0">
                  Are you sure you want to archive user <strong>{confirmArchive.username}</strong>? 
                  This will move them to the archived users list.
                </p>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmArchive(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={doArchive}>
                  Archive User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Confirmation Modal */}
      {confirmEdit && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-primary text-white">
                <h5 className="modal-title fw-bold">Confirm Update</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setConfirmEdit(null)}></button>
              </div>
              <div className="modal-body pt-3">
                <p className="mb-2">Are you sure you want to update user <strong>{confirmEdit.username}</strong>?</p>
                <div className="mt-3 p-3 bg-light rounded">
                  <p className="mb-1"><strong>Email:</strong> {confirmEdit.email}</p>
                  <p className="mb-0"><strong>Role:</strong> {confirmEdit.role}</p>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmEdit(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={saveEdit}>
                  Confirm Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Confirmation Modal */}
      {confirmAdd && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-success text-white">
                <h5 className="modal-title fw-bold">Confirm Add User</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setConfirmAdd(false)}></button>
              </div>
              <div className="modal-body pt-3">
                <p className="mb-2">Are you sure you want to add this user?</p>
                <div className="mt-3 p-3 bg-light rounded">
                  <p className="mb-1"><strong>Username:</strong> {newUser.username}</p>
                  <p className="mb-1"><strong>Email:</strong> {newUser.email}</p>
                  <p className="mb-0"><strong>Role:</strong> {newUser.role}</p>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmAdd(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-success" onClick={handleAddUser}>
                  Confirm Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}