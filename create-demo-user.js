require('dotenv').config();
const { MongoClient } = require('mongodb');

// URI from env or default local
const uri = process.env.MONGODB_URI;

console.log("Using MongoDB URI:", uri);

async function createDemoUser() {
  const client = new MongoClient(uri);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("Connected!");

    const database = client.db("exportHub");
    const usersCollection = database.collection("users");

    const demoUserEmail = 'demo123@gmail.com';
    const demoUserPassword = 'Nayem1234@';
    
    // Check if user exists
    const existingUser = await usersCollection.findOne({ email: demoUserEmail });
    
    if (existingUser) {
      console.log(`User ${demoUserEmail} already exists.`);
      // Update password just in case
      await usersCollection.updateOne(
        { email: demoUserEmail },
        { 
          $set: { 
            password: demoUserPassword,
            name: "Demo User",
            updatedAt: new Date()
          } 
        }
      );
      console.log(`Updated password for ${demoUserEmail}`);
    } else {
      console.log(`User ${demoUserEmail} not found. Creating...`);
      const newUser = {
        name: "Demo User",
        email: demoUserEmail,
        password: demoUserPassword, // Plain text as per this codebase
        photoURL: "https://ui-avatars.com/api/?name=Demo+User",
        googleAuth: false,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await usersCollection.insertOne(newUser);
      console.log(`Created user ${demoUserEmail}`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

createDemoUser();
