import React, { useState } from 'react'
import Header from '../Header.jsx'
import Footer from '../Footer.jsx'
import Hero from '../landing/Hero.jsx'
import About from '../landing/About.jsx'
import SignIn from './SignIn.jsx'
import Register from './Register.jsx'

function Landing() {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleSignInClick = () => {
    setShowSignIn(true);
    setShowRegister(false);
  };

  const handleRegisterClick = () => {
    setShowRegister(true);
    setShowSignIn(false);
  };

  const handleCloseSignIn = () => setShowSignIn(false);
  const handleCloseRegister = () => setShowRegister(false);

  return (
    <>
      <Header
        onSignInClick={handleSignInClick}
        onRegisterClick={handleRegisterClick}
      />
      <Hero
        onSignInClick={handleSignInClick}
        onRegisterClick={handleRegisterClick}
      />
      <About
        onSignInClick={handleSignInClick}
        onRegisterClick={handleRegisterClick}
      />

      <SignIn show={showSignIn}
        onClose={handleCloseSignIn}
        onSwitchToRegister={() => {
          setShowSignIn(false);
          setShowRegister(true);
        }}
      />

      <Register show={showRegister}
        onHide={handleCloseRegister}
        onSwitchToSignIn={() => {
          setShowRegister(false);
          setShowSignIn(true);
        }}
      />

      <Footer/>
    </>
  );
}

export default Landing