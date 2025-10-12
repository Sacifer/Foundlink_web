import React from 'react'
import { Container, Row, Col, Button, Image, Card } from 'react-bootstrap'
import hero from '../../assets/hero.jpg'

function Hero({ onSignInClick }) {
  return (
    <section id="home"
      className="d-flex align-items-center justify-content-center py-5 position-relative"
      style={{
        minHeight: "100vh",
        background: `
          linear-gradient(
            180deg,
            rgba(255, 223, 0, 0.15) 0%,
            rgba(255, 255, 255, 1) 100%
          )
        `,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-120px",
          left: "-100px",
          width: "300px",
          height: "300px",
          background:
            "radial-gradient(circle, rgba(255, 223, 0, 0.15), transparent 70%)",
          borderRadius: "50%",
          filter: "blur(60px)",
        }}>
      </div>

      <Container>
        <Card className="border-0 shadow-lg mx-auto p-4 p-md-5 rounded-4"
          style={{
            maxWidth: "850px",
            backgroundColor: "#ffffff",
            marginTop: "-70px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <Row className="align-items-center g-4">
            <Col lg={6} className="text-center text-lg-start">
              <h1
                className="fw-bold mb-3 font-outfit"
                style={{
                  fontSize: "2.4rem",
                  lineHeight: "1.2",
                  color: "var(--bs-primary-custom)",
                }}
              >
                Welcome to{" "}
                <span style={{ color: "var(--bs-primary-custom)" }}>
                  FoundLink
                </span>
              </h1>

              <p className="mb-4 font-poppins"
                style={{
                  fontSize: "1.05rem",
                  margin: "0 auto 1.8rem",
                  color: "var(--bs-primary-custom)",
                }}
              >
                Reconnect. Recover. Relax. <br/>
                Your trusted platform for lost and found items.
              </p>

              <div className="d-flex justify-content-center justify-content-lg-start gap-2 flex-wrap">
                <Button onClick={onSignInClick}
                  className="px-3 py-1.5 rounded-pill fw-semibold font-outfit"
                  style={{
                    backgroundColor: "var(--bs-primary-custom)",
                    border: "none",
                    color: "#fff",
                    fontSize: "0.9rem",
                  }}
                >
                  Report Lost Items
                </Button>

                <Button onClick={onSignInClick}
                  className="px-3 py-1.5 rounded-pill fw-semibold font-outfit"
                  style={{
                    backgroundColor: "var(--bs-primary-custom)",
                    border: "none",
                    color: "#fff",
                    fontSize: "0.9rem",
                  }}
                >
                  Report Found Items
                </Button>
              </div>
            </Col>

            <Col lg={6} className="text-center">
              <Image src={hero}
                alt="Foundlink illustration"
                fluid
                className="mx-auto d-block rounded-3"
                style={{
                  maxHeight: "360px",
                  objectFit: "contain",
                  boxShadow: "none",
                  border: "none",
                }}
              />
            </Col>
          </Row>
        </Card>
      </Container>
    </section>
  );
}

export default Hero