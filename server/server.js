const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import database connection
const { connectDB, initializeDB } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const securityRoutes = require('./routes/security');
const permissionsRoutes = require('./routes/permissions');

// Import middleware
const { errorHandler } = require('./middleware/security');
const { authenticateJWT } = require('./middleware/auth');

// Create Express app
const app = express();
const PORT = process.env.PORT || 8000;

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5174', 'http://127.0.0.1:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['set-cookie']
};

// Apply security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "http:", "https:"],
      "default-src": ["'self'", "http:", "https:"]
    }
  }
}));

// Apply CORS before other middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Parse cookies
app.use(cookieParser());

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve matrix images statically
app.use('/matrix-images', express.static(path.join(__dirname, 'assets/matrix-images')));

// Apply rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', authenticateJWT, fileRoutes);
app.use('/api/security', authenticateJWT, securityRoutes);
app.use('/api/permissions', permissionsRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Secure File Storage API is running' });
});

// Add placeholder image endpoint
app.get('/api/placeholder/:width/:height', (req, res) => {
  const { width, height } = req.params;
  const text = req.query.text || '';
  
  // Create a simple SVG placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#666" 
        dominant-baseline="middle" text-anchor="middle">
        ${text}
      </text>
    </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Error handling
app.use(errorHandler);

// Connect to database and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Initialize database with default data
    await initializeDB();
    
    // Verify environment variables
    verifyEnvironment();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Verify required environment variables
function verifyEnvironment() {
  const requiredVars = [
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
    'JWT_EXPIRY'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`WARNING: Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Using default values for missing variables. This is not recommended for production.');
  }
  
  // Set defaults if not provided
  if (!process.env.JWT_EXPIRY) process.env.JWT_EXPIRY = '1h';
  if (!process.env.REFRESH_TOKEN_EXPIRY) process.env.REFRESH_TOKEN_EXPIRY = '30d';
}

startServer();

module.exports = app;