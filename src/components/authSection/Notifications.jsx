import React, { useState, useEffect } from 'react'
import { ListGroup, Badge, Modal, Button, Card } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import AuthSidebar from './AuthSidebar.jsx'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'

const STATUS_FOR_PICKUP = '/status/Status4' // Firestore reference to Status4

function Notifications() {
  const navigate = useNavigate()
  const auth = getAuth()

  const [userId, setUserId] = useState('')
  const [notifications, setNotifications] = useState([])
  const [aiMatches, setAiMatches] = useState([])
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [showModal, setShowModal] = useState(false)

  // Get current user ID
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid)
      } else {
        setUserId('')
        navigate('/login')
      }
    })
    return () => unsubscribeAuth()
  }, [auth, navigate])

  // Fetch normal notifications
  useEffect(() => {
    if (!userId) return

    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )

    const unsubscribeNotif = onSnapshot(notifQuery, (snapshot) => {
      const notifs = snapshot.docs.map(docSnap => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          title: data.title || 'Notification',
          message: data.message || '',
          read: data.read || false,
          timestamp: data.createdAt?.toDate
            ? data.createdAt.toDate().toLocaleString()
            : 'N/A',
          type: 'normal' // mark type for rendering
        }
      })
      setNotifications(notifs)
    })

    return () => unsubscribeNotif()
  }, [userId])

  // Fetch AI matches related to user's items
  useEffect(() => {
    if (!userId) return

    const unsubscribeMatches = onSnapshot(collection(db, 'ai_matches'), (snapshot) => {
      const matches = snapshot.docs
        .map(docSnap => {
          const data = docSnap.data()
          const ownsLost = data.lostItem?.userId === userId
          const ownsFound = data.foundItem?.userId === userId
          if (!ownsLost && !ownsFound) return null

          const item = ownsLost ? data.lostItem : data.foundItem
          const itemId = ownsLost ? data.lostItemId : data.foundItemId

          return {
            id: docSnap.id,
            item_name: item.item_name,
            description: item.description,
            image_url: item.image_url,
            confidence: data.confidence,
            itemId: itemId,
            type: 'ai_match' // mark type for rendering
          }
        })
        .filter(Boolean)

      setAiMatches(matches)
    })

    return () => unsubscribeMatches()
  }, [userId])

  // Open notification modal
  const handleOpenModal = async (notification) => {
    setSelectedNotification(notification)
    setShowModal(true)

    // Mark normal notification as read
    if (notification.type === 'normal' && !notification.read) {
      try {
        await updateDoc(doc(db, 'notifications', notification.id), { read: true })
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedNotification(null)
  }

  // Claim item function
  const handleClaim = async (match) => {
    try {
      const itemRef = doc(db, 'items', match.itemId)
      await updateDoc(itemRef, { status: STATUS_FOR_PICKUP })
      alert(`Item "${match.item_name}" status updated to For Pickup!`)
      // Optionally remove claimed match from list
      setAiMatches(prev => prev.filter(m => m.id !== match.id))
    } catch (error) {
      console.error('Error claiming item:', error)
      alert('Failed to claim item.')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(180deg, rgba(255, 223, 0, 0.15) 0%, rgba(255, 255, 255, 1) 100%)',
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      <AuthSidebar activePage="notifications" />

      <div style={{ flex: 1, padding: '2rem', marginLeft: '240px' }}>
        <div
          className="d-flex align-items-center mb-4"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/student-dashboard')}
        >
          <FiArrowLeft size={24} className="me-3" />
          <h2 style={{ color: 'var(--bs-primary-custom)', margin: 0 }}>Notifications</h2>
        </div>

        {/* Normal Notifications */}
        <h4>General Notifications</h4>
        <ListGroup className="mb-4">
          {notifications.length === 0 && <p className="text-muted">No notifications available.</p>}
          {notifications.map(n => (
            <ListGroup.Item
              key={n.id}
              action
              onClick={() => handleOpenModal(n)}
              className="d-flex justify-content-between align-items-start"
            >
              <div className="ms-2 me-auto">
                <div style={{ fontWeight: !n.read ? '700' : '400', color: !n.read ? '#000' : '#00000080' }}>
                  {n.title}
                </div>
                <small className="text-muted">{n.timestamp}</small>
              </div>
              {!n.read && <Badge bg="primary" pill>New</Badge>}
            </ListGroup.Item>
          ))}
        </ListGroup>

        {/* AI Match Notifications */}
        <h4>AI Matches</h4>
        {aiMatches.length === 0 && <p className="text-muted">No AI matches for your items.</p>}
        <div className="row g-4">
          {aiMatches.map(match => (
            <div key={match.id} className="col-md-4">
              <Card>
                <Card.Img
                  variant="top"
                  src={match.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}
                  style={{ height: '200px', objectFit: 'cover' }}
                />
                <Card.Body>
                  <Card.Title>{match.item_name}</Card.Title>
                  <Card.Text>{match.description}</Card.Text>
                  <Card.Text>
                    <strong>Match Confidence:</strong> {match.confidence}%
                  </Card.Text>
                  <Button variant="success" onClick={() => handleClaim(match)}>Claim</Button>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>

        {/* Modal for normal notifications */}
        <Modal show={showModal} onHide={handleCloseModal} centered>
          <Modal.Header closeButton>
            <Modal.Title>{selectedNotification?.title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>{selectedNotification?.message}</p>
            <small className="text-muted">{selectedNotification?.timestamp}</small>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  )
}

export default Notifications
