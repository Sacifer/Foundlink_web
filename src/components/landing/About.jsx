import React from 'react'
import { Container, Row, Col, Card, Button } from 'react-bootstrap'

function About({ onSignInClick, onRegisterClick }) {
    const buttonStyle = {
        borderColor: 'var(--bs-primary-custom)',
        color: 'var(--bs-primary-custom)',
        borderRadius: '50px',
        backgroundColor: 'transparent',
        transition: 'all 0.3s ease'
    }

    const buttonHoverStyle = {
        backgroundColor: 'var(--bs-primary-custom)',
        color: '#fff',
        borderColor: 'var(--bs-primary-custom)',
    }

    return (
        <section id="about"
            className="font-outfit py-5 px-3"
            style={{
                background: `
                    linear-gradient(
                        180deg,
                        rgba(255,255,255,1) 0%,
                        rgba(255,255,223,0.5) 50%,
                        rgba(255,223,0,0.15) 100%
                    )
                `
            }}
        >
            <Container>
                <h2 className="mb-4 fw-semibold font-outfit text-center"
                    style={{ fontSize: '1.5rem', color: 'var(--bs-primary-custom)' }}>
                    Core Features
                </h2>

                <Row className="justify-content-center mb-4 g-3">
                    <Col xs={12} md={4}>
                        <Card className="border rounded-4 shadow-sm h-100 p-2"
                            style={{ borderColor: 'var(--bs-primary-custom)' }}>
                            <Card.Body className="p-2 text-center">
                                <Card.Title className="mb-1 fw-semibold font-outfit"
                                    style={{ fontSize: '0.95rem' }}>
                                    📷 Smart Recognition
                                </Card.Title>
                                <Card.Text className="small">
                                    Upload photos of found items and let AI assist in matching them to lost reports.
                                </Card.Text>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col xs={12} md={4}>
                        <Card className="border rounded-4 shadow-sm h-100 p-2"
                            style={{ borderColor: 'var(--bs-primary-custom)' }}>
                            <Card.Body className="p-2 text-center">
                                <Card.Title className="mb-1 fw-semibold font-outfit"
                                    style={{ fontSize: '0.95rem' }}>
                                    🔔 Real-Time Alerts
                                </Card.Title>
                                <Card.Text className="small">
                                    Get notified instantly when an item similar to yours is found.
                                </Card.Text>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col xs={12} md={4}>
                        <Card className="border rounded-4 shadow-sm h-100 p-2"
                            style={{ borderColor: 'var(--bs-primary-custom)' }}>
                            <Card.Body className="p-2 text-center">
                                <Card.Title className="mb-1 fw-semibold font-outfit"
                                    style={{ fontSize: '0.95rem' }}>
                                    📍 Location-Based Search
                                </Card.Title>
                                <Card.Text className="small">
                                    Find items faster with search filtered by location and category.
                                </Card.Text>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <Row className="justify-content-center mb-5 g-4">
                    <Col xs={12} md={6}>
                        <Card className="p-4 shadow-lg rounded-4 h-100">
                            <h2 className="fw-semibold mb-3 text-center"
                                style={{ fontSize: '1.5rem', color: 'var(--bs-primary-custom)' }}>
                                For Students & Staff
                            </h2>
                            <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                                <li>Securely report lost or found items</li>
                                <li>Search and claim belongings online</li>
                                <li>Receive notification updates and claim tracking</li>
                            </ul>
                        </Card>
                    </Col>

                    <Col xs={12} md={6}>
                        <Card className="p-4 shadow-lg rounded-4 h-100">
                            <h2 className="fw-semibold mb-3 text-center"
                                style={{ fontSize: '1.5rem', color: 'var(--bs-primary-custom)' }}>
                                For Administrators
                            </h2>
                            <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                                <li>Validate and manage reports via dashboard</li>
                                <li>Monitor activity for accountability</li>
                                <li>Leverage AI-powered matching for efficiency</li>
                            </ul>
                        </Card>
                    </Col>
                </Row>

                <h2 className="mb-3 fw-semibold font-outfit text-center"
                    style={{ fontSize: '1.75rem', color: 'var(--bs-primary-custom)' }}>
                    Ready to Reconnect?
                </h2>
                <div className="d-flex justify-content-center align-items-center gap-2 flex-wrap">
                    <Button
                        onClick={onSignInClick}
                        variant="outline-primary"
                        className="font-outfit fw-bold"
                        style={buttonStyle}
                        onMouseEnter={(e) => Object.assign(e.target.style, buttonHoverStyle)}
                        onMouseLeave={(e) => Object.assign(e.target.style, buttonStyle)}
                    >
                        Sign In
                    </Button>

                    <span style={{ margin: '0 0.5rem', fontWeight: '500', color: 'var(--bs-primary-custom)' }}>or</span>

                    <Button
                        onClick={onRegisterClick}
                        variant="outline-primary"
                        className="font-outfit fw-bold"
                        style={buttonStyle}
                        onMouseEnter={(e) => Object.assign(e.target.style, buttonHoverStyle)}
                        onMouseLeave={(e) => Object.assign(e.target.style, buttonStyle)}
                    >
                        Create an Account
                    </Button>
                </div>
            </Container>
        </section>
    )
}

export default About