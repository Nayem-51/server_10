require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

async function fixData() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected.');

    const db = client.db("exportHub");
    const products = db.collection("products");

    console.log('🔄 Fetching all products...');
    const allProducts = await products.find({}).toArray();
    console.log(`found ${allProducts.length} products to check.`);

    let updatedCount = 0;

    for (const p of allProducts) {
      const updates = {};
      let needsUpdate = false;

      // Fix Price
      if (typeof p.price !== 'number') {
        const numPrice = parseFloat(p.price);
        if (!isNaN(numPrice)) {
          updates.price = numPrice;
          needsUpdate = true;
        }
      }

      // Fix Rating
      if (typeof p.rating !== 'number') {
        const numRating = parseFloat(p.rating);
        if (!isNaN(numRating)) {
          updates.rating = numRating;
          needsUpdate = true;
        }
      }

      // Fix Quantity
      if (typeof p.availableQuantity !== 'number') {
        const numQty = parseInt(p.availableQuantity);
        if (!isNaN(numQty)) {
          updates.availableQuantity = numQty;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await products.updateOne({ _id: p._id }, { $set: updates });
        updatedCount++;
        process.stdout.write('.');
      }
    }

    console.log(`\n✅ Fixed data types for ${updatedCount} products.`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixData();
