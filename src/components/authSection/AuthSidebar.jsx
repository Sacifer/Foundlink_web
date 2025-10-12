import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Image, Modal, Button, Row, Col } from 'react-bootstrap'
import { getAuth, signOut } from 'firebase/auth'
import { FiLogOut } from 'react-icons/fi'

function AuthSidebar() {
  const [showSignoutModal, setShowSignoutModal] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const auth = getAuth()

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      navigate('/')
    } catch (error) {
      console.error('Error during sign out:', error)
    }
  }

  const handleCloseModal = () => setShowSignoutModal(false)
  const handleShowModal = () => setShowSignoutModal(true)

  const getLinkClass = (path) => {
    return location.pathname === path
      ? 'sidebar-link active d-flex align-items-center gap-2'
      : 'sidebar-link d-flex align-items-center gap-2'
  }

  return (
    <>
      <Modal show={showSignoutModal} onHide={handleCloseModal} centered>
        <Modal.Body className="text-center p-4"
          style={{ minHeight: '130px' }}
        >
          <h5 className="mb-3" style={{ color: 'var(--bs-primary-custom)' }}>
            Are you sure you want to sign out?
          </h5>
          <div className="d-flex justify-content-center gap-5 mt-3">
            <Button
              variant="secondary"
              onClick={handleCloseModal}
              className="rounded-3 px-3 fw-bold"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleSignOut}
              className="rounded-3 px-3 fw-bold"
            >
              Sign Out
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      <div
        className="position-fixed top-0 start-0 vh-100 d-flex flex-column p-4 shadow"
        style={{
          width: '240px',
          backgroundColor: '#fff',
          boxShadow: '2px 0 12px rgba(0,0,0,0.08)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        <div className="d-flex align-items-center mb-4">
          <Image
            src="/foundlink.png"
            alt="logo"
            style={{ height: '28px', width: 'auto' }}
          />
        </div>

        <div
          style={{
            height: '1px',
            backgroundColor: '#e0e0e0',
            width: '100%',
            marginBottom: '0.8rem',
          }}
        ></div>

        <nav className="flex-grow-1 d-flex flex-column gap-2">
          <Link to="/student-dashboard" className={getLinkClass('/student-dashboard')}>
            Dashboard
          </Link>
          <Link to="/browse-items" className={getLinkClass('/browse-items')}>
            Browse Items
          </Link>
          <Link to="/report" className={getLinkClass('/report')}>
            Report Item
          </Link>
          <Link to="/edit-profile" className={getLinkClass('/edit-profile')}>
            Edit Profile
          </Link>

          <div
            onClick={handleShowModal}
            className="sidebar-link d-flex align-items-center gap-2 mt-auto"
            style={{ cursor: 'pointer', color: '#000', fontWeight: 500 }}
          >
            <FiLogOut size={18}/>
            Sign Out
          </div>
        </nav>
      </div>
    </>
  )
}

export default AuthSidebar