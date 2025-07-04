import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';
import '../UserIcon.css';

const UserIcon = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleUserClick = () => {
    if (isAuthenticated) {
      setShowDropdown(!showDropdown);
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  return (
    <>
      <div className="user-icon-container">
        <button 
          className="user-icon-button"
          onClick={handleUserClick}
          title={isAuthenticated ? user.email : 'Sign In'}
        >
          {isAuthenticated ? (
            <span className="user-avatar">👤</span>
          ) : (
            <span className="sign-in-text">SIGN IN</span>
          )}
        </button>
        
        {isAuthenticated && showDropdown && (
          <div className="user-dropdown">
            <div className="user-info">
              <div className="user-email">{user.email}</div>
              {user.teams && user.teams.length > 0 && (
                <div className="user-teams">
                  {user.teams.map(team => (
                    <div key={team.id} className="user-team">
                      {team.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button 
              className="logout-button"
              onClick={handleLogout}
            >
              LOGOUT
            </button>
          </div>
        )}
        
        {showDropdown && (
          <div 
            className="dropdown-overlay"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
      
      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => setShowLoginModal(false)}
        />
      )}
    </>
  );
};

export default UserIcon;