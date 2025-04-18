const mongoose = require('mongoose');
const { User } = require('../models/user');
const { EncryptionService } = require('../utils/encryption');

const connectDB = async () => {
  try {
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-file-storage';
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      // Add connection pool settings for better performance
      maxPoolSize: 10,
      minPoolSize: 2,
      // Add timeout settings
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    };

    await mongoose.connect(connectionString, options);
    
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
    
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    // Create indexes for better performance
    await createIndexes();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
};

// Create indexes for better query performance
const createIndexes = async () => {
  try {
    // Ensure User model indexes are created
    await User.createIndexes();
    
    // Ensure all models have their indexes created
    const models = mongoose.modelNames();
    console.log(`Creating indexes for models: ${models.join(', ')}`);
    
    for (const modelName of models) {
      if (modelName !== 'User') { // Already handled User above
        const model = mongoose.model(modelName);
        await model.createIndexes();
      }
    }
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating database indexes:', error);
  }
};

const initializeDB = async () => {
  try {
    // Create admin user if it doesn't exist
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      // Generate key pair for admin
      const { publicKey, privateKey } = await EncryptionService.generateKeyPair();
      
      // Hash admin password
      const password = process.env.ADMIN_PASSWORD || 'admin@123'; // Change in production!
      const passwordHash = await User.hashPassword(password);
      
      // Generate PassMatrix sequence for admin
      const defaultSequence = '1,2,3,4,5'; // Change in production!
      const { hash: passMatrixHash, salt: passMatrixSalt } = User.hashPassMatrix(defaultSequence);

      // Encrypt private key
      const encryptedPrivateKey = EncryptionService.encryptKey(
        Buffer.from(privateKey),
        password
      );

      const admin = new User({
        username: 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@pixvault.com',
        passwordHash,
        passMatrixHash,
        passMatrixSalt,
        publicKey,
        encryptedPrivateKey,
        role: 'admin',
        permissions: [
          'file:upload',
          'file:download',
          'file:share',
          'file:delete',
          'user:manage'
        ],
        status: 'active'
      });
      
      await admin.save();
      console.log('Created default admin user');
    }

    console.log('Database initialization complete');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  initializeDB
};