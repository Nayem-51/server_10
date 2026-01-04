require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

async function checkData() {
  try {
    await client.connect();
    const db = client.db("exportHub");
    const products = db.collection("products");

    const allProducts = await products.find({}).project({ productName: 1, price: 1 }).toArray();

    console.log("--- PRODUCT DATA INSPECTION ---");
    allProducts.forEach(p => {
      console.log(`Name: ${p.productName.substring(0, 20)} | Price: ${p.price} (Type: ${typeof p.price})`);
    });
    console.log("-------------------------------");

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkData();
