import React, { useEffect, useState } from 'react'
import { Container, Row, Col, Card, Button, Modal, Alert, Form } from 'react-bootstrap'
import { FaSearch } from 'react-icons/fa'
import AuthSidebar from './AuthSidebar.jsx'
import noImage from '../../assets/noimage.png'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, query, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'

function BrowseItems() {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('all');
  const auth = getAuth();

  // Fetch all items
  useEffect(() => {
    const q = query(collection(db, 'items'));
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const itemsPromises = [];
      
      querySnapshot.forEach((docSnap) => {
        const itemData = { id: docSnap.id, ...docSnap.data() };
        const promises = [];
        
        // Fetch status
        if (itemData.status && itemData.status.path) {
          promises.push(
            getDoc(itemData.status).then(statusDoc => {
              itemData.statusValue = statusDoc.exists() ? statusDoc.data().status_name : 'Pending';
            })
          );
        }
        
        // Fetch category
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
      
      const allItems = await Promise.all(itemsPromises);
      setItems(allItems);
    });
    return () => unsubscribe();
  }, []);

  const tabs = {
    all: 'All Items',
    lost: 'Lost',
    found: 'Found',
  };

  const filteredItems = items.filter((item) => {
    const matchesTab = tab === 'all' ? true : item.type?.toLowerCase() === tab;
    const matchesSearch = item.item_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant: '' }), 4000);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(180deg, rgba(255, 223, 0, 0.15) 0%, #fff 100%)',
      }}
    >
      <AuthSidebar activePage="browse-items"/>
      <div style={{ flex: 1, marginLeft: '240px' }}>
        <Container className="py-5 font-poppins">
          {alert.show && (
            <Alert variant={alert.variant} dismissible onClose={() => setAlert({ show: false, message: '', variant: '' })} className="mb-3">
              {alert.message}
            </Alert>
          )}

          <div className="mb-4 m-3">
            <h2 style={{ color: 'var(--bs-primary-custom)', fontStyle: 'italic' }}>
              Browse Items
            </h2>
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
                <Card onClick={() => setSelectedItem(item)}
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
            <Modal show={true} onHide={() => setSelectedItem(null)} centered size="lg">
              <Modal.Header closeButton>
                <Modal.Title>{selectedItem.item_name}</Modal.Title>
              </Modal.Header>
              <Modal.Body className="d-flex flex-wrap">
                <div style={{ flex: '1 1 200px', marginRight: '20px' }}>
                  <img src={selectedItem.image_url || noImage}
                    alt={selectedItem.item_name}
                    style={{ height: '200px', objectFit: 'cover', width: '100%', borderRadius: '8px' }}
                  />
                </div>
                <div style={{ flex: '2 1 300px' }}>
                  <p><strong>Type:</strong> {selectedItem.type || 'N/A'}</p>
                  <p><strong>Status:</strong> {selectedItem.statusValue || 'Pending'}</p>
                  <p><strong>Category:</strong> {selectedItem.categoryValue || 'N/A'}</p>
                  <p><strong>Description:</strong> {selectedItem.description || 'N/A'}</p>
                  <p><strong>Date {selectedItem.type === 'Found' ? 'Found' : 'Lost'}:</strong>{' '}
                    {selectedItem.date_lost_found?.toDate ? 
                      selectedItem.date_lost_found.toDate().toLocaleDateString() : 
                      selectedItem.date_lost_found || 'N/A'}</p>
                  <p><strong>Location:</strong> {selectedItem.location || 'N/A'}</p>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setSelectedItem(null)}>Close</Button>
              </Modal.Footer>
            </Modal>
          )}
        </Container>
      </div>
    </div>
  );
}

export default BrowseItems