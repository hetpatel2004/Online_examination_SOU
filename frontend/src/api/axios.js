/**
 * Axios API Configuration - HTTP client for making backend API calls
 * 
 * WHAT THIS FILE DOES:
 * ====================
 * 1. Creates a configured axios instance with base URL
 * 2. Adds JWT token to every request automatically (via interceptor)
 * 3. Exports named functions for specific API calls
 * 
 * HOW THE INTERCEPTOR WORKS:
 * ==========================
 * Before every API request, this interceptor:
 * 1. Reads the JWT token from localStorage
 * 2. If token exists, adds it to the Authorization header
 * 3. Format: "Bearer eyJhbGciOiJIUzI1NiIs..."
 * 4. Backend uses this token to verify who is making the request
 * 
 * This means we don't need to manually add the token to each API call.
 * 
 * EXPORTED FUNCTIONS:
 * ===================
 * - register(userData) → POST /api/auth/register
 * - login(userData)    → POST /api/auth/login
 * - default export     → Full axios instance for custom calls (e.g., API.get('/admin/users'))
 */

import axios from 'axios';

// Create axios instance.
// Backend mounts ALL routes under /api/ prefix (e.g. /api/auth/login, /api/admin/users).
// VITE_API_URL must include /api at the end. In dev, defaults to local backend.
// In production build (no VITE_API_URL), uses the deployed Render backend.
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://online-examination-sou.onrender.com/api'
});

// Request interceptor - adds JWT token to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Named exports for common API calls
export const register = (userData) => API.post('/auth/register', userData);
export const login = (userData) => API.post('/auth/login', userData);

// Default export - use for custom calls like:
// import API from '../api/axios';
// const { data } = await API.get('/admin/users');
// const { data } = await API.post('/admin/subjects', subjectData);
// const { data } = await API.put(`/admin/users/${id}`, updatedData);
// await API.delete(`/admin/users/${id}`);
export default API;
