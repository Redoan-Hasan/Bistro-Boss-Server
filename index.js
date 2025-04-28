const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qhz4s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    const menuCollection = client.db("Bistro-Boss-DB").collection("Menu");
    const reviewsCollection = client.db("Bistro-Boss-DB").collection("Reviews");
    const cartsCollection = client.db("Bistro-Boss-DB").collection("Carts");
    const  usersCollection = client.db("Bistro-Boss-DB").collection("Users");

    // fetching all menu items
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    // fetching all reviews
    app.get("/testimonials", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    // getting the total count of data
    app.get("/menuCount", async (req, res) => {
      const filter = req?.query.filter;
      const result = await menuCollection.countDocuments({ category: filter });
      res.send({ count: result });
    });

    // api for fetching menus by category with pagination
    app.get("/allMenus", async (req, res) => {
      const page = parseInt(req?.query.page) - 1;
      const size = parseInt(req?.query.size);
      const filter = req?.query.filter;
      const result = await menuCollection
        .find({ category: filter })
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // posting the cart items
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartsCollection.insertOne(item);
      res.send(result);
    });

    // getting all the carts
    app.get("/carts", async (req, res) => {
      const email = req?.query?.email;
      const query = { userEmail: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });


    // delete one specific cart item from MyCart table 
    app.delete("/MyCart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });


    // api for saving user info in database 
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
