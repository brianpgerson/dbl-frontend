import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Check if a JWT is expired by decoding the payload
const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set up axios interceptor to handle 401/403 responses (expired tokens)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          // Token is invalid or expired — clear auth state
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
          delete axios.defaults.headers.common['Authorization'];
          setUser(null);
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    // Check for existing token on app load
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('authUser');

    if (token && userData) {
      // Check if token is expired before restoring session
      if (isTokenExpired(token)) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      } else {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          // Set default auth header for axios
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
        }
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/login`, {
        email,
        password
      });

      const { token, user: userData } = response.data;

      // Store token and user data
      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(userData));

      // Set auth header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const canManageTeam = (teamId, teamLeagueId = null) => {
    // Check if user directly manages this team
    const directlyManages = user?.teams?.some(team => team.id === teamId) || false;
    
    // Check if user is commissioner for this team's league
    let isCommissionerForLeague = false;
    if (teamLeagueId && user?.commissionerLeagueIds) {
      isCommissionerForLeague = user.commissionerLeagueIds.includes(teamLeagueId);
    }
    
    return directlyManages || isCommissionerForLeague;
  };

  const value = {
    user,
    login,
    logout,
    canManageTeam,
    loading,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};