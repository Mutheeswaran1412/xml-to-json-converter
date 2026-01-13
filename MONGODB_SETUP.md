# MongoDB Setup Guide

This application uses MongoDB as its database. Follow these steps to set up MongoDB for your XML to JSON converter.

## Prerequisites

- MongoDB Atlas account (recommended) or local MongoDB installation
- Node.js and npm installed

## MongoDB Atlas Setup (Recommended)

1. **Create a MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Sign up for a free account

2. **Create a New Cluster**
   - Click "Create a New Cluster"
   - Choose the free tier (M0)
   - Select your preferred cloud provider and region
   - Click "Create Cluster"

3. **Configure Database Access**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Create a username and password
   - Set appropriate privileges (Read and write to any database)

4. **Configure Network Access**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - Add your current IP address or use 0.0.0.0/0 for development (not recommended for production)

5. **Get Connection String**
   - Go to "Clusters" and click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password

## Environment Configuration

1. **Update Environment Variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   ```

2. **Edit .env file**
   ```env
   VITE_MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=YourApp
   VITE_DATABASE_NAME=xml_converter
   ```

## Database Collections

The application will automatically create the following collections:

### users
- `_id`: ObjectId (auto-generated)
- `email`: String (unique)
- `full_name`: String
- `role`: String
- `organization`: String
- `total_conversions`: Number
- `created_at`: Date
- `updated_at`: Date

### conversions
- `_id`: ObjectId (auto-generated)
- `user_id`: String (references users._id)
- `filename`: String
- `xml_input`: String
- `json_output`: String
- `file_size`: Number
- `conversion_time_ms`: Number
- `status`: String ('success' | 'error')
- `error_message`: String (nullable)
- `created_at`: Date

### file_storage
- `_id`: ObjectId (auto-generated)
- `user_id`: String (references users._id)
- `filename`: String
- `file_type`: String ('input' | 'output')
- `content`: String
- `file_size`: Number
- `mime_type`: String
- `conversion_id`: String (references conversions._id)
- `created_at`: Date

## Local MongoDB Setup (Alternative)

If you prefer to run MongoDB locally:

1. **Install MongoDB Community Server**
   - Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
   - Follow installation instructions for your operating system

2. **Start MongoDB Service**
   ```bash
   # Windows
   net start MongoDB
   
   # macOS/Linux
   sudo systemctl start mongod
   ```

3. **Update Environment Variables**
   ```env
   VITE_MONGODB_URI=mongodb://localhost:27017
   VITE_DATABASE_NAME=xml_converter
   ```

## Testing the Connection

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Development Server**
   ```bash
   npm run dev
   ```

3. **Test the Application**
   - Open your browser to the development URL
   - Try creating an account and converting an XML file
   - Check your MongoDB database to verify data is being stored

## Security Considerations

- **Never commit your .env file** - it's already in .gitignore
- **Use strong passwords** for database users
- **Restrict IP access** in production environments
- **Use connection string with authentication** in production
- **Enable MongoDB Atlas security features** like encryption at rest

## Troubleshooting

### Connection Issues
- Verify your connection string is correct
- Check that your IP address is whitelisted in MongoDB Atlas
- Ensure your database user has the correct permissions

### Authentication Errors
- Verify username and password in connection string
- Check that the database user exists and has proper roles

### Network Timeouts
- Check your internet connection
- Verify MongoDB Atlas cluster is running
- Try connecting from a different network

## Production Deployment

For production deployment:

1. **Use MongoDB Atlas** for better reliability and security
2. **Set up proper indexing** for better performance:
   ```javascript
   // Create indexes for better query performance
   db.conversions.createIndex({ "user_id": 1, "created_at": -1 })
   db.file_storage.createIndex({ "user_id": 1, "file_type": 1 })
   db.users.createIndex({ "email": 1 }, { unique: true })
   ```
3. **Enable MongoDB Atlas security features**
4. **Set up monitoring and alerts**
5. **Configure backup strategies**

## Support

For MongoDB-specific issues:
- [MongoDB Documentation](https://docs.mongodb.com/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB Community Forums](https://community.mongodb.com/)