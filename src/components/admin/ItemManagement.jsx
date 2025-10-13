import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  writeBatch,
  updateDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";

export default function ItemManagement() {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ type: "All", status: "All", category: "All" });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const auth = getAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [isResolving, setIsResolving] = useState(false);

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({
    item_name: "",
    description: "",
    location: "",
    status: "",
    category: "",
  });
  const [statusOptions, setStatusOptions] = useState([]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    item_name: "",
    category: "",
    description: "",
    location: "",
    date_lost_found: "",
    type: "Lost",
  });

  const [imageFile, setImageFile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [showToastNotif, setShowToastNotif] = useState(false);

  const showToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToastNotif(true);
    setTimeout(() => {
      setShowToastNotif(false);
    }, 3000);
  };

  // Enhanced reference detection for Firestore
  const isRef = (v) => {
    if (!v || typeof v !== "object") return false;
    // Check for Firestore DocumentReference properties
    return ("path" in v || "firestore" in v || "converter" in v || "_key" in v || v.constructor?.name === "DocumentReference");
  };

  // Helper to safely extract string values from any field
  const safeString = (value, fallback = "N/A") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    if (isRef(value)) return fallback;
    if (typeof value === "object") return fallback;
    return String(value);
  };

  async function fetchItems() {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "items"));
      const data = await Promise.all(
        snapshot.docs.map(async (d) => {
          const item = { id: d.id, ...d.data() };

          // 🟡 Resolve category reference
          if (item.category && isRef(item.category)) {
            try {
              const categorySnap = await getDoc(item.category);
              if (categorySnap.exists()) {
                const catData = categorySnap.data();
                item.category_name = catData.cat_name || catData.name || categorySnap.id;
                item.category_id = categorySnap.id;
              } else {
                item.category_name = "Unknown Category";
              }
            } catch (err) {
              console.error("Failed to resolve category for", item.id, err);
              item.category_name = "Error loading category";
            }
          } else if (typeof item.category === "string") {
            item.category_name = item.category;
          } else {
            item.category_name = "No Category";
          }

          // 🟢 Resolve status reference
          if (item.status && isRef(item.status)) {
            try {
              const statusSnap = await getDoc(item.status);
              if (statusSnap.exists()) {
                const statusData = statusSnap.data();
                item.status_name = statusData.status_name || statusData.name || statusSnap.id;
                item.status_id = statusSnap.id;
              } else {
                item.status_name = "Unknown Status";
              }
            } catch (err) {
              console.error("Failed to resolve status for", item.id, err);
              item.status_name = "Error loading status";
            }
          } else if (typeof item.status === "string") {
            item.status_name = item.status;
          } else {
            item.status_name = "No Status";
          }

          // 🧩 Type is already a string in your case
          if (typeof item.type === "string") {
            item.type_name = item.type;
          } else if (item.type && isRef(item.type)) {
            try {
              const typeSnap = await getDoc(item.type);
              if (typeSnap.exists()) {
                const typeData = typeSnap.data();
                item.type_name = typeData.type_name || typeData.name || typeSnap.id;
                item.type_id = typeSnap.id;
              } else {
                item.type_name = "Unknown Type";
              }
            } catch (err) {
              console.error("Failed to resolve type for", item.id, err);
              item.type_name = "Unknown";
            }
          } else {
            item.type_name = "Unknown";
          }

          // 👤 Fetch username from users collection using userId or user_name reference
          console.log("🔍 Processing user for item:", item.id, {
            userId: item.userId,
            user_name: item.user_name,
            user_name_type: typeof item.user_name,
            is_ref: isRef(item.user_name)
          });

          if (item.userId) {
            try {
              const userDocRef = doc(db, "users", item.userId);
              const userSnap = await getDoc(userDocRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                item.user_name = userData.user_name || userData.username || userData.displayName || userData.email || "Unknown User";
                console.log("✅ Resolved user from userId:", item.user_name);
              } else {
                console.log("❌ User document not found for userId:", item.userId);
                item.user_name = "Unknown User";
              }
            } catch (err) {
              console.error("Failed to fetch user for", item.id, err);
              item.user_name = "Unknown User";
            }
          } else if (typeof item.user_name === "string") {
            console.log("✅ User name already a string:", item.user_name);
            // Keep as is for old items that might have user_name as string
          } else if (item.user_name && isRef(item.user_name)) {
            console.log("🔗 User name is a reference, resolving...");
            try {
              const userSnap = await getDoc(item.user_name);
              console.log("📄 User ref exists?", userSnap.exists());
              if (userSnap.exists()) {
                const userData = userSnap.data();
                console.log("👤 User data from ref:", userData);
                item.user_name = userData.user_name || userData.username || userData.displayName || userData.email || userSnap.id;
                console.log("✅ Resolved user from reference:", item.user_name);
              } else {
                item.user_name = "Unknown User";
              }
            } catch (err) {
              console.error("Failed to resolve user reference for", item.id, err);
              item.user_name = "Unknown User";
            }
          } else {
            console.log("⚠️ No user information found");
            item.user_name = "Unknown User";
          }

          return item;
        })
      );

      console.log("✅ Fetched items with resolved references:", data);
      setItems(data);
    } catch (err) {
      console.error("❌ Error fetching items:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    let result = items;

    if (!showArchived) {
      result = result.filter((item) => !item.archived);
    } else {
      result = result.filter((item) => item.archived === true);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const name = (item.item_name || item.item_names || "").toString().toLowerCase();
        const desc = (item.description || "").toString().toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }

    if (filters.type !== "All") {
      result = result.filter((item) => (item.type_name || item.type || "").toLowerCase() === filters.type.toLowerCase());
    }

    if (filters.status !== "All") {
      result = result.filter((item) => (item.status_name || "").toString().toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.category !== "All") {
      result = result.filter((item) => {
        const itemCategory = (item.category_name || "").toLowerCase();
        const filterCategory = filters.category.toLowerCase();
        return itemCategory === filterCategory;
      });
    }

    return result;
  }, [items, showArchived, searchQuery, filters]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filteredItems]);

  async function fetchStatusOptions() {
    try {
      const snap = await getDocs(collection(db, "status"));
      const opts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log("📊 Fetched status options:", opts);
      setStatusOptions(opts);
    } catch (err) {
      console.error("fetchStatusOptions error", err);
    }
  }

  async function fetchCategories() {
    try {
      const snap = await getDocs(collection(db, "categories"));
      const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCategories(cats);
    } catch (err) {
      console.error("fetchCategories error", err);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    
    if (!newItem.item_name || !newItem.category || !newItem.description || !newItem.date_lost_found) {
      return alert("Please fill all required fields");
    }
  
    if (!auth.currentUser) {
      alert('You must be logged in to add an item.');
      return;
    }
  
    try {
      console.log('🚀 Starting item addition...');
      
      const categoryRef = doc(db, "categories", newItem.category);
      const statusRef = doc(db, "status", "Status1");
  
      let imageUrl = null;
      
      // Upload image if exists
      if (imageFile) {
        console.log('📤 Starting image upload...');
        console.log('Image file:', imageFile.name, 'Size:', imageFile.size, 'bytes');
        
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
        if (!allowedTypes.includes(imageFile.type)) {
          alert("Only PNG and JPEG files are allowed!");
          return;
        }
        
        const maxSize = 5 * 1024 * 1024;
        if (imageFile.size > maxSize) {
          alert("File is too large! Please upload an image under 5MB.");
          return;
        }
  
        try {
          const fileName = `${Date.now()}-${imageFile.name}`;
          const storageRef = ref(storage, `items/${fileName}`);
          
          console.log('📍 Storage path:', storageRef.fullPath);
          
          // Upload with timeout
          const uploadPromise = uploadBytes(storageRef, imageFile);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
          );
          
          await Promise.race([uploadPromise, timeoutPromise]);
          console.log('✅ Upload complete');
          
          imageUrl = await getDownloadURL(storageRef);
          console.log('🔗 Image URL:', imageUrl);
          
        } catch (uploadError) {
          console.error('❌ Image upload error:', uploadError);
          alert('Failed to upload image: ' + uploadError.message + '\n\nContinuing without image...');
          imageUrl = null; // Continue without image
        }
      }
  
      console.log('💾 Saving to Firestore...');
      await addDoc(collection(db, "items"), {
        item_name: newItem.item_name,
        category: categoryRef,
        location: newItem.location,
        description: newItem.description,
        date_lost_found: Timestamp.fromDate(new Date(newItem.date_lost_found)),
        type: newItem.type,
        userId: auth.currentUser.uid,
        status: statusRef,
        archived: false,
        createdAt: Timestamp.now(),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      });
      
      console.log('✅ Item added successfully!');
  
      setAddModalOpen(false);
      setNewItem({ item_name: "", category: "", description: "", location: "", date_lost_found: "", type: "Lost" });
      setImageFile(null);
      await fetchItems();
      showToast("Item added successfully!", "success");
      
    } catch (err) {
      console.error("❌ Error adding item:", err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      alert("Failed to add item: " + err.message);
    }
  }

  async function confirmDelete() {
    if (isBulkDelete) {
      const batch = writeBatch(db);
      for (const id of deleteTarget) {
        const itemRef = doc(db, "items", id);
        batch.delete(itemRef);
      }
      try {
        await batch.commit();
        await fetchItems();
        setModalOpen(false);
        showToast(`${deleteTarget.length} items deleted permanently!`, "success");
      } catch (err) {
        console.error("bulkDelete error", err);
        showToast("Failed to delete items", "error");
      }
    } else {
      try {
        await deleteDoc(doc(db, "items", deleteTarget));
        await fetchItems();
        setModalOpen(false);
        showToast("Item deleted permanently!", "success");
      } catch (err) {
        console.error("deleteItem error", err);
        showToast("Failed to delete item", "error");
      }
    }
  }

  function openEditModal(item) {
    setEditItem(item);
    setEditForm({
      item_name: item.item_name || "",
      description: item.description || "",
      location: item.location || "",
      status: item.status_id || item.status || item.status_name || "",
      category: item.category_id || "",
    });
    setEditModalOpen(true);
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  }

  async function sendNotification(userId, itemId, message) {
    if (!userId) {
      console.error("Missing user ID. Cannot send notification.");
      return false;
    }

    try {
      await addDoc(collection(db, "notifications"), {
        userId: userId,
        item_id: itemId,
        title: "Item Status Update",
        message: message || "",
        read: false,
        type: "notif",
        createdAt: Timestamp.now(),
      });
      return true;
    } catch (err) {
      console.error("Failed to send notification:", err);
      return false;
    }
  }

  async function saveEdit() {
    if (!editItem) return;
    try {
      const itemRef = doc(db, "items", editItem.id);

      const statusIsFetchedId = statusOptions.some((s) => s.id === editForm.status);
      const statusRef = statusIsFetchedId ? doc(db, "status", editForm.status) : null;

      const categoryIsFetchedId = categories.some((c) => c.id === editForm.category);
      const categoryRef = categoryIsFetchedId ? doc(db, "categories", editForm.category) : null;

      const updatePayload = {
        item_name: editForm.item_name,
        description: editForm.description,
        location: editForm.location,
        ...(statusRef ? { status: statusRef } : { status: editForm.status }),
        ...(categoryRef ? { category: categoryRef } : {}),
      };

      await updateDoc(itemRef, updatePayload);

      // Check if status has changed and send notification
      const oldStatusId = editItem.status_id || editItem.status;
      const newStatusId = editForm.status;
      
      if (oldStatusId !== newStatusId && statusIsFetchedId) {
        const newStatusDoc = await getDoc(doc(db, "status", newStatusId));
        if (newStatusDoc.exists()) {
          const newStatusName = newStatusDoc.data().status_name || newStatusDoc.data().name || "updated";
          const message = `The status of your item "${editItem.item_name}" has been updated to: ${newStatusName}`;
          
          const userId = editItem.userId || editItem.user_id;
          if (userId) {
            await sendNotification(userId, editItem.id, message);
            showToast("Item updated and notification sent!", "success");
          } else {
            showToast("Item updated successfully!", "success");
          }
        }
      } else {
        showToast("Item updated successfully!", "success");
      }

      await fetchItems();
      setEditModalOpen(false);
      setEditItem(null);
    } catch (err) {
      console.error("Error saving edit", err);
      showToast("Failed to update item", "error");
    }
  }

  async function bulkResolve() {
    if (selectedIds.size === 0) return alert("No items selected");
    setResolveTarget([...selectedIds]);
    setResolveModalOpen(true);
  }

  async function confirmResolve() {
    const TARGET_STATUS_ID = "Status3";
    const targetRef = doc(db, "status", TARGET_STATUS_ID);

    setIsResolving(true);
    try {
      const batch = writeBatch(db);
      const itemsToResolve = Array.isArray(resolveTarget) ? resolveTarget : [resolveTarget];
      
      for (const id of itemsToResolve) {
        const itemRef = doc(db, "items", id);
        
        const statusDoc = await getDoc(targetRef);
        const statusName = statusDoc.exists() ? (statusDoc.data().status_name || statusDoc.data().name || "").toLowerCase() : "";
        
        if (statusName === "claimed") {
          batch.update(itemRef, { 
            status: targetRef,
            archived: true,
            archivedAt: Timestamp.now()
          });
        } else {
          batch.update(itemRef, { status: targetRef });
        }
      }

      await batch.commit();
      await fetchItems();
      setResolveModalOpen(false);
      setResolveTarget(null);
      if (Array.isArray(resolveTarget) && resolveTarget.length > 1) {
        alert("Items resolved successfully!");
      }
    } catch (err) {
      console.error("resolve error", err);
      alert("Failed to resolve items");
    } finally {
      setIsResolving(false);
    }
  }

  function openArchiveModal(id) {
    setArchiveTarget(id);
    setArchiveModalOpen(true);
  }

  async function confirmArchive() {
    setIsArchiving(true);
    try {
      const itemsToArchive = Array.isArray(archiveTarget) ? archiveTarget : [archiveTarget];
      
      if (itemsToArchive.length > 1) {
        const batch = writeBatch(db);
        for (const id of itemsToArchive) {
          const itemRef = doc(db, "items", id);
          batch.update(itemRef, { 
            archived: true,
            archivedAt: Timestamp.now()
          });
        }
        await batch.commit();
      } else {
        const itemRef = doc(db, "items", archiveTarget);
        await updateDoc(itemRef, { 
          archived: true,
          archivedAt: Timestamp.now()
        });
      }
      
      await fetchItems();
      setArchiveModalOpen(false);
      setArchiveTarget(null);
      
      const toastMessage = itemsToArchive.length > 1 ? "Items archived successfully!" : "Item archived successfully!";
      showToast(toastMessage, "success");
    } catch (err) {
      console.error("archive error", err);
      showToast("Failed to archive item(s)", "error");
    } finally {
      setIsArchiving(false);
    }
  }

  async function bulkArchive() {
    if (selectedIds.size === 0) return alert("No items selected");
    setArchiveTarget([...selectedIds]);
    setArchiveModalOpen(true);
  }

  async function bulkRestore() {
    if (selectedIds.size === 0) return alert("No items selected");
    setRestoreTarget([...selectedIds]);
    setRestoreModalOpen(true);
  }

  async function confirmRestore() {
    setIsRestoring(true);
    try {
      const batch = writeBatch(db);
      const itemsToRestore = Array.isArray(restoreTarget) ? restoreTarget : [restoreTarget];
      
      for (const id of itemsToRestore) {
        const itemRef = doc(db, "items", id);
        batch.update(itemRef, { 
          archived: false,
          restoredAt: Timestamp.now()
        });
      }

      await batch.commit();
      await fetchItems();
      setRestoreModalOpen(false);
      setRestoreTarget(null);
      
      const toastMessage = itemsToRestore.length > 1 ? "Items restored successfully!" : "Item restored successfully!";
      showToast(toastMessage, "success");
    } catch (err) {
      console.error("restore error", err);
      showToast("Failed to restore items", "error");
    } finally {
      setIsRestoring(false);
    }
  }

  function bulkRestoreSingle(id) {
    setRestoreTarget(id);
    setRestoreModalOpen(true);
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return alert("No items selected");
    setDeleteTarget([...selectedIds]);
    setIsBulkDelete(true);
    setModalOpen(true);
  }

  function handleDeleteSingle(id) {
    setDeleteTarget(id);
    setIsBulkDelete(false);
    setModalOpen(true);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (filteredItems.length > 0 && prev.size === filteredItems.length) {
        return new Set();
      } else {
        return new Set(filteredItems.map((i) => i.id));
      }
    });
  }

  useEffect(() => {
    fetchItems();
    fetchStatusOptions();
    fetchCategories();
  }, []);

  const totalItems = items.length;
  const activeItems = items.filter((i) => !i.archived).length;
  const pending = items.filter((i) => !i.archived && (i.status_name?.toLowerCase() === "pending" || (typeof i.status === "string" && i.status.toLowerCase() === "pending"))).length;
  const matched = items.filter((i) => !i.archived && i.status_name?.toLowerCase() === "matched").length;
  const forPickup = items.filter((i) => !i.archived && i.status_name?.toLowerCase() === "verified").length;
  const claimed = items.filter((i) => !i.archived && i.status_name?.toLowerCase() === "claimed").length;

  const getDisplayName = (item) => item.item_name || item.item_names || "Unnamed";

  function bulkResolveSelectedSingle(id) {
    setResolveTarget(id);
    setResolveModalOpen(true);
  }

  const handleToggleArchived = useCallback(() => {
    setShowArchived(prev => !prev);
  }, []);

  return (
    <div className="container-fluid py-4" style={{ backgroundColor: "#fff8e6", minHeight: "100vh", paddingLeft: "2rem", paddingRight: "2rem" }}>
      {showToastNotif && (
        <div 
          className={`position-fixed top-0 start-50 translate-middle-x mt-3 alert ${toastType === 'success' ? 'alert-success' : 'alert-danger'} shadow-lg`}
          style={{ zIndex: 9999, minWidth: '300px' }}
          role="alert"
        >
          <div className="d-flex align-items-center">
            <span className="me-2">{toastType === 'success' ? '✓' : '✗'}</span>
            <strong>{toastMessage}</strong>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h1 className="display-4 fw-bold" style={{ color: "#263054" }}>Item Management</h1>
        <p className="lead text-muted fs-4">Manage all lost and found items - review, edit, and resolve items</p>
      </div>

      <div className="row g-4 mb-4">
          <div className="col-12 col-sm-6 col-lg">
            <div className="card shadow-sm border-0 h-100" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
              <div className="card-body text-center text-white position-relative overflow-hidden">
                <div className="position-absolute top-0 end-0 mt-2 me-2 opacity-25" style={{ fontSize: "60px" }}>📦</div>
                <div className="position-relative" style={{ zIndex: 1 }}>
                  <h2 className="display-4 fw-bold mb-0">{activeItems}</h2>
                  <p className="text-uppercase small fw-semibold mb-0 opacity-75">Active Items</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg">
            <div className="card shadow-sm border-0 h-100" style={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}>
              <div className="card-body text-center text-white position-relative overflow-hidden">
                <div className="position-absolute top-0 end-0 mt-2 me-2 opacity-25" style={{ fontSize: "60px" }}>⏳</div>
                <div className="position-relative" style={{ zIndex: 1 }}>
                  <h2 className="display-4 fw-bold mb-0">{pending}</h2>
                  <p className="text-uppercase small fw-semibold mb-0 opacity-75">Pending</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg">
            <div className="card shadow-sm border-0 h-100" style={{ background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}>
              <div className="card-body text-center text-white position-relative overflow-hidden">
                <div className="position-absolute top-0 end-0 mt-2 me-2 opacity-25" style={{ fontSize: "60px" }}>🔗</div>
                <div className="position-relative" style={{ zIndex: 1 }}>
                  <h2 className="display-4 fw-bold mb-0">{matched}</h2>
                  <p className="text-uppercase small fw-semibold mb-0 opacity-75">Matched</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg">
            <div className="card shadow-sm border-0 h-100" style={{ background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" }}>
              <div className="card-body text-center text-white position-relative overflow-hidden">
                <div className="position-absolute top-0 end-0 mt-2 me-2 opacity-25" style={{ fontSize: "60px" }}>🎯</div>
                <div className="position-relative" style={{ zIndex: 1 }}>
                  <h2 className="display-4 fw-bold mb-0">{forPickup}</h2>
                  <p className="text-uppercase small fw-semibold mb-0 opacity-75">For Pickup</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg">
            <div className="card shadow-sm border-0 h-100" style={{ background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" }}>
              <div className="card-body text-center text-white position-relative overflow-hidden">
                <div className="position-absolute top-0 end-0 mt-2 me-2 opacity-25" style={{ fontSize: "60px" }}>✅</div>
                <div className="position-relative" style={{ zIndex: 1 }}>
                  <h2 className="display-4 fw-bold mb-0">{claimed}</h2>
                  <p className="text-uppercase small fw-semibold mb-0 opacity-75">Claimed</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm mb-4 border-0">
          <div className="card-body p-4">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-6 col-lg-auto">
                <label className="form-label fw-semibold mb-2">Type</label>
                <select className="form-select" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                  <option>All</option>
                  <option>Lost</option>
                  <option>Found</option>
                </select>
              </div>
              <div className="col-12 col-md-6 col-lg-auto">
                <label className="form-label fw-semibold mb-2">Status</label>
                <select className="form-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option>All</option>
                  <option>Pending</option>
                  <option>Matched</option>
                  <option>Verified</option>
                  <option>Claimed</option>
                </select>
              </div>
              <div className="col-12 col-md-6 col-lg-auto">
                <label className="form-label fw-semibold mb-2">Category</label>
                <select className="form-select" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                  <option>All</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.cat_name || cat.name || cat.id}>
                      {cat.cat_name || cat.name || cat.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-lg">
                <label className="form-label fw-semibold mb-2">Search</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="🔍 Search by item name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="col-12 col-lg-auto">
                <button className="btn btn-outline-primary w-100" onClick={handleToggleArchived}>
                  {showArchived ? "View Active Items" : "View Archived"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm mb-4 border-0">
          <div className="card-body p-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="selectAllCheck"
                  checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                  onChange={toggleSelectAll}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }}
                />
                <label className="form-check-label fw-semibold ms-2" htmlFor="selectAllCheck">
                  Select All {selectedIds.size > 0 && <span className="badge bg-primary ms-2">{selectedIds.size} selected</span>}
                </label>
              </div>
              <div className="d-flex gap-2">
                {!showArchived ? (
                  <>
                    <button onClick={bulkResolve} className="btn btn-success" disabled={selectedIds.size === 0}>
                      ✓ Bulk Resolve
                    </button>
                    <button onClick={bulkArchive} className="btn btn-danger" disabled={selectedIds.size === 0}>
                      📦 Bulk Archive
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={bulkRestore} className="btn btn-success" disabled={selectedIds.size === 0}>
                      ↺ Bulk Restore
                    </button>
                    <button onClick={handleBulkDelete} className="btn btn-danger" disabled={selectedIds.size === 0}>
                      🗑 Delete Selected
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {showArchived && (
          <div className="alert alert-info mb-4">
            <strong>Viewing Archived Items:</strong> These items have been archived. You can restore them back to active status or permanently delete them.
          </div>
        )}

        <div className="row g-4" key={showArchived ? 'archived-view' : 'active-view'}>
      {loading ? (
        <div className="col-12 text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : filteredItems.length > 0 ? (
        filteredItems.map((item) => {
          const safeType = item.type_name 
            ? safeString(item.type_name, "Unknown")
            : safeString(item.type, "Unknown");

          const safeCategory = item.category_name 
            ? safeString(item.category_name, "N/A")
            : safeString(item.category, "N/A");

          const safeStatus = item.status_name 
            ? safeString(item.status_name, "Unknown")
            : safeString(item.status, "Unknown");

          const safeUser = safeString(item.user_name || item.user, "Unknown");
          const safeLocation = safeString(item.location, "N/A");
          const safeDescription = safeString(item.description, "No description");

          return (
            <div key={`${item.id}-${showArchived}`} className="col-12 col-md-6 col-xl-4">
              <div className="card h-100 shadow-sm border-0 overflow-hidden">
                <div className="position-relative">
                  <div
                    className={`badge position-absolute top-0 start-0 m-3 ${
                      safeType.toLowerCase() === "lost" ? "bg-danger" : "bg-success"
                    } d-flex align-items-center gap-2 shadow-sm`}
                    style={{ fontSize: "14px", padding: "8px 12px", zIndex: 10 }}
                  >
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "20px",
                        height: "20px",
                        backgroundColor: "#fff",
                        borderRadius: "4px",
                        cursor: "pointer",
                        border: "2px solid #fff",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                    >
                      {selectedIds.has(item.id) && (
                        <span
                          style={{
                            color: safeType.toLowerCase() === "lost" ? "#dc3545" : "#198754",
                            fontSize: "16px",
                            fontWeight: "bold",
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-uppercase fw-semibold">{safeType}</span>
                  </div>

                  {showArchived && (
                    <div
                      className="badge position-absolute top-0 end-0 m-3 bg-secondary shadow-sm"
                      style={{ fontSize: "14px", padding: "8px 12px", zIndex: 10 }}
                    >
                      <span className="text-uppercase fw-semibold">ARCHIVED</span>
                    </div>
                  )}

                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      className="card-img-top"
                      alt={getDisplayName(item)}
                      style={{ height: "220px", objectFit: "cover" }}
                      onError={(e) => {
                        e.target.style.display = "none";
                        const placeholder = document.createElement("div");
                        placeholder.className =
                          "d-flex align-items-center justify-content-center text-muted";
                        placeholder.style.cssText =
                          "height: 220px; background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); font-size: 48px;";
                        placeholder.textContent = "📦";
                        e.target.parentNode.appendChild(placeholder);
                      }}
                    />
                  ) : (
                    <div
                      className="d-flex align-items-center justify-content-center text-muted"
                      style={{
                        height: "220px",
                        background: "linear-gradient(135deg, #667eea20 0%, #764ba220 100%)",
                        fontSize: "48px",
                      }}
                    >
                      📦
                    </div>
                  )}
                </div>

                <div className="card-body p-4">
                  <h5
                    className="card-title fw-bold mb-3"
                    style={{ color: "#2c3e50", fontSize: "18px" }}
                  >
                    {getDisplayName(item)}
                  </h5>
                  <div className="small" style={{ lineHeight: "1.8" }}>
                    <div className="mb-2">
                      <span className="text-muted d-inline-block" style={{ width: "90px" }}>
                        Description:
                      </span>
                      <span className="fw-medium">{safeDescription}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-muted d-inline-block" style={{ width: "90px" }}>
                        Reporter:
                      </span>
                      <span className="fw-medium">{safeUser}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-muted d-inline-block" style={{ width: "90px" }}>
                        Location:
                      </span>
                      <span className="fw-medium">📍 {safeLocation}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-muted d-inline-block" style={{ width: "90px" }}>
                        Category:
                      </span>
                      <span className="badge bg-light text-dark">{safeCategory}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-muted d-inline-block" style={{ width: "90px" }}>
                        Status:
                      </span>
                      <span
                        className={`badge ${
                          safeStatus.toLowerCase() === "pending"
                            ? "bg-warning text-dark"
                            : safeStatus.toLowerCase() === "matched"
                            ? "bg-info"
                            : safeStatus.toLowerCase() === "for pickup"
                            ? "bg-primary"
                            : safeStatus.toLowerCase() === "claimed"
                            ? "bg-success"
                            : "bg-secondary"
                        }`}
                      >
                        {safeStatus}
                      </span>
                    </div>
                    <div className="mb-0">
                      <span className="text-muted d-inline-block" style={{ width: "90px" }}>
                        Date:
                      </span>
                      <span className="fw-medium">
                        {item.date_lost_found
                          ? item.date_lost_found.seconds
                            ? new Date(item.date_lost_found.seconds * 1000).toLocaleDateString()
                            : new Date(item.date_lost_found).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {!showArchived ? (
                  <div className="card-footer bg-white border-0 p-3">
                    <div className="d-grid gap-2">
                      <div className="row g-2">
                        <div className="col-4">
                          <button
                            className="btn btn-outline-success w-100"
                            onClick={() => bulkResolveSelectedSingle(item.id)}
                          >
                            ✓ Resolve
                          </button>
                        </div>
                        <div className="col-4">
                          <button
                            className="btn btn-outline-primary w-100"
                            onClick={() => openEditModal(item)}
                          >
                            ✎ Edit
                          </button>
                        </div>
                        <div className="col-4">
                          <button
                            className="btn btn-outline-danger w-100"
                            onClick={() => openArchiveModal(item.id)}
                          >
                            📦 Archive
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card-footer bg-white border-0 p-3">
                    <div className="d-grid gap-2">
                      <button
                        className="btn btn-success w-100"
                        onClick={() => bulkRestoreSingle(item.id)}
                      >
                        ↺ Restore to Active
                      </button>
                      <button
                        className="btn btn-outline-danger w-100"
                        onClick={() => handleDeleteSingle(item.id)}
                      >
                        🗑 Delete Permanently
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="col-12">
          <div className="alert alert-info text-center">
            {showArchived ? "No archived items found" : "No items found"}
          </div>
        </div>
      )}
    </div>

      {!showArchived && (
        <button
          className="btn btn-success rounded-circle position-fixed shadow-lg"
          style={{ 
            bottom: "32px", 
            right: "32px", 
            width: "64px", 
            height: "64px", 
            fontSize: "28px",
            zIndex: 1000
          }}
          onClick={() => setAddModalOpen(true)}
        >
          +
        </button>
      )}

      {resolveModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} key="resolve-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-success text-white">
                <h5 className="modal-title fw-bold">✓ Confirm Resolve</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setResolveModalOpen(false)}></button>
              </div>
              <div className="modal-body pt-3">
                <p className="mb-0">
                  {Array.isArray(resolveTarget) && resolveTarget.length > 1
                    ? `Are you sure you want to mark ${resolveTarget.length} selected items as resolved?`
                    : "Are you sure you want to mark this item as resolved?"}
                </p>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setResolveModalOpen(false)} disabled={isResolving}>
                  Cancel
                </button>
                <button type="button" className="btn btn-success" onClick={confirmResolve} disabled={isResolving}>
                  {isResolving ? "Resolving..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {archiveModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} key="archive-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-danger text-white">
                <h5 className="modal-title fw-bold">📦 Confirm Archive</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setArchiveModalOpen(false)}></button>
              </div>
              <div className="modal-body pt-3">
                <p className="mb-0">
                  {Array.isArray(archiveTarget) && archiveTarget.length > 1
                    ? `Are you sure you want to archive ${archiveTarget.length} selected items? The items will be moved to the archived section while keeping their current status.`
                    : "Are you sure you want to archive this item? It will be moved to the archived section while keeping its current status."}
                </p>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setArchiveModalOpen(false)} disabled={isArchiving}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmArchive} disabled={isArchiving}>
                  {isArchiving ? "Archiving..." : "Confirm Archive"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {restoreModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} key="restore-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-success text-white">
                <h5 className="modal-title fw-bold">↺ Confirm Restore</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setRestoreModalOpen(false)}></button>
              </div>
              <div className="modal-body pt-3">
                <p className="mb-0">
                  {Array.isArray(restoreTarget) && restoreTarget.length > 1
                    ? `Are you sure you want to restore ${restoreTarget.length} selected items to active status?`
                    : "Are you sure you want to restore this item to active status?"}
                </p>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setRestoreModalOpen(false)} disabled={isRestoring}>
                  Cancel
                </button>
                <button type="button" className="btn btn-success" onClick={confirmRestore} disabled={isRestoring}>
                  {isRestoring ? "Restoring..." : "Confirm Restore"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} key="add-modal">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Add New Item</h5>
                <button type="button" className="btn-close" onClick={() => setAddModalOpen(false)}></button>
              </div>
              <form onSubmit={handleAddItem}>
                <div className="modal-body pt-2">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-semibold">Item Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter item name"
                        value={newItem.item_name}
                        onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Category</label>
                      <select
                        className="form-select"
                        value={newItem.category}
                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                        required
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.cat_name || c.name || c.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Type</label>
                      <select
                        className="form-select"
                        value={newItem.type}
                        onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                      >
                        <option>Lost</option>
                        <option>Found</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Location <span className="text-muted">(Optional)</span></label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter location (optional)"
                        value={newItem.location}
                        onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={newItem.date_lost_found}
                        onChange={(e) => setNewItem({ ...newItem, date_lost_found: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Description</label>
                      <textarea
                        className="form-control"
                        placeholder="Enter description"
                        rows="3"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Upload Image (PNG/JPEG, Max 5MB)</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/png, image/jpeg"
                        onChange={(e) => {
                          const f = e.target.files && e.target.files[0];
                          setImageFile(f || null);
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-secondary" onClick={() => { setAddModalOpen(false); setImageFile(null); }}>Cancel</button>
                  <button type="submit" className="btn btn-success">Add Item</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} key="delete-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0 bg-danger text-white">
                <h5 className="modal-title fw-bold">⚠️ Confirm Deletion</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalOpen(false)}></button>
              </div>
              <div className="modal-body pt-3">
                <p className="mb-0">
                  {isBulkDelete
                    ? `Are you sure you want to permanently delete ${deleteTarget.length} selected items? This action cannot be undone.`
                    : "Are you sure you want to permanently delete this item? This action cannot be undone."}
                </p>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={confirmDelete}>Delete Permanently</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} key="edit-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Edit Item</h5>
                <button type="button" className="btn-close" onClick={() => setEditModalOpen(false)}></button>
              </div>
              <div className="modal-body pt-2">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Item Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="item_name"
                    value={editForm.item_name}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Category</label>
                  <select
                    className="form-select"
                    name="category"
                    value={editForm.category}
                    onChange={handleEditChange}
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cat_name || c.name || c.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Description</label>
                  <textarea
                    className="form-control"
                    name="description"
                    rows="3"
                    value={editForm.description}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    name="location"
                    value={editForm.location}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Status</label>
                  <select
                    className="form-select"
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                  >
                    {statusOptions.length > 0 ? (
                      <>
                        <option value="">Select status</option>
                        {statusOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.status_name || s.name || s.id}
                          </option>
                        ))}
                        {editItem?.archived && <option value="archived">Archived</option>}
                      </>
                    ) : (
                      <>
                        <option>Pending</option>
                        <option>Matched</option>
                        {editItem?.archived && <option>Archived</option>}
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}