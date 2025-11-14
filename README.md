# 🌐 Export Hub API Server

A complete backend API server for an Import/Export Product Management System built with Node.js, Express, and MongoDB.

## 🚀 Features

- ✅ Product Management (CRUD operations)
- ✅ Import/Export Tracking
- ✅ User Authentication
- ✅ Automatic Quantity Management
- ✅ Pagination & Search
- ✅ RESTful API Design
- ✅ Ready for Vercel Deployment

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (MongoDB Atlas)
- **Deployment**: Vercel
- **Environment**: dotenv

## 📦 Installation

```bash
# Install dependencies
npm install

# Create .env file and add your MongoDB URI
MONGODB_URI=your_mongodb_connection_string
PORT=3000

# Run development server
npm run dev

# Run production server
npm start
```

## 🌐 Deployment

This server is configured for **Vercel deployment**.

👉 **See [DEPLOYMENT.md](./DEPLOYMENT.md)** for complete deployment instructions.

## 📋 API Endpoints

### Products
- `GET /products` - Get all products
- `GET /products/:id` - Get single product
- `POST /products` - Add new product
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product

### Imports & Exports
- `GET /exports/:email` - Get user's exports
- `GET /imports/:email` - Get user's imports
- `POST /imports` - Import a product
- `DELETE /imports/:id` - Remove import

### Users
- `GET /users` - Get all users
- `POST /users` - Register user
- `POST /login` - Login user

### Stats
- `GET /stats` - Get statistics

## 🔧 Environment Variables

Create a `.env` file:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/exportHub
PORT=3000
NODE_ENV=development
```

## 📁 Project Structure

```
server_10/
├── index.js              # Main server file
├── package.json          # Dependencies
├── vercel.json          # Vercel configuration
├── .env                 # Environment variables (don't commit!)
├── .gitignore           # Git ignore rules
├── .vercelignore        # Vercel ignore rules
├── DEPLOYMENT.md        # Deployment guide
└── README.md            # This file
```

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd server_10
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup MongoDB Atlas**
   - Create account at https://mongodb.com/cloud/atlas
   - Create free cluster
   - Get connection string

4. **Configure environment**
   ```bash
   # Create .env file
   echo "MONGODB_URI=your_connection_string" > .env
   echo "PORT=3000" >> .env
   ```

5. **Run the server**
   ```bash
   npm run dev
   ```

6. **Test the API**
   ```
   Open browser: http://localhost:3000
   ```

## 🌐 Deploy to Vercel

**Option 1: Via GitHub**
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

**Option 2: Via CLI**
```bash
npm i -g vercel
vercel login
vercel
```

📖 **Full deployment guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📝 Sample Request

### Get All Products
```javascript
fetch('http://localhost:3000/products')
  .then(res => res.json())
  .then(data => console.log(data));
```

### Add Product
```javascript
fetch('http://localhost:3000/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productName: "Jute Bags",
    productImage: "https://example.com/image.jpg",
    price: 150,
    originCountry: "Bangladesh",
    rating: 4.5,
    availableQuantity: 100,
    userEmail: "seller@example.com",
    userName: "Seller Name"
  })
});
```

## 🔐 Security

- CORS enabled for all origins
- MongoDB connection secured with credentials
- Environment variables for sensitive data
- Input validation on all endpoints

## 🐛 Troubleshooting

### MongoDB Connection Error
- Check MongoDB Atlas network access (allow 0.0.0.0/0)
- Verify connection string in `.env`
- Ensure database user is created

### Server Not Starting
- Check if port 3000 is available
- Verify all dependencies are installed
- Check `.env` file exists

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Complete Vercel deployment instructions
- [MongoDB Atlas Setup](https://www.mongodb.com/docs/atlas/)
- [Express.js Docs](https://expressjs.com/)
- [Vercel Docs](https://vercel.com/docs)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

ISC License

## 👤 Author

Created for Export Hub - Import/Export Management System

## 🎯 Use Cases

- E-commerce platforms
- Import/Export businesses
- Product marketplace
- Inventory management
- Trade management systems

---

**Ready to deploy? Check [DEPLOYMENT.md](./DEPLOYMENT.md)** 🚀
