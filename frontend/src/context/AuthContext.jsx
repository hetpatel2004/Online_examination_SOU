/**
 * Authentication Context - Manages user authentication state globally
 * 
 * WHAT IS CONTEXT?
 * ================
 * React Context allows us to share data across all components
 * without passing props through every component manually.
 * 
 * This context manages:
 * 1. Current user data (name, email, role, etc.)
 * 2. Authentication token (JWT)
 * 3. Login/Logout functions
 * 
 * HOW ROLE WORKS HERE:
 * ====================
 * When user logs in, the 'user' object contains the 'role' field.
 * Components can access user.role to check if person is admin or user.
 * 
 * Example usage in any component:
 * const { user } = useAuth();
 * if (user?.role === 'admin') {
 *   // Show admin features
 * }
 */

import { createContext, useState, useContext } from 'react';

// Create the context with default null value
const AuthContext = createContext(null);

/**
 * AuthProvider - Wraps the entire app and provides auth state
 * 
 * Any component in the app can access:
 * - user: Current user object (contains role, name, email, etc.)
 * - token: JWT token for API calls
 * - login(userData, token): Function to login
 * - logout(): Function to logout
 */
export const AuthProvider = ({ children }) => {
  // Restore user + token from localStorage on page load
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  
  const [token, setToken] = useState(localStorage.getItem('token'));

  const login = (userData, token) => {
    setUser(userData);
    setToken(token);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Provide auth state and functions to all child components
  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to use auth context in any component
 * 
 * Usage:
 * const { user, token, login, logout } = useAuth();
 * 
 * user.role can be:
 * - 'admin' → Admin access
 * - 'user' → Student access
 */
export const useAuth = () => useContext(AuthContext);
