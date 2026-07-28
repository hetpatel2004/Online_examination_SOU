/**
 * Server.js - Main Backend Entry Point
 * 
 * WHAT THIS FILE DOES:
 * ====================
 * 1. Creates Express server
 * 2. Connects to MongoDB database
 * 3. Registers middleware (CORS, JSON parsing)
 * 4. Mounts route handlers at specific URL paths
 * 5. In production: serves frontend build as static files
 * 6. Starts listening for HTTP requests
 * 
 * ROUTE STRUCTURE:
 * ================
 * /api/auth       → Authentication routes (register, login)
 * /api/admin      → Admin-only routes (manage students, subjects)
 * /api/subjects   → Subject viewing (any logged-in user)
 * /api/exams      → Exam viewing (any logged-in user)
 * /api/superadmin → Super Admin management
 * 
 * PRODUCTION DEPLOYMENT:
 * ======================
 * Frontend is built to ../frontend/dist/ and served as static files.
 * SPA routing: all non-API routes return index.html for client-side routing.
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import route handlers
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const subjectRoutes = require('./routes/subjects');
const examRoutes = require('./routes/exams');
const superAdminRoutes = require('./routes/superadmin');

const app = express();

// Middleware: Enable CORS so frontend can call this API
app.use(cors());

// Middleware: Parse JSON request bodies (req.body)
app.use(express.json({ limit: '10mb' }));

// Connect to MongoDB Atlas using connection string from .env
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Mount route handlers at specific URL paths
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/superadmin', superAdminRoutes);

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is working',
    dbConnected: mongoose.connection.readyState === 1
  });
});

// Production: serve frontend build as static files
if (process.env.NODE_ENV === 'production') {
  const frontendBuild = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendBuild));

  // SPA fallback: return index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// Start server on configured port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Verify AI evaluation service is loaded
  try {
    const aiEval = require('./services/aiEvaluation');
    const hasKey = aiEval.hasOpenAIKey();
    console.log(`[STARTUP] AI Evaluation Service: LOADED | OpenAI Key: ${hasKey ? 'CONFIGURED' : 'NOT CONFIGURED (using heuristic fallback)'}`);
  } catch (err) {
    console.error(`[STARTUP] AI Evaluation Service FAILED TO LOAD:`, err.message);
  }
});
