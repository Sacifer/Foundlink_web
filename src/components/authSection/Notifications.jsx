import React, { useState, useEffect } from 'react';
import { ListGroup, Badge, Modal, Button, Image, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import AuthSidebar from './AuthSidebar.jsx';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

function Notifications() {
  const navigate = useNavigate();
  const auth = getAuth();

  const [aiMatches, setAiMatches] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [combined, setCombined] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userId, setUserId] = useState('');
  const [readAiMatches, setReadAiMatches] = useState([]);
  const [toast, setToast] = useState(null);

  // Status IDs
  const MATCHED_STATUS_ID = 'Status2';
  const VERIFIED_STATUS_ID = 'Status4';

  // Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Get current user
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
      else {
        setUserId('');
        navigate('/login');
      }
    });
    return () => unsubscribeAuth();
  }, [auth, navigate]);

  // Fetch AI matches for the logged-in user (status Matched or Verified)
  useEffect(() => {
    if (!userId) return;

    const matchedStatusRef = doc(db, 'status', MATCHED_STATUS_ID);
    const verifiedStatusRef = doc(db, 'status', VERIFIED_STATUS_ID);

    const matchesQuery = query(
      collection(db, 'ai_matches'),
      where('status', 'in', [matchedStatusRef, verifiedStatusRef]),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      const userMatches = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, type: 'match', ...docSnap.data() }))
        .filter(match => match.lostItem?.userId === userId || match.foundItem?.userId === userId);
      setAiMatches(userMatches);
    });

    return () => unsubscribeMatches();
  }, [userId]);

  // Fetch normal notifications
  useEffect(() => {
    if (!userId) return;

    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeNotifs = onSnapshot(notifQuery, (snapshot) => {
      const notifs = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        // If the notification has type 'match', keep it as 'match', otherwise mark as 'notif'
        return { 
          id: docSnap.id, 
          type: data.type === 'match' ? 'match' : 'notif', 
          ...data 
        };
      });
      setNotifications(notifs);
    });

    return () => unsubscribeNotifs();
  }, [userId]);

  // Merge & sort combined list
  useEffect(() => {
    const combinedList = [...aiMatches, ...notifications].sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date();
      const bTime = b.createdAt?.toDate?.() || new Date();
      return bTime - aTime;
    });
    setCombined(combinedList);
  }, [aiMatches, notifications]);

  // Open modal
  const handleOpenModal = async (item) => {
    setSelectedItem(item);
    setShowModal(true);

    if (item.type === 'notif' && !item.read) {
      try {
        await updateDoc(doc(db, 'notifications', item.id), { read: true });
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }

    if (item.type === 'match') setReadAiMatches(prev => [...prev, item.id]);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setShowModal(false);
  };

  // Verify AI match
  const handleVerify = async (match) => {
    if (!match) return;
    try {
      const verifiedStatusRef = doc(db, 'status', VERIFIED_STATUS_ID);
      
      // Update items status
      if (match.lostItemId) {
        await updateDoc(doc(db, 'items', match.lostItemId), { status: verifiedStatusRef });
      }
      if (match.foundItemId) {
        await updateDoc(doc(db, 'items', match.foundItemId), { status: verifiedStatusRef });
      }
      
      // Update ai_match status if it exists in ai_matches collection
      if (match.matchId) {
        const aiMatchRef = doc(db, 'ai_matches', match.matchId);
        await updateDoc(aiMatchRef, { status: verifiedStatusRef });
      }
      
      // Mark notification as read
      await updateDoc(doc(db, 'notifications', match.id), { read: true });
      
      showToast('Match verified successfully!', 'success');
      setShowModal(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Error verifying match:', err);
      showToast('Failed to verify match: ' + err.message, 'danger');
    }
  };

  // Deny AI match
  const handleDeny = async (match) => {
    if (!match) return;
    try {
      const pendingStatusRef = doc(db, 'status', 'Status1');
      if (match.lostItemId) await updateDoc(doc(db, 'items', match.lostItemId), { status: pendingStatusRef });
      if (match.foundItemId) await updateDoc(doc(db, 'items', match.foundItemId), { status: pendingStatusRef });
      await deleteDoc(doc(db, 'ai_matches', match.id));
      showToast('Match denied and items reverted to pending', 'success');
      setShowModal(false);
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to deny match', 'danger');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Outfit, sans-serif', background: 'linear-gradient(180deg, rgba(255, 223, 0, 0.15) 0%, rgba(255, 255, 255, 1) 100%)' }}>
      <AuthSidebar activePage="notifications" />
      <div style={{ flex: 1, padding: '2rem', marginLeft: '240px' }}>
        <div className="d-flex align-items-center mb-4" style={{ cursor: 'pointer' }} onClick={() => navigate('/student-dashboard')}>
          <FiArrowLeft size={24} className="me-3" />
          <h2 style={{ color: 'var(--bs-primary-custom)', margin: 0 }}>Notifications</h2>
        </div>

        <ListGroup>
          {combined.length === 0 && <p className="text-muted">No notifications or matches yet.</p>}
          {combined.map(item => {
            if (item.type === 'match') {
              const isOwnerLost = item.lostItem?.userId === userId;
              const matchItem = isOwnerLost ? item.lostItem : item.foundItem;
              const isNew = !readAiMatches.includes(item.id);
              return (
                <ListGroup.Item key={item.id} action onClick={() => handleOpenModal(item)} className="d-flex justify-content-between align-items-start">
                  <div className="ms-2 me-auto">
                    <div style={{ fontWeight: '700' }}>Your item "{matchItem?.item_name}" has been matched!</div>
                    <small className="text-muted">Confidence: {item.confidence}%</small>
                  </div>
                  {isNew && <Badge bg="success" pill>New</Badge>}
                </ListGroup.Item>
              );
            } else if (item.type === 'notif') {
              return (
                <ListGroup.Item key={item.id} action onClick={() => handleOpenModal(item)} className="d-flex justify-content-between align-items-start">
                  <div className="ms-2 me-auto">
                    <div style={{ fontWeight: item.read ? '400' : '700' }}>{item.title}</div>
                    <small className="text-muted">{item.message}</small>
                  </div>
                  {!item.read && <Badge bg="primary" pill>New</Badge>}
                </ListGroup.Item>
              );
            }
            return null;
          })}
        </ListGroup>

        {/* Floating Toast */}
        {toast && (
          <div
            className={`position-fixed top-0 end-0 m-3 alert alert-${toast.type} alert-dismissible fade show`}
            role="alert"
            style={{
              zIndex: 9999,
              minWidth: '300px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              animation: 'slideInRight 0.3s ease-out'
            }}
          >
            <strong>{toast.message}</strong>
            <button type="button" className="btn-close" onClick={() => setToast(null)}></button>
          </div>
        )}

        <Modal show={showModal} onHide={handleCloseModal} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{selectedItem?.type === 'match' ? 'Match Details' : selectedItem?.title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedItem?.type === 'match' ? (
              <>
                <div className="mb-3">
                  <p className="text-muted mb-3">
                    Your item(s) has/have been matched. Please review the details below and verify if this is a correct match.
                  </p>
                </div>
                <Row className="g-3">
                  <Col md={6}>
                    <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
                      <h6 className="text-primary mb-3">Lost Item</h6>
                      <p><strong>{selectedItem.lostItem?.item_name || 'N/A'}</strong></p>
                      <p className="text-muted small">{selectedItem.lostItem?.description || 'No description'}</p>
                      {selectedItem.lostItem?.image_url ? (
                        <Image src={selectedItem.lostItem.image_url} fluid rounded style={{ maxHeight: '200px', objectFit: 'cover' }} />
                      ) : (
                        <div className="text-center p-3 bg-light rounded">
                          <p className="text-muted mb-0">No image available</p>
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col md={6}>
                    <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
                      <h6 className="text-success mb-3">Found Item</h6>
                      <p><strong>{selectedItem.foundItem?.item_name || 'N/A'}</strong></p>
                      <p className="text-muted small">{selectedItem.foundItem?.description || 'No description'}</p>
                      {selectedItem.foundItem?.image_url ? (
                        <Image src={selectedItem.foundItem.image_url} fluid rounded style={{ maxHeight: '200px', objectFit: 'cover' }} />
                      ) : (
                        <div className="text-center p-3 bg-light rounded">
                          <p className="text-muted mb-0">No image available</p>
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col xs={12}>
                    <div className="alert alert-info mb-0">
                      <strong>Match Confidence:</strong> {selectedItem.confidence}%
                    </div>
                  </Col>
                </Row>
              </>
            ) : (
              <p>{selectedItem?.message}</p>
            )}
          </Modal.Body>
          <Modal.Footer className="d-flex justify-content-between">
            {selectedItem?.type === 'match' ? (
              <>
                <Button variant="danger" onClick={() => handleDeny(selectedItem)} size="lg">
                  Deny Match
                </Button>
                <Button variant="success" onClick={() => handleVerify(selectedItem)} size="lg">
                  Verify Match
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
            )}
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
}

export default Notifications;