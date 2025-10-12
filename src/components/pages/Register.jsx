import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Container, Form, Button, Image, Alert } from 'react-bootstrap'
import { createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../../firebase.js'
import google from '../../assets/google.png'

function Register({ show = true, onHide, onSwitchToSignIn }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false,
  });
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false); // ✅ new

  const navigate = useNavigate();

  const handleClose = () => {
    if (typeof onHide === 'function') onHide();
  };

  useEffect(() => {
    if (!show) {
      setFormData({ email: '', username: '', password: '', confirmPassword: '' });
      setError('');
      setMessage('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setLoading(false);
      setPasswordChecks({
        length: false,
        lowercase: false,
        uppercase: false,
        number: false,
        special: false,
      });
      setShowPasswordRequirements(false);
    }
  }, [show]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    if (show) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const intervalId = setInterval(async () => {
      const user = auth.currentUser;
      if (user) {
        await user.reload();
        if (user.emailVerified) {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnapshot = await getDoc(userDocRef);

          if (userSnapshot.exists()) {
            const role = userSnapshot.data().role || 'user';
            await setDoc(userDocRef, { verified: true }, { merge: true });
            clearInterval(intervalId);
            handleClose();
            navigate(role === 'admin' ? '/admin-dashboard' : '/student-dashboard');
          }
        }
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [navigate, show]);

  const checkPasswordStrength = (password) => {
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[\W_]/.test(password),
    };
    setPasswordChecks(checks);
  };

  const togglePasswordVisibility = () => setShowPassword((p) => !p);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword((p) => !p);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'password') {
      checkPasswordStrength(value);
      setShowPasswordRequirements(true);
    }
  };

  const validateForm = async () => {
    const { email, username, password, confirmPassword } = formData;
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();

    if (!email || !username || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return false;
    }

    if (trimmedUsername.length < 5) {
      setError('Username must be at least 5 characters long.');
      return false;
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError(
        'Password must include 8 characters with uppercase, lowercase, number, and special character.'
      );
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    const emailQuery = query(
      collection(db, 'users'),
      where('email', '==', normalizedEmail)
    );
    const emailSnapshot = await getDocs(emailQuery);
    if (!emailSnapshot.empty) {
      setError('This email is already registered. Try signing in.');
      return false;
    }

    const usernameQuery = query(
      collection(db, 'users'),
      where('username', '==', trimmedUsername)
    );
    const usernameSnapshot = await getDocs(usernameQuery);
    if (!usernameSnapshot.empty) {
      setError('Username is already taken.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const isValid = await validateForm();
      if (!isValid) return;

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim().toLowerCase(),
        formData.password
      );

      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        role: 'user',
        createdAt: new Date(),
        verified: false,
      });

      await sendEmailVerification(user);
      setMessage('Account created! Please check your email to verify your account.');
      setFormData({ email: '', username: '', password: '', confirmPassword: '' });
      setShowPasswordRequirements(false);
    } catch (err) {
      console.error('Registration error:', err);
      const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password is too weak.',
        'auth/network-request-failed': 'Network error. Please check your internet connection.',
      };
      setError(errorMessages[err.code] || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          username: user.displayName || 'User',
          email: user.email,
          role: 'user',
          verified: true,
          createdAt: new Date(),
        });
      }

      handleClose();
      navigate('/student-dashboard');
    } catch (err) {
      console.error('Google Sign Up Error:', err);
      setError('Failed to sign up with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <Container className="bg-white shadow p-5 rounded-4 position-relative text-center"
        style={{ maxWidth: '450px', fontFamily: 'Outfit, sans-serif' }}
      >
        <Button variant="link"
          onClick={handleClose}
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
          Create an account
        </h2>

        <Form onSubmit={handleSubmit} className="d-flex flex-column align-items-center gap-3">
          <Form.Group className="w-75">
            <Form.Control type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
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

          <Form.Group className="w-75">
            <Form.Control type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={5}
              disabled={loading}
              style={{
                borderColor: 'var(--bs-primary-custom)',
                borderWidth: '2px',
                borderRadius: '10px',
                fontSize: '0.9rem',
              }}
            />
          </Form.Group>

          <Form.Group className="w-75 position-relative">
            <Form.Control type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              onFocus={() => setShowPasswordRequirements(true)}
              required
              disabled={loading}
              autoComplete="new-password"
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
                className="position-absolute top-50 end-0 translate-middle-y me-2 p-0 border-0 bg-transparent"
                style={{
                  fontSize: '12px',
                  color: 'var(--bs-primary-custom)',
                  textDecoration: 'none',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </Button>
            )}
          </Form.Group>

          {formData.password && showPasswordRequirements && (
            <div className="w-75 text-start fade-in"
              style={{
                fontSize: '0.8rem',
                color: '#333',
                transition: 'opacity 0.4s ease-in-out',
              }}
            >
              <p className="mb-1 fw-semibold">Password must include:</p>
              <ul className="list-unstyled mb-0">
                <li style={{ color: passwordChecks.length ? 'green' : 'red' }}>
                  <i className={`bi ${passwordChecks.length ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                  At least 8 characters
                </li>
                <li style={{ color: passwordChecks.lowercase ? 'green' : 'red' }}>
                  <i className={`bi ${passwordChecks.lowercase ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                  Lowercase letter
                </li>
                <li style={{ color: passwordChecks.uppercase ? 'green' : 'red' }}>
                  <i className={`bi ${passwordChecks.uppercase ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                  Uppercase letter
                </li>
                <li style={{ color: passwordChecks.number ? 'green' : 'red' }}>
                  <i className={`bi ${passwordChecks.number ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                  Number
                </li>
                <li style={{ color: passwordChecks.special ? 'green' : 'red' }}>
                  <i className={`bi ${passwordChecks.special ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                  Special character
                </li>
              </ul>
            </div>
          )}

          {formData.password.length > 0 && (
            <Form.Group className="w-75 position-relative fade-in">
              <Form.Control type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                onFocus={() => setShowPasswordRequirements(false)}
                required
                disabled={loading}
                style={{
                  borderColor: 'var(--bs-primary-custom)',
                  borderWidth: '2px',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  paddingRight: formData.confirmPassword ? '60px' : '12px',
                }}
              />
              {formData.confirmPassword && (
                <Button variant="link"
                  onClick={toggleConfirmPasswordVisibility}
                  className="position-absolute top-50 end-0 translate-middle-y me-2 p-0 border-0 bg-transparent"
                  style={{
                    fontSize: '12px',
                    color: 'var(--bs-primary-custom)',
                    textDecoration: 'none',
                  }}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </Button>
              )}
            </Form.Group>
          )}

          {error && <Alert variant="danger" className="w-75 py-2 mb-0">{error}</Alert>}
          {message && <Alert variant="success" className="w-75 py-2 mb-0">{message}</Alert>}

          <Button type="submit"
            disabled={ loading }
            className="w-50 py-2 rounded-pill fw-bold mt-2"
            style={{
              backgroundColor: loading ? '#6c757d' : 'var(--bs-primary-custom)',
              borderColor: loading ? '#6c757d' : 'var(--bs-primary-custom)',
              color: 'white',
              transition: 'all 0.2s ease-in-out',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Signing up...' : 'Sign up'}
          </Button>
        </Form>

        <div className="d-flex align-items-center my-3 w-50 mx-auto" style={{ fontSize: '0.85rem', color: '#000' }}>
          <hr className="flex-grow-1" style={{ borderTop: '1px solid #000', margin: 0 }} />
          <span className="mx-2">or</span>
          <hr className="flex-grow-1" style={{ borderTop: '1px solid #000', margin: 0 }} />
        </div>

        <Button onClick={handleGoogleSignUp}
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
          Sign up with Google
        </Button>

        <p className="mt-3 mb-0" style={{ fontSize: '0.9rem' }}>
          Already have an account?{' '}
          <button onClick={() => {
              if (onSwitchToSignIn) onSwitchToSignIn();
              handleClose();
            }}
            className="fw-semibold text-decoration-none border-0 bg-transparent"
            style={{ color: 'var(--bs-primary-custom)', cursor: 'pointer' }}
          >
            Sign in
          </button>
        </p>
      </Container>
    </div>
  );
}

export default Register