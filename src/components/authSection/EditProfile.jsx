import React, { useEffect, useState } from 'react'
import AuthSidebar from './AuthSidebar.jsx'
import { useNavigate } from 'react-router-dom'
import { Container, Row, Col, Form, Button, Modal, Alert } from 'react-bootstrap'
import { getAuth, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'

const departments = ['Senior High School', 'SASE', 'SBMA', 'SECA'];
const programs = {
  'Senior High School': ['STEM', 'ABM'],
  SASE: ['ABComm', 'BSPS', 'BPEd'],
  SBMA: ['BSAccountancy', 'BSMA', 'BSHM', 'BSBA-HRM', 'MM', 'BSBA-FinMgt', 'BSBA-MktgMgt', 'BSTM'],
  SECA: ['BSCS-ML', 'BSCpE', 'BSArch', 'BSIT-MWA', 'BSCE'],
};

function EditProfile() {
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    birthday: '',
    email: '',
    department: '',
    program: '',
    password: '',
  });
  const [userId, setUserId] = useState(null);

  const [showChangeUsernameModal, setShowChangeUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameModalPassword, setUsernameModalPassword] = useState('');
  const [usernameAlert, setUsernameAlert] = useState({ show: false, message: '', variant: '' });

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteAlert, setDeleteAlert] = useState({ show: false, message: '', variant: '' });

  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });

  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              username: data.username || '',
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              birthday: data.birthday || '',
              email: data.email || '',
              department: data.department || '',
              program: data.program || '',
              password: '',
            });
            setNewUsername(data.username || '');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [auth, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'department' ? { program: '' } : {}),
    }));
  };

  const showFormAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant: '' }), 5000);
  };

  const showUsernameAlert = (message, variant) => {
    setUsernameAlert({ show: true, message, variant });
    setTimeout(() => setUsernameAlert({ show: false, message: '', variant: '' }), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) return;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        birthday: formData.birthday || null,
        department: formData.department,
        program: formData.program,
      });
      showFormAlert('Profile updated successfully!', 'success');
    } catch (error) {
      console.error(error);
      showFormAlert('Failed to update profile', 'danger');
    }
  };

  const handleChangeUsername = async () => {
    if (!newUsername || !usernameModalPassword) {
      showUsernameAlert('Enter password to change username.', 'danger');
      return;
    }
    try {
      const q = query(collection(db, 'users'), where('username', '==', newUsername));
      const snap = await getDocs(q);
      if (snap.docs.some(doc => doc.id !== userId)) {
        showUsernameAlert('Username already taken', 'danger');
        return;
      }
      const credential = EmailAuthProvider.credential(auth.currentUser.email, usernameModalPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updateDoc(doc(db, 'users', userId), { username: newUsername });
      setFormData(prev => ({ ...prev, username: newUsername }));
      setUsernameModalPassword('');
      showUsernameAlert('Username updated!', 'success');
      setShowChangeUsernameModal(false);
    } catch (error) {
      console.error(error);
      showUsernameAlert('Failed to update username', 'danger');
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;

    if (!deletePassword) {
      setDeleteAlert({ show: true, message: 'Please enter your password', variant: 'danger' });
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, deletePassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { archived: true, archivedAt: new Date().toISOString() });

      await auth.currentUser.delete();
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error(error);
      let message = 'Failed to delete account. Please check your password.';
      if (error.code === 'auth/wrong-password') message = 'Incorrect password. Please try again.';
      setDeleteAlert({ show: true, message, variant: 'danger' });
    }
  };

  const grayInputStyle = {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: '#ddd',
    color: 'gray',
    outline: 'none',
    boxShadow: 'none',
  };
  const normalInputStyle = {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: '#ddd',
    color: '#000',
    outline: 'none',
    boxShadow: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(180deg, rgba(255, 223, 0, 0.15) 0%, #fff 100%)' }}>
      <div style={{ width: '240px' }}><AuthSidebar /></div>
      <div style={{ flex: 1, padding: '2rem' }}>
        <Container>
          <Row className="justify-content-center">
            <Col xs={12} md={10} lg={8}>
              <h2 className="fs-3 fw-bold mb-4 text-center" style={{ color: 'var(--bs-primary-custom)' }}>User Information</h2>

              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col xs={12} sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>First Name</Form.Label>
                      <Form.Control type="text" name="firstName" value={formData.firstName} onChange={handleChange} style={normalInputStyle} />
                    </Form.Group>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Last Name</Form.Label>
                      <Form.Control type="text" name="lastName" value={formData.lastName} onChange={handleChange} style={normalInputStyle} />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <div className="d-flex align-items-center">
                    <Form.Control type="text" value={formData.username} readOnly style={grayInputStyle} />
                    <Button variant="link" onClick={() => setShowChangeUsernameModal(true)} style={{ color: 'var(--bs-primary-custom)', textDecoration: 'none', fontWeight: 500, marginLeft: '8px' }}>Change</Button>
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={formData.email} readOnly style={grayInputStyle} />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Birthday</Form.Label>
                  <Form.Control type="date" name="birthday" value={formData.birthday} onChange={handleChange} style={normalInputStyle} />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Department</Form.Label>
                  <Form.Select name="department" value={formData.department} onChange={handleChange} style={normalInputStyle}>
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Program</Form.Label>
                  <Form.Select name="program" value={formData.program} onChange={handleChange} style={normalInputStyle}>
                    <option value="">Select Program</option>
                    {(programs[formData.department] || []).map(p => <option key={p} value={p}>{p}</option>)}
                  </Form.Select>
                </Form.Group>

                {alert.show && <Alert variant={alert.variant} className="mt-3">{alert.message}</Alert>}

                <Row className="mt-4">
                  <Col xs={12} sm={6} className="mb-2 mb-sm-0">
                    <Button variant="danger" onClick={() => setShowDeleteConfirmModal(true)} className="w-100 rounded-3">Delete Account</Button>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Button type="submit" className="w-100 rounded-3" style={{ backgroundColor: 'var(--bs-primary-custom)', borderColor: 'var(--bs-primary-custom)' }}>Save Changes</Button>
                  </Col>
                </Row>
              </Form>
            </Col>
          </Row>
        </Container>

        <Modal show={showChangeUsernameModal} onHide={() => setShowChangeUsernameModal(false)} centered>
          <Modal.Body>
            <h5 className="mb-3" style={{ color: 'var(--bs-primary-custom)' }}>Change Username</h5>
            <Form.Group className="mb-3">
              <Form.Label>New Username</Form.Label>
              <Form.Control type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" value={usernameModalPassword} onChange={e => setUsernameModalPassword(e.target.value)} />
            </Form.Group>
            {usernameAlert.show && <Alert variant={usernameAlert.variant}>{usernameAlert.message}</Alert>}
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => setShowChangeUsernameModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleChangeUsername}>Save</Button>
            </div>
          </Modal.Body>
        </Modal>

        <Modal show={showDeleteConfirmModal} 
          onHide={() => setShowDeleteConfirmModal(false)} 
          centered
        >
          <Modal.Body className="text-center" 
            style={{ minHeight: '170px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <h5 style={{ color: 'var(--bs-primary-custom)' }}>
              Are you sure you want to delete your account?
            </h5>
            <div className="d-flex justify-content-center gap-3 mt-4">
              <Button variant="secondary" onClick={() => setShowDeleteConfirmModal(false)}>Cancel</Button>
              <Button variant="danger" 
                onClick={() => { 
                  setShowDeleteConfirmModal(false); 
                  setDeleteAlert({ show: false, message: '', variant: '' });
                  setShowDeletePasswordModal(true); 
                }}
              >
                Delete Account
              </Button>
            </div>
          </Modal.Body>
        </Modal>

        <Modal show={showDeletePasswordModal} 
          onHide={() => {
            setShowDeletePasswordModal(false);
            setDeletePassword('');
            setDeleteAlert({ show: false, message: '', variant: '' });
            setShowDeleteConfirmModal(true);
          }} 
          centered
        >
          <Modal.Body className="text-center">
            <h5 style={{ color: 'var(--bs-primary-custom)' }}>Enter your password to confirm deletion</h5>
            <Form.Group className="mb-3 mt-3">
              <Form.Control type="password" 
                value={deletePassword} 
                onChange={e => setDeletePassword(e.target.value)} 
                placeholder="Password" 
              />
            </Form.Group>
            {deleteAlert.show && <Alert variant={deleteAlert.variant}>{deleteAlert.message}</Alert>}
            <div className="d-flex justify-content-center gap-3 mt-3">
              <Button variant="secondary" 
                onClick={() => {
                  setShowDeletePasswordModal(false);
                  setDeletePassword('');
                  setDeleteAlert({ show: false, message: '', variant: '' });
                  setShowDeleteConfirmModal(true);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteAccount}>Confirm</Button>
            </div>
          </Modal.Body>
        </Modal>

      </div>
    </div>
  );
}

export default EditProfile