import React from "react";
import { Container } from "react-bootstrap";

function Footer() {
  return (
    <footer
      className="py-3 shadow-sm border-top bg-white bg-opacity-90"
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        transition: "all 0.3s ease",
      }}
    >
      <Container className="px-4 d-flex flex-column flex-sm-row align-items-center justify-content-between text-center text-sm-start">

        <p className="mb-0 text-muted small">
          Foundlink, 2025 | NU Dasmariñas
        </p>
      </Container>
    </footer>
  );
}

export default Footer