require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

let database, productsCollection, importsCollection;
let isMongoConnected = false;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("✓ Successfully connected to MongoDB!");
    isMongoConnected = true;

    database = client.db("exportHub");
    productsCollection = database.collection("products");
    importsCollection = database.collection("imports");
  } catch (error) {
    console.error("✗ MongoDB connection error:", error.message);
    console.log("\n⚠️  MongoDB is not running. Please:");
    console.log("   1. Update MONGODB_URI in .env file with MongoDB Atlas connection string");
    console.log("   2. Or start local MongoDB with 'mongod' command\n");
  }
}

// Middleware to check MongoDB connection
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

// ============================================
// ROOT ENDPOINT
// ============================================
app.get('/', (req, res) => {
  res.send({ 
    success: true,
    message: 'Export Hub Server is running',
    mongoConnected: isMongoConnected,
    endpoints: {
      products: '/products',
      imports: '/imports',
      exports: '/exports'
    }
  });
});

// ============================================
// ALL PRODUCTS ENDPOINTS (Requirement 5)
// ============================================

// Get all products with pagination
app.get('/products', checkMongoConnection, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    // Build search query
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

// Get single product by ID (for Product Details page)
app.get('/products/:id', checkMongoConnection, async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ 
        success: false,
        error: 'Invalid product ID' 
      });
    }

    const product = await productsCollection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).send({ 
        success: false,
        error: 'Product not found' 
      });
    }

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

// ============================================
// ADD EXPORT/PRODUCT ENDPOINTS (Requirement 7)
// ============================================

// Add new product/export
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

    // Validation
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

// ============================================
// MY EXPORTS ENDPOINTS (Requirement 8)
// ============================================

// Get products by user email (My Exports page)
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

// Update product (for My Exports page)
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

// Delete product (for My Exports page)
app.delete('/products/:id', checkMongoConnection, async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ 
        success: false,
        error: 'Invalid product ID' 
      });
    }

    const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).send({ 
        success: false,
        error: 'Product not found' 
      });
    }

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

// ============================================
// MY IMPORTS ENDPOINTS (Requirement 6)
// ============================================

// Import a product (Import Now button)
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

    // Validation
    if (!productId || !productName || !userEmail || !importedQuantity) {
      return res.status(400).send({ 
        success: false,
        error: 'Required fields missing' 
      });
    }

    // Check if product has enough quantity
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

    // Check if user already imported this product
    const existingImport = await importsCollection.findOne({
      productId: productId,
      userEmail: userEmail
    });

    if (existingImport) {
      // Update quantity if already imported
      await importsCollection.updateOne(
        { _id: existingImport._id },
        { 
          $inc: { importedQuantity: parseInt(importedQuantity) },
          $set: { updatedAt: new Date() }
        }
      );
    } else {
      // Create new import
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

    // Decrease available quantity from products
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

// Get all imports by user email (My Imports page)
app.get('/imports/:email', checkMongoConnection, async (req, res) => {
  try {
    const email = req.params.email;
    
    const imports = await importsCollection
      .find({ userEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

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

// Remove imported product (Remove button on My Imports page)
app.delete('/imports/:id', checkMongoConnection, async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ 
        success: false,
        error: 'Invalid import ID' 
      });
    }

    // Get import details before deleting
    const importData = await importsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!importData) {
      return res.status(404).send({ 
        success: false,
        error: 'Import not found' 
      });
    }

    // Return quantity back to product
    await productsCollection.updateOne(
      { _id: new ObjectId(importData.productId) },
      { 
        $inc: { availableQuantity: importData.importedQuantity },
        $set: { updatedAt: new Date() }
      }
    );

    // Delete import
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

// ============================================
// ADDITIONAL USEFUL ENDPOINTS
// ============================================

// Get statistics
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

// Get featured/latest products (for home page)
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

// ============================================
// START SERVER
// ============================================

// Start MongoDB connection
connectToMongoDB();

// Start Express server
app.listen(port, () => {
  console.log(`\n Server is running on port: ${port}`);
  console.log(` Local: http://localhost:${port}`);
  console.log(`\n Available Endpoints:`);
  console.log(`   GET    /                          - Server status`);
  console.log(`   GET    /products                  - All products`);
  console.log(`   GET    /products/:id              - Single product`);
  console.log(`   POST   /products                  - Add new product`);
  console.log(`   PUT    /products/:id              - Update product`);
  console.log(`   DELETE /products/:id              - Delete product`);
  console.log(`   GET    /exports/:email            - My exports`);
  console.log(`   GET    /imports/:email            - My imports`);
  console.log(`   POST   /imports                   - Import product`);
  console.log(`   DELETE /imports/:id               - Remove import`);
  console.log(`   GET    /products/featured/latest  - Featured products`);
  console.log(`   GET    /stats                     - Statistics\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n Shutting down gracefully...');
  await client.close();
  console.log('✓ MongoDB connection closed');
  process.exit(0);
});
