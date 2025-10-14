import React, { useState, useMemo, useEffect } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  limit,
  getCountFromServer,
} from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, updatePassword } from "firebase/auth";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmEdit, setConfirmEdit] = useState(null);
  const [showPasswordAdd, setShowPasswordAdd] = useState(false);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [editPassword, setEditPassword] = useState("");
  const [updatePasswordChecked, setUpdatePasswordChecked] = useState(false);

  const resetAddUserForm = () => {
    setNewUser({ username: "", email: "", password: "" });
    setShowPasswordAdd(false);
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    const timer = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timer);
  };

  const fetchUserCount = async () => {
    try {
      const usersCollection = collection(db, "users");
      const snapshot = await getCountFromServer(usersCollection);
      const count = snapshot.data().count;
      setUserCount(count);
    } catch (error) {
      console.error("Error fetching user count:", error);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersCollection = collection(db, "users");
        const q = query(usersCollection, limit(200));
        const userSnapshot = await getDocs(q);
        const userList = userSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(userList);
        await fetchUserCount();
      } catch (error) {
        console.error("Error fetching users:", error);
        showNotification("Failed to load users", "danger");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const fetchArchivedUsers = async () => {
    setLoading(true);
    try {
      const archivedUsersCollection = collection(db, "archived_users");
      const q = query(archivedUsersCollection, limit(200));
      const archivedUserSnapshot = await getDocs(q);
      const archivedUserList = archivedUserSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setArchivedUsers(archivedUserList);
    } catch (error) {
      console.error("Error fetching archived users:", error);
      showNotification("Failed to load archived users", "danger");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return showArchived ? archivedUsers : users;
    return (showArchived ? archivedUsers : users).filter(
      (u) =>
        String(u.id).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, archivedUsers, search, showArchived]);

  const sanitizeInput = (input) => {
    return input.trim().replace(/[<>]/g, "");
  };

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  function openEdit(user) {
    setEditingUser({ ...user });
    setShowPasswordEdit(false);
    setEditPassword("");
    setUpdatePasswordChecked(false);
  }

  const validateAndAddUser = async () => {
    const { username, email, password } = newUser;
    
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedEmail = sanitizeInput(email);

    if (!sanitizedUsername) return showNotification("Username is required", "warning");
    if (!sanitizedEmail) return showNotification("Email is required", "warning");
    if (!validateEmail(sanitizedEmail)) return showNotification("Invalid email format", "warning");
    if (!password.trim()) return showNotification("Password is required", "warning");
    if (password.length < 8) return showNotification("Password must be at least 8 characters", "warning");

    // Check if user limit reached
    if (userCount >= 200) {
      return showNotification("User limit reached (200/200)", "danger");
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
      const user = userCredential.user;

      const userToSave = { 
        username: sanitizedUsername, 
        email: sanitizedEmail, 
        role: "user",
        uid: user.uid,
        createdAt: new Date().toISOString()
      };
      const newUserRef = await addDoc(collection(db, "users"), userToSave);

      setUsers((prev) => [...prev, { id: newUserRef.id, ...userToSave }]);
      await fetchUserCount();
      showNotification("User added successfully!", "success");
      resetAddUserForm();
      setShowAddUserModal(false);
    } catch (error) {
      console.error("Error adding user:", error);
      let errorMessage = "Failed to add user";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email already in use";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak";
      }
      showNotification(errorMessage, "danger");
    } finally {
      setLoading(false);
    }
  };

  const confirmSaveEdit = () => {
    const sanitizedUsername = sanitizeInput(editingUser.username);
    const sanitizedEmail = sanitizeInput(editingUser.email);

    if (!sanitizedUsername) return showNotification("Username is required", "warning");
    if (!sanitizedEmail) return showNotification("Email is required", "warning");
    if (!validateEmail(sanitizedEmail)) return showNotification("Invalid email format", "warning");
    
    if (updatePasswordChecked) {
      if (!editPassword.trim()) return showNotification("Password is required when updating", "warning");
      if (editPassword.length < 8) return showNotification("Password must be at least 8 characters", "warning");
    }

    setConfirmEdit({ 
      ...editingUser, 
      username: sanitizedUsername,
      email: sanitizedEmail 
    });
  };

  const saveEdit = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, showArchived ? "archived_users" : "users", confirmEdit.id);
      
      const updateData = {
        username: confirmEdit.username,
        email: confirmEdit.email,
        role: confirmEdit.role,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updateData);

      // Update password if requested
      if (updatePasswordChecked && editPassword) {
        try {
          const auth = getAuth();
          const user = auth.currentUser;
          if (user && user.uid === confirmEdit.uid) {
            await updatePassword(user, editPassword);
          }
        } catch (pwError) {
          console.error("Error updating password:", pwError);
          showNotification("User updated but password change failed", "warning");
        }
      }

      if (showArchived) {
        setArchivedUsers((prev) =>
          prev.map((u) => (u.id === confirmEdit.id ? { ...u, ...updateData } : u))
        );
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === confirmEdit.id ? { ...u, ...updateData } : u))
        );
      }

      setEditingUser(null);
      setConfirmEdit(null);
      setEditPassword("");
      setUpdatePasswordChecked(false);
      showNotification("User updated successfully!", "success");
    } catch (error) {
      console.error("Error updating user:", error);
      showNotification("Failed to update user", "danger");
    } finally {
      setLoading(false);
    }
  };

  const confirmArchiveUser = (user) => {
    setConfirmArchive(user);
  };

  const doArchive = async () => {
    if (!confirmArchive) return;

    setLoading(true);
    try {
      const userRef = doc(db, "users", confirmArchive.id);
      const archiveRef = doc(db, "archived_users", confirmArchive.id);

      await setDoc(archiveRef, {
        ...confirmArchive,
        archivedAt: new Date().toISOString(),
      });

      await deleteDoc(userRef);

      setUsers((prev) => prev.filter((u) => u.id !== confirmArchive.id));
      await fetchUserCount();

      setConfirmArchive(null);
      showNotification("User archived successfully!", "success");
    } catch (error) {
      console.error("Error archiving user:", error);
      showNotification("Failed to archive user", "danger");
    } finally {
      setLoading(false);
    }
  };

  const restoreArchivedUser = async (user) => {
    setLoading(true);
    try {
      const archiveRef = doc(db, "archived_users", user.id);
      const userRef = doc(db, "users", user.id);

      const { archivedAt, ...userData } = user;

      await setDoc(userRef, {
        ...userData,
        restoredAt: new Date().toISOString(),
      });

      await deleteDoc(archiveRef);

      setUsers((prev) => [...prev, userData]);
      setArchivedUsers((prev) => prev.filter((u) => u.id !== user.id));
      await fetchUserCount();

      showNotification("User restored successfully!", "success");
    } catch (error) {
      console.error("Error restoring user:", error);
      showNotification("Failed to restore user", "danger");
    } finally {
      setLoading(false);
    }
  };

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
      {/* Loading Overlay */}
      {loading && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 10000,
          }}
        >
          <div className="spinner-border text-light" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className={`position-fixed top-0 end-0 m-3 alert alert-${notification.type} alert-dismissible fade show`}
          role="alert"
          style={{
            zIndex: 9999,
            minWidth: "300px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <strong>{notification.message}</strong>
          <button
            type="button"
            className="btn-close"
            onClick={() => setNotification(null)}
          ></button>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h1 className="display-4 fw-bold" style={{ color: "#263054" }}>
          User Management
        </h1>
        <p className="lead text-muted fs-5">
          Manage user accounts and permissions
          <span className={`ms-3 badge ${userCount >= 200 ? 'bg-danger' : 'bg-primary'}`}>
            {userCount}/200 Users
          </span>
        </p>
      </div>

      {/* Search + Buttons */}
      <div className="card shadow-sm mb-4 border-0">
        <div className="card-body p-4 d-flex flex-wrap gap-3 justify-content-between">
          <input
            type="text"
            className="form-control form-control-lg"
            placeholder="Search by ID, email, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ borderRadius: "12px", maxWidth: "500px" }}
          />
          <div className="d-flex gap-2">
            <button
              className="btn btn-success"
              onClick={() => {
                resetAddUserForm();
                setShowAddUserModal(true);
                setSearch("");
              }}
              disabled={userCount >= 200}
            >
              + Add User
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => {
                if (!showArchived) fetchArchivedUsers();
                setShowArchived((prev) => !prev);
                setSearch("");
              }}
            >
              {showArchived ? "View Active" : "View Archived"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead
                style={{
                  background: "linear-gradient(135deg, #263054 0%, #1a2238 100%)",
                  color: "white",
                }}
              >
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      <div style={{ fontSize: "48px", opacity: 0.3 }}>📭</div>
                      <p>No users found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4">{u.id}</td>
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4">{u.username}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`badge px-3 py-2 ${
                            u.role?.toLowerCase() === "admin"
                              ? "bg-success"
                              : "bg-primary"
                          }`}
                        >
                          {u.role || "user"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => openEdit(u)}
                          >
                            Edit
                          </button>
                          {!showArchived ? (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => confirmArchiveUser(u)}
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-success"
                              onClick={() => restoreArchivedUser(u)}
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

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Add New User</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddUserModal(false)}
                ></button>
              </div>
              <div className="modal-body pt-2">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newUser.username}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, username: e.target.value }))
                    }
                    maxLength="50"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Password</label>
                  <div className="input-group">
                    <input
                      type={showPasswordAdd ? "text" : "password"}
                      className="form-control"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser((prev) => ({ ...prev, password: e.target.value }))
                      }
                    />
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={() => setShowPasswordAdd((prev) => !prev)}
                    >
                      {showPasswordAdd ? "Hide" : "Show"}
                    </button>
                  </div>
                  <small className="text-muted">Minimum 8 characters</small>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddUserModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={validateAndAddUser}
                  disabled={loading}
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && !confirmEdit && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Edit User</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEditingUser(null)}
                ></button>
              </div>
              <div className="modal-body pt-2">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser.username}
                    onChange={(e) =>
                      setEditingUser((prev) => ({ ...prev, username: e.target.value }))
                    }
                    maxLength="50"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={editingUser.email}
                    onChange={(e) =>
                      setEditingUser((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Role</label>
                  <select
                    className="form-select"
                    value={editingUser.role || "user"}
                    onChange={(e) =>
                      setEditingUser((prev) => ({ ...prev, role: e.target.value }))
                    }
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="mb-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="updatePassword"
                      checked={updatePasswordChecked}
                      onChange={(e) => setUpdatePasswordChecked(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="updatePassword">
                      Update Password
                    </label>
                  </div>
                </div>
                {updatePasswordChecked && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">New Password</label>
                    <div className="input-group">
                      <input
                        type={showPasswordEdit ? "text" : "password"}
                        className="form-control"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                      />
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => setShowPasswordEdit((prev) => !prev)}
                      >
                        {showPasswordEdit ? "Hide" : "Show"}
                      </button>
                    </div>
                    <small className="text-muted">Minimum 8 characters</small>
                  </div>
                )}
              </div>
              <div className="modal-footer border-0">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmSaveEdit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Edit Modal */}
      {confirmEdit && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-warning bg-opacity-10">
                <h5 className="modal-title fw-bold">Confirm Changes</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setConfirmEdit(null)}
                ></button>
              </div>
              <div className="modal-body pt-3">
                <p className="mb-3">Are you sure you want to update this user?</p>
                <div className="bg-light p-3 rounded">
                  <p className="mb-1"><strong>Username:</strong> {confirmEdit.username}</p>
                  <p className="mb-1"><strong>Email:</strong> {confirmEdit.email}</p>
                  <p className="mb-1"><strong>Role:</strong> {confirmEdit.role}</p>
                  {updatePasswordChecked && (
                    <p className="mb-0 text-warning"><strong>Password will be updated</strong></p>
                  )}
                </div>
              </div>
              <div className="modal-footer border-0">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmEdit(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveEdit}
                  disabled={loading}
                >
                  Confirm Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Archive Modal */}
      {confirmArchive && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-danger bg-opacity-10">
                <h5 className="modal-title fw-bold text-danger">Confirm Archive</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setConfirmArchive(null)}
                ></button>
              </div>
              <div className="modal-body pt-3">
                <p className="mb-3">Are you sure you want to archive this user?</p>
                <div className="bg-light p-3 rounded">
                  <p className="mb-1"><strong>Username:</strong> {confirmArchive.username}</p>
                  <p className="mb-0"><strong>Email:</strong> {confirmArchive.email}</p>
                </div>
                <p className="text-muted mt-3 mb-0">
                  <small>This user will be moved to archived users and can be restored later.</small>
                </p>
              </div>
              <div className="modal-footer border-0">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmArchive(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={doArchive}
                  disabled={loading}
                >
                  Archive User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}