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
            {filteredItems.map((item) => {
              const isLost = item.type?.toLowerCase() === 'lost';
              const isFound = item.type?.toLowerCase() === 'found';
              const cardBgColor = isLost ? '#ffebee' : isFound ? '#e8f5e9' : '#f5f5f5';
              const borderColor = isLost ? '#ffcdd2' : isFound ? '#c8e6c9' : '#e0e0e0';
              
              return (
                <Col key={item.id}>
                  <Card onClick={() => setSelectedItem(item)}
                    className="h-100 rounded-4 shadow-sm"
                    style={{ 
                      cursor: 'pointer', 
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      backgroundColor: cardBgColor,
                      border: `2px solid ${borderColor}`,
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
                    }}
                  >
                    <Card.Img variant="top"
                      src={item.image_url && item.image_url.trim() !== '' ? item.image_url : noImage}
                      alt={item.item_name}
                      style={{ height: '180px', objectFit: 'cover' }}
                    />
                    <Card.Body className="text-center p-3">
                      <div className="d-flex justify-content-center align-items-center mb-2">
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          backgroundColor: isLost ? '#ef5350' : isFound ? '#66bb6a' : '#9e9e9e',
                          color: 'white',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {item.type || 'Unknown'}
                        </span>
                      </div>
                      <Card.Text className="fw-medium text-dark mb-0">{item.item_name}</Card.Text>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
          {filteredItems.length === 0 && <p className="text-center text-muted mt-4">No items found.</p>}

          {selectedItem && (
            <Modal show={true} onHide={() => setSelectedItem(null)} centered size="lg">
              <Modal.Header closeButton style={{
                backgroundColor: selectedItem.type?.toLowerCase() === 'lost' ? '#ffebee' : 
                               selectedItem.type?.toLowerCase() === 'found' ? '#e8f5e9' : '#f5f5f5',
                borderBottom: `3px solid ${selectedItem.type?.toLowerCase() === 'lost' ? '#ef5350' : 
                               selectedItem.type?.toLowerCase() === 'found' ? '#66bb6a' : '#9e9e9e'}`
              }}>
                <Modal.Title className="d-flex align-items-center gap-2">
                  <span>{selectedItem.item_name}</span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    backgroundColor: selectedItem.type?.toLowerCase() === 'lost' ? '#ef5350' : 
                                   selectedItem.type?.toLowerCase() === 'found' ? '#66bb6a' : '#9e9e9e',
                    color: 'white',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {selectedItem.type || 'Unknown'}
                  </span>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body className="p-4">
                <div className="d-flex flex-wrap gap-4">
                  <div style={{ flex: '1 1 250px', minWidth: '250px' }}>
                    <img src={selectedItem.image_url || noImage}
                      alt={selectedItem.item_name}
                      style={{ 
                        width: '100%', 
                        height: '250px', 
                        objectFit: 'cover', 
                        borderRadius: '12px',
                        border: `3px solid ${selectedItem.type?.toLowerCase() === 'lost' ? '#ffcdd2' : 
                               selectedItem.type?.toLowerCase() === 'found' ? '#c8e6c9' : '#e0e0e0'}`
                      }}
                    />
                  </div>
                  <div style={{ flex: '1.5 1 300px' }}>
                    <div className="mb-3">
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#666', 
                        fontWeight: '600', 
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>Status</div>
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#f0f0f0',
                          fontWeight: '500'
                        }}>
                          {selectedItem.statusValue || 'Pending'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#666', 
                        fontWeight: '600', 
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>Category</div>
                      <div style={{ fontSize: '1rem', color: '#333' }}>{selectedItem.categoryValue || 'N/A'}</div>
                    </div>
                    
                    <div className="mb-3">
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#666', 
                        fontWeight: '600', 
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>Description</div>
                      <div style={{ fontSize: '1rem', color: '#333', lineHeight: '1.5' }}>
                        {selectedItem.description || 'N/A'}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#666', 
                        fontWeight: '600', 
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>Date {selectedItem.type === 'Found' ? 'Found' : 'Lost'}</div>
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        {selectedItem.date_lost_found?.toDate ? 
                          selectedItem.date_lost_found.toDate().toLocaleDateString() : 
                          selectedItem.date_lost_found || 'N/A'}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#666', 
                        fontWeight: '600', 
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>Location</div>
                      <div style={{ fontSize: '1rem', color: '#333' }}>{selectedItem.location || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </Modal.Body>

            </Modal>
          )}
        </Container>
      </div>
    </div>
  );
}

export default BrowseItems