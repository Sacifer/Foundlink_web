import React, { useState } from 'react'
import { Container, Form, Button, Alert } from 'react-bootstrap'
import { sendPasswordResetEmail } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

function ForgotPass({ show = true, onClose, onBackToSignIn }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!email) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', trimmedEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('No user found with this email.');
        setLoading(false);
        return;
      }

      await sendPasswordResetEmail(auth, trimmedEmail);
      setMessage('Reset link sent to your email.');
      setEmail('');
    } catch (err) {
      console.error('Forgot password error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No user found with this email.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email format.');
      } else {
        setError('Failed to send reset email. Please try again later.');
      }
    }
    setLoading(false);
  };

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('forgotpass-backdrop')) {
      onClose?.();
    }
  };

  return (
    <div className="forgotpass-backdrop position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
      onClick={handleBackdropClick}
    >
      <Container className="bg-white shadow p-5 rounded-4 position-relative text-center"
        style={{ maxWidth: '450px', fontFamily: 'Outfit, sans-serif' }}
      >

        <h2 className="mb-4 fw-semibold" style={{ fontSize: '25px', color: 'var(--bs-primary-custom)' }}>
          Forgot Password
        </h2>

        <Form onSubmit={handleSubmit} className="d-flex flex-column align-items-center gap-3">
          <Form.Group className="w-75">
            <Form.Control type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                borderColor: 'var(--bs-primary-custom)',
                borderWidth: '2px',
                borderRadius: '10px',
                fontSize: '0.9rem',
              }}
            />
          </Form.Group>

          <Button type="submit"
            disabled={loading}
            className="w-50 py-2 rounded-pill fw-bold mt-2"
            style={{
              backgroundColor: loading ? 'gray' : 'var(--bs-primary-custom)',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
        </Form>

        {message && <Alert variant="success" className="mt-3">{message}</Alert>}
        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

        <p className="mt-3" style={{ fontSize: '0.9rem' }}>
          Remember your password?{' '}
          <button type="button"
            onClick={onBackToSignIn}
            className="fw-semibold border-0 bg-transparent p-0"
            style={{ color: 'var(--bs-primary-custom)', cursor: 'pointer' }}
          >
            Sign in
          </button>
        </p>
      </Container>
    </div>
  );
}

export default ForgotPass