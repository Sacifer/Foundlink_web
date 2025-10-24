import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Form, Button, Card, Alert, Badge, Modal } from 'react-bootstrap'
import { FaBox, FaSearch, FaCheckCircle, FaBell } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import AuthSidebar from './AuthSidebar.jsx'
import noImage from '../../assets/noimage.png'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

function StudentDashboard() {
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('yourReports');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [userReports, setUserReports] = useState([]);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });
  const [notifications, setNotifications] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const auth = getAuth();
  const navigate = useNavigate();
  const storage = getStorage();

  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

  // Fetch user data (username and userId) based on auth.currentUser
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Set userId from Firebase Auth currentUser
          setUserId(user.uid);
          
          // Fetch username from Firestore users collection
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUsername(userData.username?.trim() || 'Student');
          } else {
            setUsername('Student');
          }
          
          console.log('User authenticated:', {
            uid: user.uid,
            email: user.email,
            username: userDocSnap.exists() ? userDocSnap.data().username : 'N/A'
          });
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUsername('Student');
        }
      } else {
        // User is logged out
        setUserId('');
        setUsername('');
      }
    });
    return () => unsubscribeAuth();
  }, [auth]);

  // Fetch user's items based on userId (from auth.currentUser)
  useEffect(() => {
    if (!auth.currentUser || !userId) return;
    
    console.log('Fetching items for userId:', userId);
    
    const q = query(collection(db, 'items'), where('userId', '==', userId));
    
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      console.log('Found', querySnapshot.size, 'items for user');
      
      const itemsPromises = [];
      querySnapshot.forEach((docSnap) => {
        const itemData = { id: docSnap.id, ...docSnap.data() };
        const promises = [];
        
        if (itemData.status && itemData.status.path) {
          promises.push(
            getDoc(itemData.status).then(statusDoc => {
              itemData.statusValue = statusDoc.exists() ? statusDoc.data().status_name : 'Pending';
            })
          );
        }
        
        if (itemData.category && itemData.category.path) {
          promises.push(
            getDoc(itemData.category).then(catDoc => {
              itemData.categoryValue = catDoc.exists() ? catDoc.data().cat_name : '';
            })
          );
        }
        
        itemsPromises.push(
          Promise.all(promises).then(() => itemData)
        );
      });
      
      const items = await Promise.all(itemsPromises);
      setUserReports(items);
    }, (error) => {
      console.error('Error fetching items:', error);
    });
    
    return () => unsubscribe();
  }, [auth.currentUser, userId]);

  // Fetch unread notifications for logged-in user
  useEffect(() => {
    if (!auth.currentUser || !userId) return;
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      // Filter out match type notifications (those are in ai_matches)
      const unreadCount = querySnapshot.docs.filter(doc => 
        doc.data().type !== 'match'
      ).length;
      setNotifications(unreadCount);
    });
    
    return () => unsubscribe();
  }, [auth.currentUser, userId]);

  const tabs = {
    yourReports: 'Your Reports',
    pending: 'Pending',
    claimed: 'Claimed',
    matched: 'Matched',
  };

  const filteredItems = userReports.filter((item) => {
    const matchesTab = tab === 'yourReports' ? true : (item.statusValue || 'Pending') === capitalize(tab);
    const matchesSearch = item.item_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant: '' }), 5000);
  };

  const handleEdit = () => {
    if (!selectedItem) return;
    setIsEditing(true);
    
    setEditValues({
      item_name: selectedItem.item_name || '',
      description: selectedItem.description || '',
      location: selectedItem.location || '',
      image_url: selectedItem.image_url || '',
      categoryValue: selectedItem.categoryValue || '',
    });
  };

  const handleImageUpload = async (file) => {
    if (!file || !selectedItem) return;
    const fileRef = ref(storage, `item_images/${selectedItem.id}_${file.name}`);
    try {
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setEditValues((prev) => ({ ...prev, image_url: url }));
      showAlert('Image uploaded successfully.', 'success');
    } catch (error) {
      console.error('Error uploading image:', error);
      showAlert('Failed to upload image.', 'danger');
    }
  };

  const saveEdit = async () => {
    if (!selectedItem) return;

    try {
      const updateData = {
        item_name: editValues.item_name,
        description: editValues.description,
        location: editValues.location,
        image_url: editValues.image_url,
      };
      
      // Handle category if changed
      if (editValues.categoryValue !== selectedItem.categoryValue) {
        // Map category names to Firestore references
        const categoryMap = {
          'Electronics': doc(db, 'categories', 'Cat1'),
          'Personal Items': doc(db, 'categories', 'Cat2'),
          'Accessories': doc(db, 'categories', 'Cat3'),
          'Documents': doc(db, 'categories', 'Cat4'),
          'Others': doc(db, 'categories', 'Cat5'),
        };
        if (categoryMap[editValues.categoryValue]) {
          updateData.category = categoryMap[editValues.categoryValue];
        }
      }
      
      await updateDoc(doc(db, 'items', selectedItem.id), updateData);
      
      // Update local state
      const updatedItem = { 
        ...selectedItem, 
        ...editValues
      };
      setSelectedItem(updatedItem);
      setUserReports((prev) =>
        prev.map((item) => (item.id === selectedItem.id ? updatedItem : item))
      );
      
      showAlert('Report updated successfully.', 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating item:', error);
      showAlert('Failed to update report.', 'danger');
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      await deleteDoc(doc(db, 'items', selectedItem.id));
      showAlert('Report deleted successfully.', 'success');
      setSelectedItem(null);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting item:', error);
      showAlert('Failed to delete report.', 'danger');
      setShowDeleteModal(false);
    }
  };

  const handleMarkClaimed = async () => {
    if (!selectedItem) return;
    try {
      const claimedStatusRef = doc(db, 'status', 'Status3');
      await updateDoc(doc(db, 'items', selectedItem.id), { status: claimedStatusRef });
      showAlert('Report marked as claimed.', 'success');
      setSelectedItem(null);
    } catch (error) {
      console.error('Error marking as claimed:', error);
      showAlert('Failed to mark as claimed.', 'danger');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(180deg, rgba(255, 223, 0, 0.15) 0%, rgba(255, 255, 255, 1) 100%)' }}>
      <AuthSidebar activePage="student-dashboard"/>
      <div style={{ flex: 1, marginLeft: '240px' }}>
        <Container className="py-5 font-poppins">
          {alert.show && (
            <Alert variant={alert.variant} dismissible onClose={() => setAlert({ show: false, message: '', variant: '' })} className="mb-3">
              {alert.message}
            </Alert>
          )}

          <div className="d-flex justify-content-between align-items-center mb-4 m-3">
            <h2 style={{ color: 'var(--bs-primary-custom)', fontStyle: 'italic' }}>
              Hello, {username}!
            </h2>
            <Button style={{ backgroundColor: 'var(--bs-primary-custom)', border: 'none', color: 'white' }}
              className="position-relative d-flex align-items-center"
              onClick={() => navigate('/notifications')}>
              <FaBell size={18} style={{ marginRight: '6px' }} />
              <span></span>
              {notifications > 0 && (
                <span className="position-absolute" 
                  style={{ 
                    top: '8px', 
                    right: '8px', 
                    width: '10px', 
                    height: '10px', 
                    backgroundColor: '#dc3545', 
                    borderRadius: '50%',
                    border: '2px solid white'
                  }}>
                </span>
              )}
            </Button>
          </div>

          <div className="d-flex justify-content-center align-items-center flex-wrap mb-4" style={{ gap: '6px' }}>
            <Form.Control type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-3"
              style={{ borderWidth: '2px', borderColor: '#dee2e6', maxWidth: '300px' }}
            />
            {Object.entries(tabs).map(([key, label]) => (
              <Button key={key}
                onClick={() => setTab(key)}
                className="rounded-3 fw-medium"
                style={{
                  backgroundColor: tab === key ? 'var(--bs-primary-custom)' : 'white',
                  borderColor: tab === key ? 'var(--bs-primary-custom)' : '#dee2e6',
                  color: tab === key ? 'white' : '#495057',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          <Row xs={1} sm={2} md={3} lg={4} className="g-4">
            {filteredItems.map((item) => (
              <Col key={item.id}>
                <Card onClick={() => { setSelectedItem(item); setIsEditing(false); }}
                  className="h-100 border rounded-4 shadow-sm"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                >
                  <Card.Img variant="top"
                    src={item.image_url && item.image_url.trim() !== '' ? item.image_url : noImage}
                    alt={item.item_name}
                    style={{ height: '180px', objectFit: 'cover', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
                  />
                  <Card.Body className="text-center p-3">
                  <Card.Text className="fw-medium text-dark mb-0">{item.item_name}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          {filteredItems.length === 0 && <p className="text-center text-muted mt-4">No items found.</p>}

          {selectedItem && (
            <>
              <Modal show={true} onHide={() => setSelectedItem(null)} centered size="lg">
                <Modal.Header closeButton>
                  <Modal.Title>{selectedItem.item_name}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex flex-wrap">
                  <div style={{ flex: '1 1 200px', marginRight: '20px' }}>
                    <img src={isEditing ? editValues.image_url : selectedItem.image_url || noImage}
                      alt={selectedItem.item_name}
                      style={{ height: '200px', objectFit: 'cover', width: '100%', borderRadius: '8px' }}
                    />
                    {isEditing && selectedItem.statusValue?.toLowerCase() !== 'claimed' && (
                      <Form.Group className="mt-2">
                        <Form.Label>Choose Image</Form.Label>
                        <Form.Control type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e.target.files[0])}
                        />
                      </Form.Group>
                    )}
                  </div>
                  <div style={{ flex: '2 1 300px' }}>
                    {isEditing && selectedItem.statusValue !== 'Claimed' ? (
                      <>
                        <Form.Group className="mb-2">
                          <Form.Label>Item Name</Form.Label>
                          <Form.Control type="text"
                            value={editValues.item_name}
                            onChange={(e) => setEditValues({ ...editValues, item_name: e.target.value })}
                          />
                        </Form.Group>
                        <Form.Group className="mb-2">
                          <Form.Label>Category</Form.Label>
                          <Form.Select
                            value={editValues.categoryValue}
                            onChange={(e) => setEditValues({ ...editValues, categoryValue: e.target.value })}
                          >
                            <option value="">Select Category</option>
                            <option value="Electronics">Electronics</option>
                            <option value="Personal Items">Personal Items</option>
                            <option value="Accessories">Accessories</option>
                            <option value="Documents">Documents</option>
                            <option value="Others">Others</option>
                          </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-2">
                          <Form.Label>Description</Form.Label>
                          <Form.Control as="textarea"
                            rows={3}
                            value={editValues.description}
                            onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                          />
                        </Form.Group>
                        <Form.Group className="mb-2">
                          <Form.Label>Location</Form.Label>
                          <Form.Control type="text"
                            value={editValues.location}
                            onChange={(e) => setEditValues({ ...editValues, location: e.target.value })}
                          />
                        </Form.Group>
                      </>
                    ) : (
                      <>
                        <p><strong>Type:</strong> {selectedItem.type || 'N/A'}</p>
                        <p><strong>Status:</strong> {selectedItem.statusValue || 'Pending'}</p>
                        <p><strong>Category:</strong> {selectedItem.categoryValue || 'N/A'}</p>
                        <p><strong>Description:</strong> {selectedItem.description || 'N/A'}</p>
                        <p><strong>Date {selectedItem.type === 'Found' ? 'Found' : 'Lost'}:</strong>{' '}
                          {selectedItem.date_lost_found?.toDate ? 
                            selectedItem.date_lost_found.toDate().toLocaleDateString() : 
                            selectedItem.date_lost_found || 'N/A'}</p>
                        <p><strong>Location:</strong> {selectedItem.location || 'N/A'}</p>
                      </>
                    )}
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  {selectedItem.statusValue === 'Claimed' ? (
                    <Button variant="danger" onClick={() => setShowDeleteModal(true)}>Delete</Button>
                  ) : isEditing ? (
                    <Button variant="primary" onClick={saveEdit}>Save</Button>
                  ) : (
                    <>
                      <Button variant="primary" onClick={handleEdit}>Edit</Button>
                      <Button variant="danger" onClick={() => setShowDeleteModal(true)}>Delete</Button>
                    </>
                  )}
                </Modal.Footer>
              </Modal>

              {/* Delete Confirmation Modal */}
              <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
                <Modal.Header closeButton>
                  <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <p>Are you sure you want to delete this item report?</p>
                  <p className="text-muted mb-0">This action cannot be undone.</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={handleDelete}>
                    Delete
                  </Button>
                </Modal.Footer>
              </Modal>
            </>
          )}
        </Container>
      </div>
    </div>
  );
}

export default StudentDashboard