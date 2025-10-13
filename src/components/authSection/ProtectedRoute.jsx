import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

function ProtectedRoute({ children, requiredRole }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        setRole(userDoc.data().role);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>;

  // 🔒 Not logged in
  if (!user) return <Navigate to="/" replace />;

  // 🔒 Role-based restriction
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // ✅ Authorized user
  return children;
}

export default ProtectedRoute;
