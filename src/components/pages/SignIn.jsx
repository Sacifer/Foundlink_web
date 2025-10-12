import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Container, Form, Button, Image, Alert, InputGroup } from 'react-bootstrap'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase.js'
import google from '../../assets/google.png'
import ForgotPass from '../ForgotPass.jsx'

function SignIn({ show = true, onClose, onSwitchToRegister }) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPass, setShowForgotPass] = useState(false);

  const navigate = useNavigate();

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (!show) {
      setFormData({ email: '', password: '' });
      setError('');
      setShowPassword(false);
      setLoading(false);
    }
  }, [show]);

  const handleEmailPasswordSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { email, password } = formData;
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      const userDoc = doc(db, 'users', userCredential.user.uid);
      const snapshot = await getDoc(userDoc);
      const role = snapshot.exists() ? snapshot.data().role : 'user';

      if (role === 'admin') navigate('/admin-dashboard');
      else navigate('/student-dashboard');

      onClose?.();
    } catch (err) {
      console.error('Sign-in error:', err.code, err.message);
      switch (err.code) {
        case 'auth/invalid-email':
          setError('Invalid email format. Please check and try again.');
          break;
        case 'auth/user-not-found':
          setError('No user found with this email.');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password. Please try again.');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        case 'auth/invalid-credential':
          setError('Incorrect email or password. Please try again.');
          break;
        default:
          setError('An error occurred while signing in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userDoc = doc(db, 'users', result.user.uid);
      const snapshot = await getDoc(userDoc);
      const role = snapshot.exists() ? snapshot.data().role : 'user';

      if (role === 'admin') navigate('/admin-dashboard');
      else navigate('/student-dashboard');

      onClose?.();
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError('Failed to sign in with Google.');
    }
  };

  if (!show) return null;

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('signin-backdrop')) {
      onClose?.();
    }
  };

  return (
    <>
      {!showForgotPass && (
        <div className="signin-backdrop position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
          onClick={handleBackdropClick}
        >
          <Container className="bg-white shadow p-5 rounded-4 position-relative text-center"
            style={{ maxWidth: '450px', fontFamily: 'Outfit, sans-serif' }}
          >
            <Button variant="link"
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                fontSize: '1.5rem',
                textDecoration: 'none',
                color: '#333',
              }}
            >
              ×
            </Button>

            <Link to="/">
              <Image src="/foundlink.png" alt="logo" className="mb-3" style={{ height: '35px' }} />
            </Link>

            <h2 className="mb-4 fw-semibold" style={{ fontSize: '18px', color: 'var(--bs-primary-custom)' }}>
              Sign in to your account
            </h2>

            <Form onSubmit={handleEmailPasswordSignIn} className="d-flex flex-column align-items-center gap-3">
              <Form.Group className="w-75">
                <Form.Control type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={{
                    borderColor: 'var(--bs-primary-custom)',
                    borderWidth: '2px',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                  }}
                />
              </Form.Group>

              <Form.Group className="w-75 position-relative">
                <InputGroup>
                  <Form.Control type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    style={{
                      borderColor: 'var(--bs-primary-custom)',
                      borderWidth: '2px',
                      borderRadius: '10px',
                      fontSize: '0.9rem',
                      paddingRight: formData.password ? '60px' : '12px',
                    }}
                  />
                  {formData.password && (
                    <Button variant="link"
                      onClick={togglePasswordVisibility}
                      className="position-absolute top-50 end-0 translate-middle-y me-2 p-0"
                      style={{
                        fontSize: '12px',
                        color: 'var(--bs-primary-custom)',
                        textDecoration: 'none',
                        zIndex: 10,
                      }}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>

              <div className="w-75 text-end">
                <button type="button"
                  onClick={() => setShowForgotPass(true)}
                  className="text-decoration-none border-0 bg-transparent p-0"
                  style={{ color: 'var(--bs-primary-custom)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Forgot password?
                </button>
              </div>

              {error && <Alert variant="danger" className="w-75 py-2 mb-2 mx-auto text-center">{error}</Alert>}

              <Button type="submit"
                disabled={loading}
                className="w-50 py-2 rounded-pill fw-bold"
                style={{
                  backgroundColor: loading ? '#6c757d' : 'var(--bs-primary-custom)',
                  borderColor: loading ? '#6c757d' : 'var(--bs-primary-custom)',
                  color: 'white',
                }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </Form>

            <div className="d-flex align-items-center my-3 w-50 mx-auto" style={{ fontSize: '0.85rem', color: '#000' }}>
              <hr className="flex-grow-1" style={{ borderTop: '1px solid #000', margin: 0 }} />
              <span className="mx-2">or</span>
              <hr className="flex-grow-1" style={{ borderTop: '1px solid #000', margin: 0 }} />
            </div>

            <Button onClick={handleGoogleSignIn}
              className="d-flex align-items-center justify-content-center mt-2"
              style={{
                backgroundColor: '#fff',
                border: '1px solid #dcdcdc',
                color: '#555',
                fontSize: '0.85rem',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                padding: '0.35rem 0.75rem',
                gap: '6px',
                width: '60%',
                margin: '0 auto',
              }}
            >
              <img src={google} alt="Google" style={{ height: '20px' }} />
              Sign in with Google
            </Button>

            <p className="mt-3 mb-0" style={{ fontSize: '0.9rem' }}>
              Don't have an account?{' '}
              <button type="button"
                onClick={onSwitchToRegister}
                className="fw-semibold text-decoration-none border-0 bg-transparent p-0"
                style={{ color: 'var(--bs-primary-custom)', cursor: 'pointer' }}
              >
                Sign up
              </button>
            </p>
          </Container>
        </div>
      )}

      {showForgotPass && (
        <ForgotPass show={showForgotPass}
          onClose={() => setShowForgotPass(false)}
          onBackToSignIn={() => setShowForgotPass(false)}
        />
      )}
    </>
  );
}

export default SignIn