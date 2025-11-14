require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Firebase Admin SDK setup for Vercel deployment (Optional - if using Firebase Auth)
let admin;
try {
  if (process.env.FIREBASE_SERVICE_KEY) {
    const firebaseAdmin = require('firebase-admin');
    
    // Decode the base64 encoded service account key
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
    const serviceAccount = JSON.parse(decoded);
    
    // Initialize Firebase Admin
    admin = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
    
    console.log("✓ Firebase Admin SDK initialized successfully");
  }
} catch (error) {
  console.log("ℹ Firebase Admin SDK not configured (optional)");
}

// MongoDB connection
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

let database, productsCollection, importsCollection, usersCollection;
let isMongoConnected = false;


async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("✓ Successfully connected to MongoDB!");
    isMongoConnected = true;

    database = client.db("exportHub");
    productsCollection = database.collection("products");
    importsCollection = database.collection("imports");
    usersCollection = database.collection("users");
  } catch (error) {
    console.error("✗ MongoDB connection error:", error.message);
    console.log("\n  MongoDB is not running. Please:");
    console.log("   1. Update MONGODB_URI in .env file with MongoDB Atlas connection string");
    console.log("   2. Or start local MongoDB with 'mongod' command\n");
  }
}


const checkMongoConnection = (req, res, next) => {
  if (!isMongoConnected) {
    return res.status(503).send({ 
      success: false,
      error: 'Database not connected',
      message: 'Please configure MongoDB connection in .env file'
    });
  }
  next();
};

app.get('/', (req, res) => {
  res.send({ 
    success: true,
    message: 'Export Hub Server is running',
    mongoConnected: isMongoConnected,
    endpoints: {
      products: '/products',
      imports: '/imports',
      exports: '/exports',
      users: '/users',
      auth: '/login'
    }
  });
});

app.post('/users', checkMongoConnection, async (req, res) => {
  try {
    const { name, email, password, photoURL, googleAuth, uid } = req.body;

    const existingUser = await usersCollection.findOne({ email });
    
    if (existingUser) {
      if (googleAuth) {
        return res.send({
          success: true,
          message: 'User already exists',
          user: {
            email: existingUser.email,
            name: existingUser.name,
            image: existingUser.photoURL || existingUser.image
          }
        });
      }
      return res.status(400).send({ 
        success: false,
        message: 'User already exists with this email' 
      });
    }

    const newUser = {
      name,
      email,
      photoURL: photoURL || '',
      googleAuth: googleAuth || false,
      uid: uid || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (password && !googleAuth) {
      newUser.password = password;
    }

    const result = await usersCollection.insertOne(newUser);

    res.status(201).send({
      success: true,
      message: 'User registered successfully',
      user: {
        email: newUser.email,
        name: newUser.name,
        image: newUser.photoURL
      },
      token: 'user-token-' + result.insertedId
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send({ 
      success: false,
      message: 'Failed to register user' 
    });
  }
});

app.post('/login', checkMongoConnection, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(401).send({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    if (user.password !== password) {
      return res.status(401).send({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    res.send({
      success: true,
      message: 'Login successful',
      user: {
        email: user.email,
        name: user.name,
        image: user.photoURL || user.image
      },
      token: 'user-token-' + user._id
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).send({ 
      success: false,
      message: 'Failed to login' 
    });
  }
});

app.get('/users', checkMongoConnection, async (req, res) => {
  try {
    const users = await usersCollection
      .find({})
      .project({ password: 0 })
      .toArray();

    res.send({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch users' 
    });
  }
});

app.get('/users/:email', checkMongoConnection, async (req, res) => {
  try {
    const email = req.params.email;
    const user = await usersCollection.findOne(
      { email },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).send({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.send({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch user' 
    });
  }
});

app.get('/products/latest', checkMongoConnection, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    
    const products = await productsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.send(products);
  } catch (error) {
    console.error('Error fetching latest products:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch latest products' 
    });
  }
});

app.get('/products', checkMongoConnection, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const searchQuery = search ? {
      $or: [
        { productName: { $regex: search, $options: 'i' } },
        { originCountry: { $regex: search, $options: 'i' } }
      ]
    } : {};

    const products = await productsCollection
      .find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await productsCollection.countDocuments(searchQuery);

    res.send({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch products' 
    });
  }
});

app.get('/products/:id', checkMongoConnection, async (req, res) => {
  try {
    const id = req.params.id;
    console.log('📦 Fetching product with ID:', id);
    
    if (!ObjectId.isValid(id)) {
      console.log('❌ Invalid ObjectId format:', id);
      return res.status(400).send({ 
        success: false,
        error: 'Invalid product ID' 
      });
    }

    const product = await productsCollection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      console.log('❌ Product not found with ID:', id);
      return res.status(404).send({ 
        success: false,
        error: 'Product not found' 
      });
    }

    console.log('✅ Product found:', product.productName);
    res.send({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch product' 
    });
  }
});

app.post('/products', checkMongoConnection, async (req, res) => {
  try {
    const { 
      productName, 
      productImage, 
      price, 
      originCountry, 
      rating, 
      availableQuantity,
      userEmail,
      userName 
    } = req.body;

    if (!productName || !productImage || !price || !originCountry || !rating || !availableQuantity || !userEmail) {
      return res.status(400).send({ 
        success: false,
        error: 'All fields are required' 
      });
    }

    const product = {
      productName,
      productImage,
      price: parseFloat(price),
      originCountry,
      rating: parseFloat(rating),
      availableQuantity: parseInt(availableQuantity),
      userEmail,
      userName: userName || 'Anonymous',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await productsCollection.insertOne(product);

    res.status(201).send({
      success: true,
      message: 'Product added successfully',
      data: { ...product, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to create product' 
    });
  }
});

app.get('/exports/:email', checkMongoConnection, async (req, res) => {
  try {
    const email = req.params.email;
    
    const products = await productsCollection
      .find({ userEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Error fetching user products:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch user products' 
    });
  }
});

app.put('/products/:id', checkMongoConnection, async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ 
        success: false,
        error: 'Invalid product ID' 
      });
    }

    const { 
      productName, 
      productImage, 
      price, 
      originCountry, 
      rating, 
      availableQuantity 
    } = req.body;

    const updateDoc = {
      $set: {
        ...(productName && { productName }),
        ...(productImage && { productImage }),
        ...(price && { price: parseFloat(price) }),
        ...(originCountry && { originCountry }),
        ...(rating && { rating: parseFloat(rating) }),
        ...(availableQuantity !== undefined && { availableQuantity: parseInt(availableQuantity) }),
        updatedAt: new Date()
      }
    };

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ 
        success: false,
        error: 'Product not found' 
      });
    }

    res.send({
      success: true,
      message: 'Product updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to update product' 
    });
  }
});

app.delete('/products/:id', checkMongoConnection, async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ 
        success: false,
        error: 'Invalid product ID' 
      });
    }

    const importCount = await importsCollection.countDocuments({ 
      productId: id 
    });

    if (importCount > 0) {
      console.log(`❌ Cannot delete product ${id}: ${importCount} user(s) have imported it`);
      return res.status(400).send({ 
        success: false,
        error: `Cannot delete this product. ${importCount} user(s) have imported it. Products with active imports cannot be deleted.`
      });
    }

    const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).send({ 
        success: false,
        error: 'Product not found' 
      });
    }

    console.log(`✅ Product ${id} deleted successfully`);
    res.send({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to delete product' 
    });
  }
});

app.post('/imports', checkMongoConnection, async (req, res) => {
  try {
    const {
      productId,
      productName,
      productImage,
      price,
      rating,
      originCountry,
      importedQuantity,
      userEmail,
      userName
    } = req.body;

    if (!productId || !productName || !userEmail || !importedQuantity) {
      return res.status(400).send({ 
        success: false,
        error: 'Required fields missing' 
      });
    }

    const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
    
    if (!product) {
      return res.status(404).send({ 
        success: false,
        error: 'Product not found' 
      });
    }

    if (product.availableQuantity < parseInt(importedQuantity)) {
      return res.status(400).send({ 
        success: false,
        error: 'Insufficient quantity available' 
      });
    }

    const existingImport = await importsCollection.findOne({
      productId: productId,
      userEmail: userEmail
    });

    if (existingImport) {
      await importsCollection.updateOne(
        { _id: existingImport._id },
        { 
          $inc: { importedQuantity: parseInt(importedQuantity) },
          $set: { updatedAt: new Date() }
        }
      );
    } else {
      const importData = {
        productId,
        productName,
        productImage,
        price: parseFloat(price),
        rating: parseFloat(rating),
        originCountry,
        importedQuantity: parseInt(importedQuantity),
        userEmail,
        userName: userName || 'Anonymous',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await importsCollection.insertOne(importData);
    }

    await productsCollection.updateOne(
      { _id: new ObjectId(productId) },
      { 
        $inc: { availableQuantity: -parseInt(importedQuantity) },
        $set: { updatedAt: new Date() }
      }
    );

    res.status(201).send({
      success: true,
      message: 'Product imported successfully'
    });
  } catch (error) {
    console.error('Error importing product:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to import product' 
    });
  }
});

app.get('/imports/:email', checkMongoConnection, async (req, res) => {
  try {
    const email = req.params.email;
    console.log('📥 Fetching imports for email:', email);
    
    const imports = await importsCollection
      .find({ userEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`✅ Found ${imports.length} imports`);
    imports.forEach((imp, index) => {
      console.log(`Import ${index + 1}: productId = ${imp.productId}, productName = ${imp.productName}`);
    });

    res.send({
      success: true,
      data: imports,
      count: imports.length
    });
  } catch (error) {
    console.error('Error fetching imports:', error);
    res.status(500).send({
      success: false,
      error: 'Failed to fetch imports'
    });
  }
});

app.delete('/imports/:id', checkMongoConnection, async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ 
        success: false,
        error: 'Invalid import ID' 
      });
    }

    const importData = await importsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!importData) {
      return res.status(404).send({ 
        success: false,
        error: 'Import not found' 
      });
    }

    await productsCollection.updateOne(
      { _id: new ObjectId(importData.productId) },
      { 
        $inc: { availableQuantity: importData.importedQuantity },
        $set: { updatedAt: new Date() }
      }
    );

    const result = await importsCollection.deleteOne({ _id: new ObjectId(id) });

    res.send({
      success: true,
      message: 'Import removed successfully'
    });
  } catch (error) {
    console.error('Error removing import:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to remove import' 
    });
  }
});

app.get('/stats', checkMongoConnection, async (req, res) => {
  try {
    const totalProducts = await productsCollection.countDocuments();
    const totalImports = await importsCollection.countDocuments();

    res.send({
      success: true,
      data: {
        totalProducts,
        totalImports
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch statistics' 
    });
  }
});

app.get('/products/featured/latest', checkMongoConnection, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    
    const products = await productsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.send({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch featured products' 
    });
  }
});

connectToMongoDB();

app.listen(port, () => {
  console.log(`\n Server is running on port: ${port}`);
  console.log(` Local: http://localhost:${port}`);
  console.log(`\n Available Endpoints:`);
  console.log(`   GET    /                          - Server status`);
  console.log(`\n   👤 Authentication:`);
  console.log(`   POST   /users                     - Register user`);
  console.log(`   POST   /login                     - Login user`);
  console.log(`   GET    /users                     - All users`);
  console.log(`   GET    /users/:email              - Get user by email`);
  console.log(`\n    Products:`);
  console.log(`   GET    /products/latest           - Latest 6 products`);
  console.log(`   GET    /products                  - All products`);
  console.log(`   GET    /products/:id              - Single product`);
  console.log(`   POST   /products                  - Add new product`);
  console.log(`   PUT    /products/:id              - Update product`);
  console.log(`   DELETE /products/:id              - Delete product`);
  console.log(`\n    Exports & Imports:`);
  console.log(`   GET    /exports/:email            - My exports`);
  console.log(`   GET    /imports/:email            - My imports`);
  console.log(`   POST   /imports                   - Import product`);
  console.log(`   DELETE /imports/:id               - Remove import`);
  console.log(`   GET    /stats                     - Statistics\n`);
});

process.on('SIGINT', async () => {
  console.log('\n\n Shutting down gracefully...');
  await client.close();
  console.log('✓ MongoDB connection closed');
  process.exit(0);
});
