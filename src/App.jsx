import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Landing from './components/pages/Landing.jsx'
import FAQ from './components/landing/FAQ.jsx'
import SignIn from './components/pages/SignIn.jsx'
import Register from './components/pages/Register.jsx'
import ForgotPass from './components/ForgotPass.jsx'
import StudentDashboard from './components/authSection/StudentDashboard.jsx'
import ReportItem from './components/authSection/ReportItem.jsx'
import EditProfile from './components/authSection/EditProfile.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'
import Notifications from './components/authSection/Notifications.jsx'
import BrowseItems from './components/authSection/BrowseItems.jsx'
import UserManagement from './components/admin/UserManagement.jsx'
import ItemManagement from './components/admin/ItemManagement.jsx'
import AiMatches from './components/admin/AiMatches.jsx'

function App() {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPass, setShowForgotPass] = useState(false);

  const handleSignInClick = () => setShowSignIn(true);
  const handleCloseSignIn = () => setShowSignIn(false);

  const handleRegisterClick = () => setShowRegister(true);
  const handleCloseRegister = () => setShowRegister(false);

  const handleForgotPassClick = () => setShowForgotPass(true);
  const handleCloseForgotPass = () => setShowForgotPass(false);

  return (
    <Router>
      <SignIn show={showSignIn}
        onClose={handleCloseSignIn}
        onSwitchToRegister={() => {
          setShowSignIn(false);
          setShowRegister(true);
        }}
        onForgotPassword={() => {
          setShowSignIn(false);
          setShowForgotPass(true);
        }}
      />

      <Register show={showRegister}
        onHide={handleCloseRegister}
        onSwitchToSignIn={() => {
          setShowRegister(false);
          setShowSignIn(true);
        }}
      />

      <ForgotPass show={showForgotPass}
        onClose={handleCloseForgotPass}
        onBackToSignIn={() => {
          setShowForgotPass(false);
          setShowSignIn(true);
        }}
      />

      <Routes>
        <Route path="/"
          element={
            <Landing onSignInClick={handleSignInClick}
              onRegisterClick={handleRegisterClick}
            />
          }
        />
        <Route path="/faq"
          element={
            <FAQ onSignInClick={handleSignInClick}
              onRegisterClick={handleRegisterClick}
            />
          }
        />
        <Route path="/student-dashboard" element={<StudentDashboard/>}/>
        <Route path="/report" element={<ReportItem/>}/>
        <Route path="/edit-profile" element={<EditProfile/>}/>
        <Route path="/admin-dashboard" element={<AdminDashboard/>}/>
        <Route path="/notifications" element={<Notifications/>}/>
        <Route path="/browse-items" element={<BrowseItems/>}/>
        <Route path="/user-management" element={<UserManagement/>}/>
        <Route path="/item-management" element={<ItemManagement/>}/>
        <Route path="/ai-matches" element={<AiMatches/>}/>
      </Routes>
    </Router>
  );
}

export default App