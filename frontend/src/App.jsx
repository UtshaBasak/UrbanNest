import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Properties from './pages/Properties';
import PropertyDetails from './pages/PropertyDetails';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import UserProfile from './pages/UserProfile';
import CreateProperty from './pages/CreateProperty';
import EditProperty from './pages/EditProperty';
import Owners from './pages/Owners';
import Tenants from './pages/Tenants';
import OwnerProperties from './pages/OwnerProperties';
import Notifications from './pages/Notifications';
import ProfileSettings from './pages/ProfileSettings';
import ProfileStatus from './pages/ProfileStatus';
import UserRatings from './pages/UserRatings';
import PropertyReviews from './pages/PropertyReviews';
import PropertyReviewNew from './pages/PropertyReviewNew';
import Favourites from './pages/Favourites';
import Compare from './pages/Compare';
import ProtectedRoute from './components/ProtectedRoute';
import LeaveRequests from './pages/LeaveRequests';
import LeaveRequestNew from './pages/LeaveRequestNew';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 transition-colors duration-200">
            <Navbar />
            <main className="pt-20">
              <Routes>
                <Route path="/compare" element={<Compare />} />
                <Route path="/" element={<Home />} />
                <Route path="/properties" element={<Properties />} />
                <Route 
                  path="/properties/new" 
                  element={
                    <ProtectedRoute roles={['owner','admin']}>
                      <CreateProperty />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/properties/:id" element={<PropertyDetails />} />
                {/* Alias route for direct property links */}
                <Route path="/property/:id" element={<PropertyDetails />} />
                <Route 
                  path="/properties/:id/edit" 
                  element={
                    <ProtectedRoute roles={['owner','admin']}>
                      <EditProperty />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/owners" element={<Owners />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/owners/:id/properties" element={<OwnerProperties />} />
                {/* Map page removed */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/users/:id" element={<UserProfile />} />
                <Route path="/users/:id/ratings" element={<UserRatings />} />
                <Route path="/property/:id/reviews" element={<PropertyReviews />} />
                {/* Alias for pluralized properties path */}
                <Route path="/properties/:id/reviews" element={<PropertyReviews />} />
                {/* New review form (tenants only) */}
                <Route 
                  path="/properties/:id/reviews/new" 
                  element={
                    <ProtectedRoute roles={['tenant']}>
                      <PropertyReviewNew />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/favourites" 
                  element={
                    <ProtectedRoute roles={['tenant']}>
                      <Favourites />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/profile-settings" 
                  element={
                    <ProtectedRoute>
                      <ProfileSettings />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/profile-status" 
                  element={
                    <ProtectedRoute>
                      <ProfileStatus />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/notifications" 
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/leave-requests" 
                  element={
                    <ProtectedRoute roles={['tenant','owner','admin']}>
                      <LeaveRequests />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/leave-requests/new" 
                  element={
                    <ProtectedRoute roles={['tenant']}>
                      <LeaveRequestNew />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
