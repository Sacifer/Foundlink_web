import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Accordion, Button, Image } from 'react-bootstrap'
import Header from '../Header.jsx'
import SignIn from '../pages/SignIn.jsx'
import Register from '../pages/Register.jsx'
import faqImage from '../../assets/faq.png'

const FAQ = () => {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleOpenSignIn = () => {
    setShowSignIn(true);
    setShowRegister(false);
  };
  const handleCloseSignIn = () => setShowSignIn(false);

  const handleOpenRegister = () => {
    setShowRegister(true);
    setShowSignIn(false);
  };
  const handleCloseRegister = () => setShowRegister(false);

  const FAQs = [
    { question: "How does the AI find matches?", answer: "FoundLink's AI compares item descriptions, images, categories, locations, and dates to suggest possible matches between lost and found reports." },
    { question: "Can the AI guarantee a 100% accurate match?", answer: "No system can guarantee 100%. Our AI provides suggested matches that students and the SDAO staff can review, approve, or reject." },
    { question: "What if the AI doesn't find a match?", answer: "Your report stays in the system, and you'll get notified if new items are submitted later that might match." },
    { question: "How do I report a lost item?", answer: "Click “Report Lost Item,” fill in the form with details (item name, description, category, location, date, and image if available), and submit." },
    { question: "How do I report a found item?", answer: "Choose “Report Found Item,” provide details, and upload an image if possible. The item should then be turned over to the SDAO for safekeeping." },
    { question: "Can I edit or delete my report after submission?", answer: "Yes, you can log in to your account and manage your reports anytime." },
    { question: "How long do reports stay in the system?", answer: "Reports remain active until they are marked as claimed, expired, or matched. Claimed items are only released by the SDAO." },
    { question: "How do I claim an item?", answer: "If a possible match is found, you will be notified. To officially claim your lost item, you must visit the Student Development and Activities Office (SDAO), where staff will verify ownership before releasing the item. It's free for everyone." },
    { question: "Is it safe to meet the finder?", answer: "For security reasons, FoundLink does not allow direct handovers between students. All found items are stored and released through the SDAO." },
    { question: "What if someone falsely claims an item?", answer: "The SDAO staff will verify ownership (using item details, unique identifiers, or proof) before releasing any item. This ensures fairness and prevents false claims." },
    { question: "Do I need an account to use FoundLink?", answer: "You can browse without an account, but you'll need one to post or claim items." },
    { question: "Which devices are supported?", answer: "FoundLink works on desktop, tablet, and mobile browsers. A mobile app may also be available." },
    { question: "Who do I contact for help?", answer: "For technical concerns, reach us through the 'Help & Support' page or email support@foundlink.com. For claiming and item-related concerns, please go directly to the SDAO." },
    { question: "What should I do if I spot inappropriate content?", answer: "Please report it using the 'Report' button. Our admins review and remove any violations." },
    { question: "How do I give feedback or suggest improvements?", answer: "We welcome feedback! Use the feedback form inside the platform or contact support." },
  ];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <>
      <Header 
        onSignInClick={handleOpenSignIn} 
        onRegisterClick={handleOpenRegister} 
      />

      <div className="px-4 px-md-5 py-5"
        style={{ backgroundColor: 'var(--bs-secondary-custom)' }}
      >
        <Container fluid>
          <Row className="justify-content-between align-items-start">
            <Col xs={12} lg={7}>
              <h2 className="mb-5 fw-bold"
                style={{
                  fontSize: '3rem',
                  color: 'var(--bs-primary-custom)',
                  lineHeight: '1.2',
                }}
              >
                Frequently Asked <br/> Questions
              </h2>

              <Accordion alwaysOpen>
                {FAQs.map((faq, index) => (
                  <Accordion.Item
                    eventKey={index.toString()}
                    key={index}
                    className="mb-3 border-0 rounded-4 shadow-sm"
                  >
                    <Accordion.Header>
                      <span className="fw-semibold">{faq.question}</span>
                    </Accordion.Header>
                    <Accordion.Body className="text-muted small">
                      {faq.answer}
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Col>

            <Col xs={12} lg={5} className="text-center mt-5 mt-lg-0">
              <Image
                src={faqImage}
                alt="FAQ illustration"
                fluid
                className="mb-4"
                style={{ maxWidth: '90%' }}
              />
              <h3
                className="fw-bold mb-3"
                style={{ fontSize: '2.5rem', color: 'var(--bs-primary-custom)' }}
              >
                More questions?
              </h3>
              <Button
                onClick={handleOpenSignIn}
                className="px-4 py-2 rounded-pill fw-semibold font-outfit"
                style={{
                  backgroundColor: 'var(--bs-primary-custom)',
                  border: 'none',
                  color: '#fff',
                }}
              >
                Sign in and let us know
              </Button>
            </Col>
          </Row>
        </Container>
      </div>

      {showSignIn && (
        <SignIn
          onClose={handleCloseSignIn}
          onSwitchToRegister={handleOpenRegister}
        />
      )}

      {showRegister && (
        <Register
          show={showRegister}
          onHide={handleCloseRegister}
          onSwitchToSignIn={handleOpenSignIn}
        />
      )}
    </>
  );
};

export default FAQ