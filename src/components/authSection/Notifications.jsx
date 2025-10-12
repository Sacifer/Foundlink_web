import React, { useState, useEffect } from 'react'
import { ListGroup, Badge, Modal, Button } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import AuthSidebar from './AuthSidebar.jsx'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'

function Notifications() {
  const navigate = useNavigate()
  const auth = getAuth()

  const [notifications, setNotifications] = useState([])
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [userId, setUserId] = useState('')

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

  // Fetch notifications from Firestore
  useEffect(() => {
    if (!userId) return

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc') // <-- fixed field name
    )

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notifs = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          title: data.title || 'Notification',
          message: data.message || '',
          read: data.read || false,
          timestamp: data.createdAt?.toDate
            ? data.createdAt.toDate().toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : 'N/A',
        }
      })
      setNotifications(notifs)
    }, (error) => {
      console.error('Error fetching notifications:', error)
    })

    return () => unsubscribe()
  }, [userId])

  const handleOpenModal = async (notification) => {
    setSelectedNotification(notification)
    setShowModal(true)

    // Mark as read in Firestore
    if (!notification.read) {
      try {
        await updateDoc(doc(db, 'notifications', notification.id), {
          read: true,
        })
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedNotification(null)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(180deg, rgba(255, 223, 0, 0.15) 0%, rgba(255, 255, 255, 1) 100%)',
        fontFamily: 'Outfit, sans-serif',
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

        <ListGroup>
          {notifications.length === 0 && <p className="text-muted">No notifications available.</p>}
          {notifications.map((notification) => (
            <ListGroup.Item
              key={notification.id}
              action
              onClick={() => handleOpenModal(notification)}
              className="d-flex justify-content-between align-items-start"
            >
              <div className="ms-2 me-auto">
                <div
                  style={{
                    fontWeight: !notification.read ? '700' : '400',
                    color: !notification.read ? '#000000' : '#00000080',
                  }}
                >
                  {notification.title}
                </div>
                <small className="text-muted">{notification.timestamp}</small>
              </div>
              {!notification.read && <Badge bg="primary" pill>New</Badge>}
            </ListGroup.Item>
          ))}
        </ListGroup>

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
