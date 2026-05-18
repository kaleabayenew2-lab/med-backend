require("dotenv").config();
const { MongoClient } = require("mongodb");

// prefer MONGODB_URI, then MONGO_URI, then local
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';

if (!uri) {
  console.error("❌ MongoDB connection string not provided");
  process.exit(1);
}

const client = new MongoClient(uri);

async function recreateUsernameIndex(dbName) {
  console.log(`\n=== Processing database: ${dbName} ===`);
  const db = client.db(dbName);
  const users = db.collection("users");

  try {
    await users.dropIndex("username_1");
    console.log("Dropped existing index: username_1");
  } catch (e) {
    console.log("No index to drop or error:", e.message);
  }

  // ✅ Compatible partial index
  await users.createIndex(
    { username: 1 },
    {
      unique: true,
      partialFilterExpression: {
        username: { $exists: true }
      }
    }
  );

  console.log("Created unique partial index on username");
}

async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    await recreateUsernameIndex("telegram_games");
    await recreateUsernameIndex("mobile_users");

    console.log("\n✅ Index migration completed");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.close();
  }
}

run();
