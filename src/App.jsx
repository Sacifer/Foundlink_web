import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './components/pages/Landing.jsx';
import FAQ from './components/landing/FAQ.jsx';
import SignIn from './components/pages/SignIn.jsx';
import Register from './components/pages/Register.jsx';
import ForgotPass from './components/ForgotPass.jsx';
import StudentDashboard from './components/authSection/StudentDashboard.jsx';
import ReportItem from './components/authSection/ReportItem.jsx';
import EditProfile from './components/authSection/EditProfile.jsx';
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import Notifications from './components/authSection/Notifications.jsx';
import BrowseItems from './components/authSection/BrowseItems.jsx';
import UserManagement from './components/admin/UserManagement.jsx';
import ItemManagement from './components/admin/ItemManagement.jsx';
import AiMatches from './components/admin/AiMatches.jsx';
import ProtectedRoute from './components/authSection/ProtectedRoute.jsx';

function App() {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPass, setShowForgotPass] = useState(false);

  return (
    <Router>
      <SignIn
        show={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSwitchToRegister={() => {
          setShowSignIn(false);
          setShowRegister(true);
        }}
        onForgotPassword={() => {
          setShowSignIn(false);
          setShowForgotPass(true);
        }}
      />

      <Register
        show={showRegister}
        onHide={() => setShowRegister(false)}
        onSwitchToSignIn={() => {
          setShowRegister(false);
          setShowSignIn(true);
        }}
      />

      <ForgotPass
        show={showForgotPass}
        onClose={() => setShowForgotPass(false)}
        onBackToSignIn={() => {
          setShowForgotPass(false);
          setShowSignIn(true);
        }}
      />

      <Routes>
        <Route
          path="/"
          element={<Landing onSignInClick={() => setShowSignIn(true)} onRegisterClick={() => setShowRegister(true)} />}
        />
        <Route
          path="/faq"
          element={<FAQ onSignInClick={() => setShowSignIn(true)} onRegisterClick={() => setShowRegister(true)} />}
        />

        {/* ✅ Protected routes */}
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute requiredRole="user">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/report"
          element={
            <ProtectedRoute requiredRole="user">
              <ReportItem />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-profile"
          element={
            <ProtectedRoute requiredRole="user">
              <EditProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute requiredRole="user">
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/browse-items"
          element={
            <ProtectedRoute requiredRole="user">
              <BrowseItems />
            </ProtectedRoute>
          }
        />

        {/* Admin-only */}
        <Route
          path="/user-management"
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/item-management"
          element={
            <ProtectedRoute requiredRole="admin">
              <ItemManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-matches"
          element={
            <ProtectedRoute requiredRole="admin">
              <AiMatches />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
