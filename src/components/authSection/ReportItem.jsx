import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Row, Col, Form, Button, Card, Alert, Modal } from 'react-bootstrap'
import AuthSidebar from './AuthSidebar.jsx'
import noImage from '../../assets/noimage.png'
import { getAuth } from 'firebase/auth'
import { collection, addDoc, getDocs, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { db, storage } from '../../firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

function ReportItem() {
    const [successMessage, setSuccessMessage] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [submittedType, setSubmittedType] = useState('');
    const [loading, setLoading] = useState(false);
    const [itemType, setItemType] = useState('lost');
    const [imageFile, setImageFile] = useState(null);
    const [category, setCategory] = useState('Cat1');
    const auth = getAuth();
    const navigate = useNavigate();

    // Auto-hide alert after 3 seconds
    useEffect(() => {
        if (showSuccessModal) {
            const timer = setTimeout(() => {
                setShowSuccessModal(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [showSuccessModal]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file type
            const allowedTypes = ['image/jpeg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                alert('Only JPEG and PNG images are allowed.');
                e.target.value = '';
                return;
            }
            
            // Check file size (5MB = 5 * 1024 * 1024 bytes)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                alert('Image size must be less than 5MB.');
                e.target.value = '';
                return;
            }
            
            setImageFile(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!auth.currentUser) {
            alert('You must be logged in to submit a report.');
            return;
        }

        setLoading(true);
        const formData = new FormData(e.target);
        const rawItemName = formData.get('itemName').trim();
        const rawDescription = formData.get('description').trim();
        const location = formData.get('location').trim();
        const dateField = itemType === 'found' ? formData.get('dateFound') : formData.get('dateLost');

        let imageUrl = '';
        if (imageFile) {
            try {
                const storageRef = ref(storage, `reports/${auth.currentUser.uid}_${Date.now()}_${imageFile.name}`);
                await uploadBytes(storageRef, imageFile);
                imageUrl = await getDownloadURL(storageRef);
            } catch (error) {
                console.error('Error uploading image:', error);
                alert('Failed to upload image. Please try again.');
                setLoading(false);
                return;
            }
        }

        // Convert date string to Firestore Timestamp if provided
        let dateTimestamp = serverTimestamp();
        if (dateField) {
            const dateObj = new Date(dateField);
            dateTimestamp = dateObj;
        }

        const reportData = {
            userId: auth.currentUser.uid, // ✅ User ID from logged-in user
            type: itemType === 'lost' ? 'Lost' : 'Found',
            item_name: rawItemName,
            description: rawDescription,
            date_lost_found: dateTimestamp,
            location: location || '',
            tags: [],
            image_url: imageUrl,
            category: doc(db, 'categories', category),
            status: doc(db, 'status', 'Status1'),
        };

        try {
            await addDoc(collection(db, 'items'), reportData);
            
            // Store the type for the success modal
            setSubmittedType(itemType);
            
            console.log('Report submitted successfully with userId:', auth.currentUser.uid);
            
            // Clear form
            e.target.reset();
            setImageFile(null);
            setItemType('lost');
            setCategory('Cat1');
            
            // Show success modal
            setShowSuccessModal(true);
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Failed to submit report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{ minHeight: '100vh',
                background: 'linear-gradient(180deg, rgba(255, 223, 0, 0.15) 0%, rgba(255, 255, 255, 1) 100%)',
                display: 'flex',
            }}
        >
            <AuthSidebar activePage="report"/>

            <div style={{ flex: 1, marginLeft: '250px' }}>
                <Container className="py-5">
                    <Row className="justify-content-center">
                        <Col xs={12} md={10} lg={8}>
                            <Card className="shadow-sm p-4 rounded-4 font-poppins" style={{ backgroundColor: '#FCFBF6', color: 'var(--bs-primary-custom)' }}>
                                <Card.Body>
                                    <h2 className="mb-4 text-center fw-medium fs-5">Report Item</h2>

                                    <Form onSubmit={handleSubmit}>
                                        <Form.Group as={Row} className="mb-3 align-items-center">
                                            <Form.Label column sm={3} className="text-end">
                                                Item Name:<span className="text-danger ms-1">*</span>
                                            </Form.Label>
                                            <Col sm={9}>
                                                <Form.Control type="text" name="itemName" placeholder="Enter item name" required className="rounded-3" />
                                            </Col>
                                        </Form.Group>

                                        <Form.Group as={Row} className="mb-3 align-items-center">
                                            <Form.Label column sm={3} className="text-end">
                                                Description:<span className="text-danger ms-1">*</span>
                                            </Form.Label>
                                            <Col sm={9}>
                                                <Form.Control as="textarea" name="description" placeholder="Enter description" required rows={3} className="rounded-3" style={{ resize: 'none' }} />
                                            </Col>
                                        </Form.Group>

                                        <Form.Group as={Row} className="mb-3 align-items-center">
                                            <Form.Label column sm={3} className="text-end">
                                                Category:<span className="text-danger ms-1">*</span>
                                            </Form.Label>
                                            <Col sm={9}>
                                                <Form.Select 
                                                    name="category"
                                                    value={category}
                                                    onChange={(e) => setCategory(e.target.value)}
                                                    required
                                                    className="rounded-3"
                                                >
                                                    <option value="Cat1">Electronics</option>
                                                    <option value="Cat2">Personal Items</option>
                                                    <option value="Cat3">Documents</option>
                                                    <option value="Cat4">Others</option>
                                                </Form.Select>
                                            </Col>
                                        </Form.Group>

                                        <Form.Group as={Row} className="mb-3 align-items-center">
                                            <Form.Label column sm={3} className="text-end">
                                                Item Type:<span className="text-danger ms-1">*</span>
                                            </Form.Label>
                                            <Col sm={9}>
                                                <Form.Select name="itemType"
                                                    value={itemType}
                                                    onChange={(e) => setItemType(e.target.value)}
                                                    required
                                                    className="rounded-3"
                                                >
                                                    <option value="lost">Lost</option>
                                                    <option value="found">Found</option>
                                                </Form.Select>
                                            </Col>
                                        </Form.Group>

                                        <Form.Group as={Row} className="mb-3 align-items-center">
                                            <Form.Label column sm={3} className="text-end">
                                                {itemType === 'found' ? 'Date Found:' : 'Date Lost:'}<span className="text-danger ms-1">*</span>
                                            </Form.Label>
                                            <Col sm={9}>
                                                <Form.Control type="date" name={itemType === 'found' ? 'dateFound' : 'dateLost'} required className="rounded-3" />
                                            </Col>
                                        </Form.Group>

                                        <Form.Group as={Row} className="mb-3 align-items-center">
                                            <Form.Label column sm={3} className="text-end">
                                                Location:
                                            </Form.Label>
                                            <Col sm={9}>
                                                <Form.Control type="text"
                                                    name="location"
                                                    placeholder={itemType === 'found' ? 'Where you found it' : 'Where you lost it'}
                                                    className="rounded-3"
                                                />
                                            </Col>
                                        </Form.Group>

                                        <Form.Group as={Row} className="mb-3 align-items-center">
                                            <Col sm={{ span: 9, offset: 3 }}>
                                                <Form.Control 
                                                    type="file" 
                                                    accept="image/jpeg,image/png" 
                                                    onChange={handleImageChange} 
                                                    className="rounded-3" 
                                                />
                                                <Form.Text className="text-muted">
                                                    Only JPEG and PNG files. Max size: 5MB
                                                </Form.Text>
                                            </Col>
                                        </Form.Group>

                                        <div className="text-center">
                                            <Button type="submit"
                                                disabled={loading}
                                                className="rounded-pill px-5 py-2 fw-bold fs-6"
                                                style={{
                                                    backgroundColor: 'transparent',
                                                    borderColor: 'var(--bs-primary-custom)',
                                                    borderWidth: '2px',
                                                    color: 'var(--bs-primary-custom)',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--bs-primary-custom)';
                                                    e.currentTarget.style.color = 'white';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = 'var(--bs-primary-custom)';
                                                }}
                                            >
                                                {loading ? 'Submitting...' : 'Submit'}
                                            </Button>
                                        </div>
                                    </Form>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </div>

            {/* Floating Success Notification */}
            {showSuccessModal && (
                <div 
                    style={{
                        position: 'fixed',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        animation: 'slideDown 0.3s ease-out',
                        minWidth: '400px'
                    }}
                >
                    <Alert 
                        variant="success" 
                        className="text-center py-3 shadow-lg"
                        style={{
                            borderRadius: '15px',
                            border: '2px solid #28a745'
                        }}
                    >
                        <h5 className="mb-2">✓ Success!</h5>
                        <p className="mb-0">
                            {submittedType === 'lost' 
                                ? 'Your report has been submitted for admin review.' 
                                : 'Successfully submitted!'}
                        </p>
                    </Alert>
                </div>
            )}

            <style>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

export default ReportItem