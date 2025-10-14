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
} from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmEdit, setConfirmEdit] = useState(null);
  const [confirmAdd, setConfirmAdd] = useState(false);
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

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const usersCollection = collection(db, "users");
      const q = query(usersCollection, limit(200));
      const userSnapshot = await getDocs(q);
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
    const q = query(archivedUsersCollection, limit(200));
    const archivedUserSnapshot = await getDocs(q);
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
    setShowPasswordEdit(false);
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
        role: "admin", // Force admin role
        uid: user.uid,
      };
      const newUserRef = await addDoc(collection(db, "users"), userToSave);
      setUsers([...users, { id: newUserRef.id, ...userToSave }]);
      setNewUser({ username: "", email: "", password: "" });
      setShowAddUserModal(false);
      setConfirmAdd(false);
      setShowPasswordAdd(false);
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
    <div
      className="container-fluid py-4"
      style={{
        backgroundColor: "#fff8e6",
        minHeight: "100vh",
        paddingLeft: "2rem",
        paddingRight: "2rem",
      }}
    >
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
        <p className="lead text-muted fs-5">Manage user accounts and permissions</p>
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
              setShowAddUserModal(true);   
              setSearch("");                   
              setNewUser({ username: "", email: "", password: "" }); 
            }}
          >
            + Add User
          </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => {
                if (!showArchived) fetchArchivedUsers();
                setShowArchived((prev) => !prev);
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
                  onClick={validateAndConfirmAddUser}
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Add Modal */}
      {confirmAdd && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-success text-white">
                <h5 className="modal-title fw-bold">Confirm Add User</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setConfirmAdd(false)}
                ></button>
              </div>
              <div className="modal-body pt-3">
                <p>Are you sure you want to add this user?</p>
                <div className="mt-3 p-3 bg-light rounded">
                  <p><strong>Username:</strong> {newUser.username}</p>
                  <p><strong>Email:</strong> {newUser.email}</p>
                  <p><strong>Role:</strong> Admin</p>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmAdd(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleAddUser}
                >
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
