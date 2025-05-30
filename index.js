const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173"
    ]
  })
);
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
    // ----------------------------
    // -------------JWT------------
    // ----------------------------

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })


    // checking token with middleware 
    const verifyToken = (req, res, next) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        req.decoded = decoded;
        next();
      })
      
    }


    // ensuring admin through middleware 
    const isAdmin = async(req, res, next) => {
      const email = req?.decoded?.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }





    // fetching all menu items for admin
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    // deleting one item from menu with admin 
    app.delete("/deleteMenuItem/:id", verifyToken, isAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    // fetching one single data for manage items route to edit 
    app.get("/editMenuItem/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log("received id", id);
        
        // First try with string ID
        let result = await menuCollection.findOne({ _id: id });
        
        // If not found, try with ObjectId
        if (!result && ObjectId.isValid(id)) {
          result = await menuCollection.findOne({ _id: new ObjectId(id) });
        }
        
        if (!result) {
          return res.status(404).send({ error: "Menu item not found" });
        }
        
        console.log(result);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    // edit a single menu data from admin panel 
    app.patch("/updateMenuItem/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedItem = req.body;
        
        // Try string ID first without upsert
        let filter = { _id: id };
        let result = await menuCollection.updateOne(filter, {
          $set: {
            name: updatedItem.name,
            price: updatedItem.price,
            recipe: updatedItem.recipe,
            image: updatedItem.image,
            category: updatedItem.category,
          }
        });
        
        // If no document matched, try with ObjectId without upsert
        if (result.matchedCount === 0 && ObjectId.isValid(id)) {
          filter = { _id: new ObjectId(id) };
          result = await menuCollection.updateOne(filter, {
            $set: {
              name: updatedItem.name,
              price: updatedItem.price,
              recipe: updatedItem.recipe,
              image: updatedItem.image,
              category: updatedItem.category,
            }
          });
        }
        
        // If still no match, return an error
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Menu item not found" });
        }
        
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ error: error.message });
      }
    });


    // delete one specific menu item 
    app.delete("/deleteMenuItem/:id", async (req, res) => {
  const id = req.params.id;
  let result;

  if (ObjectId.isValid(id)) {
    // Try with ObjectId
    result = await menuCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount > 0) {
      return res.send({ success: true, message: "Deleted by ObjectId" });
    }
  }

  // Try with string _id as fallback
  result = await menuCollection.deleteOne({ _id: id });
  if (result.deletedCount > 0) {
    return res.send({ success: true, message: "Deleted by string id" });
  }

  return res.status(404).send({ success: false, message: "Item not found" });
});

    // posting new menu item from admin panel 
    app.post("/singleMenu",verifyToken, isAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
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
      const query = {email:user?.email}
      const existingUser = await usersCollection.findOne(query);
      if(existingUser){
        return res.send({message:"user already exists"})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // getting all the users from database 
    app.get("/users", verifyToken, isAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // delete one specific user from db 
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // adding a property to a user to make him admin through patch method 
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // api for checking is logged in user is admin or not 
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if(email !== req.decoded?.email){
        return res.status(403).send({message:"Unauthorized access"})
      }
      const query = {email : email};
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      console.log(result);
      res.send(result);
    })

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
