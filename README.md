# 🌐 Export Hub API Server

Backend REST API for Export Hub - Product Import/Export Management System

**Live API:** [URL will be added after Vercel deployment]

---

## 📋 Features

1. **User Management**
   - User registration with password hashing
   - User login with authentication
   - Get all users or specific user by email
   - Support for Google authentication

2. **Product Management**
   - Create, read, update, and delete products
   - Get latest 6 products (sorted by creation date)
   - Search products by name with pagination
   - Automatic quantity tracking

3. **Import/Export Operations**
   - Import products with quantity validation
   - Track user imports and exports
   - Update existing imports automatically
   - Prevent deletion of products with active imports

4. **Database Operations**
   - MongoDB integration with proper indexing
   - Atomic operations using $inc operator
   - Aggregation for statistics
   - Real-time data synchronization

5. **API Features**
   - CORS enabled for cross-origin requests
   - Environment variable configuration
   - Comprehensive error handling
   - Request logging and monitoring

---

## 🚀 Technologies

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **dotenv** - Environment variables
- **CORS** - Cross-origin resource sharing

---

## 📡 API Endpoints

### Authentication
```
POST   /users          - Register new user
POST   /login          - Login user
GET    /users          - Get all users
GET    /users/:email   - Get user by email
```

### Products
```
GET    /products/latest      - Get latest 6 products
GET    /products            - Get all products (with pagination & search)
GET    /products/:id        - Get single product
POST   /products            - Add new product
PUT    /products/:id        - Update product
DELETE /products/:id        - Delete product
```

### Imports & Exports
```
GET    /exports/:email      - Get user's exports
GET    /imports/:email      - Get user's imports
POST   /imports             - Import a product
DELETE /imports/:id         - Remove an import
```

---

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone [your-repo-url]
   cd server_10
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   
   Create a `.env` file:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/exportHub?retryWrites=true&w=majority
   PORT=3000
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Start production server**
   ```bash
   npm start
   ```

---

## 📦 Dependencies

```json
{
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "express": "^5.1.0",
  "mongodb": "^7.0.0",
  "mongoose": "^8.19.3"
}
```

---

## 🗄️ Database Collections

### users
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  image: String,
  createdAt: Date
}
```

### products
```javascript
{
  _id: ObjectId,
  productName: String,
  productImage: String,
  price: Number,
  originCountry: String,
  rating: Number,
  availableQuantity: Number,
  userEmail: String,
  userName: String,
  createdAt: Date,
  updatedAt: Date
}
```

### imports
```javascript
{
  _id: ObjectId,
  productId: String,
  productName: String,
  productImage: String,
  price: Number,
  rating: Number,
  originCountry: String,
  importedQuantity: Number,
  userEmail: String,
  userName: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔒 Security Features

- Environment variables for sensitive data
- CORS configuration
- Input validation
- Error handling middleware
- MongoDB injection prevention
- Atomic operations for data consistency

---

## 📊 Special Features

### Delete Protection
Products with active imports cannot be deleted:
```javascript
const importCount = await importsCollection.countDocuments({ productId: id });
if (importCount > 0) {
  return res.status(400).send({
    error: `Cannot delete this product. ${importCount} user(s) have imported it.`
  });
}
```

### Atomic Quantity Updates
Using MongoDB $inc operator for thread-safe updates:
```javascript
await productsCollection.updateOne(
  { _id: new ObjectId(productId) },
  { $inc: { availableQuantity: -parseInt(importedQuantity) } }
);
```

### Smart Import Handling
Automatically updates existing imports:
```javascript
const existingImport = await importsCollection.findOne({
  productId: productId,
  userEmail: userEmail
});

if (existingImport) {
  await importsCollection.updateOne(
    { _id: existingImport._id },
    { $inc: { importedQuantity: parseInt(importedQuantity) } }
  );
}
```

---

## 🚀 Deployment to Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Add environment variable**
   ```bash
   vercel env add MONGODB_URI
   ```

5. **Deploy to production**
   ```bash
   vercel --prod
   ```

---

## 🧪 Testing

Test the API endpoints using:
- **Postman** - API testing tool
- **Thunder Client** - VS Code extension
- **curl** - Command line tool

Example:
```bash
# Get all products
curl http://localhost:3000/products

# Get latest 6 products
curl http://localhost:3000/products/latest

# Search products
curl http://localhost:3000/products?search=phone&page=1&limit=10
```

---

## 📝 Response Format

### Success Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 12,
    "totalPages": 9
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## 🔧 MongoDB Setup

1. Create account at [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a cluster
3. Get connection string
4. Add to `.env` file
5. Set Network Access to `0.0.0.0/0` for Vercel deployment

---

## 📞 Support

For issues or questions:
- Create an issue on GitHub
- Email: info@exporthub.com

---

## 👤 Developer

**Export Hub Backend Team**  
© 2025 Export Hub - All rights reserved

---

**Built with Node.js, Express, and MongoDB** ⚡
