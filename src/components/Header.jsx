import React, { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Navbar, Nav, Container, Button } from 'react-bootstrap'

function Header({ onSignInClick, onRegisterClick }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = (sectionId) => (e) => {
    e.preventDefault();
    if (location.pathname !== "/") {
      sessionStorage.setItem("scrollToSection", sectionId);
      navigate("/");
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    if (location.pathname === "/") {
      const sectionId = sessionStorage.getItem("scrollToSection");
      if (sectionId) {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
          sessionStorage.removeItem("scrollToSection");
        }
      }
    }
  }, [location]);

  const handleSignIn = (e) => {
    e.preventDefault();
    onSignInClick();
  };

  const handleRegister = (e) => {
    e.preventDefault();
    onRegisterClick();
  };

  return (
    <Navbar
      expand="lg"
      sticky="top"
      className="py-3 shadow-sm bg-white bg-opacity-90 backdrop-blur-md border-0"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transition: "all 0.3s ease",
      }}
    >
      <Container
        fluid
        className="px-4 d-flex justify-content-between align-items-center"
      >
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
          <img src="/foundlink.png"
            alt="FoundLink Logo"
            height="30"
            className="me-2"
            style={{ objectFit: "contain" }}
          />
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="navbar-nav" />

        <Navbar.Collapse id="navbar-nav" className="justify-content-end">
          <Nav className="mx-auto align-items-center gap-3 fw-medium">
            <Nav.Link href="#home"
              onClick={handleNavClick("home")}
              className="nav-link-modern"
            >
              Home
            </Nav.Link>
            <Nav.Link href="#about"
              onClick={handleNavClick("about")}
              className="nav-link-modern"
            >
              About
            </Nav.Link>
            <Nav.Link as={Link} to="/faq" className="nav-link-modern">
              FAQ
            </Nav.Link>
          </Nav>

          <div className="d-flex align-items-center gap-3 mt-3 mt-lg-0">
            <Button onClick={handleSignIn}
              className="px-4 py-2 rounded-pill fw-semibold"
              style={{
                backgroundColor: "transparent",
                border: "1.5px solid #000",
                color: "#000",
                transition: "0.3s ease",
              }}
            >
              Sign In
            </Button>

            <Button onClick={handleRegister}
              className="px-4 py-2 rounded-pill fw-semibold"
              style={{
                backgroundColor: "#000",
                border: "1.5px solid #000",
                color: "#fff",
                transition: "0.3s ease",
              }}
            >
              Register
            </Button>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Header