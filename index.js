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

// MongoDB connection with Vercel-friendly options
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 30000, // 30 seconds
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
});

let database, productsCollection, importsCollection, usersCollection;
let isMongoConnected = false;


async function connectToMongoDB() {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`🔄 Attempting MongoDB connection... (Attempt ${retryCount + 1}/${maxRetries})`);
      console.log("📍 MongoDB URI exists:", !!uri);
      console.log("📍 MongoDB URI length:", uri ? uri.length : 0);
      console.log("📍 URI type:", typeof uri);
      
      await client.connect();
      
      // Test the connection
      // await client.db("admin").command({ ping: 1 });
      
      console.log("✅ Successfully connected to MongoDB!");
      isMongoConnected = true;

      database = client.db("exportHub");
      productsCollection = database.collection("products");
      importsCollection = database.collection("imports");
      usersCollection = database.collection("users");
      
      console.log("✅ Database and collections initialized");
      return; // Success, exit the function
      
    } catch (error) {
      retryCount++;
      console.error(`❌ MongoDB connection error (Attempt ${retryCount}/${maxRetries}):`, error.message);
      
      if (retryCount >= maxRetries) {
        console.error("❌ All connection attempts failed");
        console.error("✗ Full error:", JSON.stringify(error, null, 2));
        console.error("✗ Error name:", error.name);
        console.log("\n⚠️  MongoDB connection failed after all retries");
      } else {
        console.log(`⏳ Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }
  }
}


// Lazy connection - connect on first request if not connected
const ensureMongoConnection = async () => {
  if (!isMongoConnected) {
    console.log('🔄 MongoDB not connected, connecting now...');
    await connectToMongoDB();
  }
};

const checkMongoConnection = async (req, res, next) => {
  try {
    await ensureMongoConnection();
    
    if (!isMongoConnected) {
      return res.status(503).send({ 
        success: false,
        error: 'Database not connected',
        message: 'Failed to connect to MongoDB. Please check configuration.'
      });
    }
    next();
  } catch (error) {
    console.error('❌ Error in checkMongoConnection:', error);
    return res.status(503).send({ 
      success: false,
      error: 'Database connection error',
      message: error.message
    });
  }
};

app.get('/', async (req, res) => {
  // Try to connect if not connected yet (lazy connection)
  await ensureMongoConnection();
  
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

// Debug endpoint to check environment variables
app.get('/debug', (req, res) => {
  const mongoUri = process.env.MONGODB_URI;
  res.send({
    success: true,
    debug: {
      mongoUriExists: !!mongoUri,
      mongoUriLength: mongoUri ? mongoUri.length : 0,
      mongoUriPrefix: mongoUri ? mongoUri.substring(0, 25) + '...' : 'N/A',
      mongoUriHasDatabase: mongoUri ? mongoUri.includes('/exportHub') : false,
      mongoUriHasCluster: mongoUri ? mongoUri.includes('cluster0.mbp6mif') : false,
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      isMongoConnected: isMongoConnected,
      platform: process.platform,
      nodeVersion: process.version
    }
  });
});

// Test MongoDB connection manually
app.get('/test-connection', async (req, res) => {
  try {
    const testUri = process.env.MONGODB_URI;
    const testClient = new MongoClient(testUri);
    
    console.log('🔄 Testing MongoDB connection...');
    await testClient.connect();
    console.log('✅ Test connection successful!');
    
    await testClient.db("admin").command({ ping: 1 });
    console.log('✅ Ping successful!');
    
    await testClient.close();
    
    res.send({
      success: true,
      message: 'MongoDB connection test successful!',
      details: {
        connected: true,
        pingSuccessful: true
      }
    });
  } catch (error) {
    console.error('❌ Test connection failed:', error);
    res.status(500).send({
      success: false,
      error: error.message,
      errorName: error.name,
      errorCode: error.code,
      errorStack: error.stack
    });
  }
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



app.put('/users/:email', checkMongoConnection, async (req, res) => {
  try {
    const email = req.params.email;
    const { name, photoURL } = req.body;
    
    const updateDoc = {
      $set: {
        ...(name && { name }),
        ...(photoURL && { photoURL, image: photoURL }),
        updatedAt: new Date()
      }
    };

    const result = await usersCollection.updateOne(
      { email },
      updateDoc
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, message: 'User not found' });
    }

    res.send({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send({ success: false, error: 'Failed to update profile' });
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
    const category = req.query.category || ''; // Category filter
    const sort = req.query.sort || 'newest';
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);

    console.log('🔍 GET /products query:', { page, limit, search, category, sort, minPrice, maxPrice });

    // Build query
    const query = {};
    
    // Add search filter
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { originCountry: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add category filter
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    // Add price filter
    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
      query.price = {};
      if (!isNaN(minPrice)) query.price.$gte = minPrice;
      if (!isNaN(maxPrice)) query.price.$lte = maxPrice;
    }

    // Determine sort option
    let sortOptions = { createdAt: -1 }; // Default: Newest
    if (sort === 'price_asc') sortOptions = { price: 1 };
    else if (sort === 'price_desc') sortOptions = { price: -1 };
    else if (sort === 'oldest') sortOptions = { createdAt: 1 };

    const products = await productsCollection
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await productsCollection.countDocuments(query);

    res.send({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        search,
        category,
        minPrice,
        maxPrice,
        sort
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

// Get all categories
app.get('/categories', checkMongoConnection, async (req, res) => {
  try {
    const categories = await productsCollection.distinct("category");
    
    // Get count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await productsCollection.countDocuments({ category });
        return {
          name: category,
          count: count
        };
      })
    );

    res.send({
      success: true,
      data: categoriesWithCount.filter(cat => cat.name), // Remove null/undefined
      total: categoriesWithCount.length
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch categories' 
    });
  }
});

// Get products by category
app.get('/products/category/:categoryName', checkMongoConnection, async (req, res) => {
  try {
    const categoryName = req.params.categoryName;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log('📂 Fetching products for category:', categoryName);

    const products = await productsCollection
      .find({ category: { $regex: categoryName, $options: 'i' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await productsCollection.countDocuments({ 
      category: { $regex: categoryName, $options: 'i' } 
    });

    console.log(`✅ Found ${products.length} products in category: ${categoryName}`);

    res.send({
      success: true,
      category: categoryName,
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch products by category' 
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

    let finalImportId;
    if (existingImport) {
      await importsCollection.updateOne(
        { _id: existingImport._id },
        { 
          $inc: { importedQuantity: parseInt(importedQuantity) },
          $set: { updatedAt: new Date() }
        }
      );
      finalImportId = existingImport._id;
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

      const result = await importsCollection.insertOne(importData);
      finalImportId = result.insertedId;
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
      importId: finalImportId,
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

app.get('/dashboard/stats/:email', checkMongoConnection, async (req, res) => {
  try {
    const email = req.params.email;
    
    // 1. Total Exports (Products added by user)
    const totalExports = await productsCollection.countDocuments({ userEmail: email });
    
    // 2. Total Imports (Items bought by user)
    const imports = await importsCollection.find({ userEmail: email }).toArray();
    const totalImports = imports.reduce((sum, item) => sum + (item.importedQuantity || 0), 0);
    const totalSpent = imports.reduce((sum, item) => sum + ((item.price || 0) * (item.importedQuantity || 0)), 0);

    // 3. Category Distribution (for Pie Chart) - based on their exports
    const userProducts = await productsCollection.find({ userEmail: email }).toArray();
    const categoryMap = {};
    
    userProducts.forEach(p => {
      const cat = p.category || 'Uncategorized';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // 4. Activity Data (Mocked for now since we don't track daily history well)
    const activityData = [
      { name: 'Mon', exports: Math.floor(totalExports * 0.1), imports: Math.floor(totalImports * 0.1) },
      { name: 'Tue', exports: Math.floor(totalExports * 0.2), imports: Math.floor(totalImports * 0.2) },
      { name: 'Wed', exports: Math.floor(totalExports * 0.15), imports: Math.floor(totalImports * 0.3) },
      { name: 'Thu', exports: Math.floor(totalExports * 0.25), imports: Math.floor(totalImports * 0.1) },
      { name: 'Fri', exports: Math.floor(totalExports * 0.2), imports: Math.floor(totalImports * 0.2) },
      { name: 'Sat', exports: Math.floor(totalExports * 0.05), imports: Math.floor(totalImports * 0.05) },
      { name: 'Sun', exports: Math.floor(totalExports * 0.05), imports: Math.floor(totalImports * 0.05) },
    ];

    res.send({
      success: true,
      stats: {
        totalExports,
        totalImports,
        totalSpent,
        totalEarned: 0 // Placeholder
      },
      charts: {
        categoryData,
        activityData
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).send({ 
      success: false,
      error: 'Failed to fetch dashboard stats' 
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

// Connect to MongoDB on-demand (lazy connection for Vercel serverless)
// MongoDB will connect automatically when first request comes
// connectToMongoDB(); // Disabled - using lazy connection

// Start server only if not in Vercel serverless environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`\n🚀 Server is running on port: ${port}`);
    console.log(`📍 Local: http://localhost:${port}`);
    console.log(`\n📋 Available Endpoints:`);
    console.log(`   GET    /                          - Server status`);
    console.log(`\n   👤 Authentication:`);
    console.log(`   POST   /users                     - Register user`);
    console.log(`   POST   /login                     - Login user`);
    console.log(`   GET    /users                     - All users`);
    console.log(`   GET    /users/:email              - Get user by email`);
    console.log(`\n   📦 Products:`);
    console.log(`   GET    /products/latest           - Latest 6 products`);
    console.log(`   GET    /products                  - All products`);
    console.log(`   GET    /products/:id              - Single product`);
    console.log(`   POST   /products                  - Add new product`);
    console.log(`   PUT    /products/:id              - Update product`);
    console.log(`   DELETE /products/:id              - Delete product`);
    console.log(`\n   🔄 Exports & Imports:`);
    console.log(`   GET    /exports/:email            - My exports`);
    console.log(`   GET    /imports/:email            - My imports`);
    console.log(`   POST   /imports                   - Import product`);
    console.log(`   DELETE /imports/:id               - Remove import`);
    console.log(`   GET    /stats                     - Statistics\n`);
    
    // Connect to MongoDB immediately for local dev
    connectToMongoDB();
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  await client.close();
  console.log('✓ MongoDB connection closed');
  process.exit(0);
});

// Export for Vercel
module.exports = app;
