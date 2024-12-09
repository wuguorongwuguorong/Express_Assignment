// 1. SETUP EXPRESS
const express = require('express');
const cors = require("cors");

require('dotenv').config();
const MongoClient = require("mongodb").MongoClient;
const dbname = "ABC_Restaurant"; // CHANGE THIS TO YOUR ACTUAL DATABASE NAME

const mongoUri = process.env.MONGO_URI;
const app = express();

app.use(express.json());
app.use(cors());

async function connect(uri, dbname) {
    let client = await MongoClient.connect(uri, {
        useUnifiedTopology: true
    })
    _db = client.db(dbname);
    return _db;
}
async function main() {

    let db = await connect(mongoUri, dbname);
    const { ObjectId } = require("mongodb");

    //route starts here
    //get details of customers
    app.get("/restaurant", async (req, res) => {
        try {
            const rest = await db.collection('restaurant').find().project({
                name: 1,
                block_no: 1,
                address: 1,
                zipcode: 1,
                customers: 1,
                menu: 1,
                overall: 1,
                recommendation: 1,
                remarks: 1,
                critques: 1
            }).toArray();
            res.json(rest);

        } catch (e) {
            console.error("Error fetching recipies:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
    //search engine
    app.get("/restaurant", async function (reg, res) {
        try{
        const { name, menu, customers, remarks, critques } = req.query;
        let query = {};
        if (crtiques) {
            query['critques.name'] = { $in: critques.split(',') };
        }
        if (remarks) {
            query['remarks.name'] = { $all: remarks.split(',').map(i => new RegExp(i, 'i')) };
        }
        if (menu) {
            query['menu.name'] = { $regex: menu, $options: 'i' };
        }
        if (customers) {
            query['customers.name'] = { $in: customers.split(',') };
        }
        if (name) {
            query.name = { $regex: name, $options: 'i' };
        }
        const restaurant = await db.collection('restaurant').find(query).project({
            name: 1,
            'menu.name': 1,
            'critques.name': 1,
            _id: 0
        }).toArray();

        res.json({ restaurant });
    } catch (error) {
        console.error('Error searching restaurant:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
    });
    
    //create a new restaurant
    app.post('/restaurant', async function(res,req){
        try{
            const { name, menu, customers, remarks, critques } = req.query;
            if (!name || !menu || !customers || !remarks || !critques) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            const menuDoc = await db.collection('menu').findOne({ name: menu });
            if (!menuDoc) {
                return res.status(400).json({ error: 'Invalid menu' });
            }

            const customersDocs = await db.collection('customers').findOne({ name: { $in: customers } });
            if (!customersDocs) {
                return res.status(400).json({ error: 'Invalid customer' });
            }
    
            const critquesDocs = await db.collection('critques').find({ name: { $in: critques } }).toArray();
            if (critquesDocs.length !== critques.length) {
                return res.status(400).json({ error: 'One or more invalid critques' });
            }
            const newRestaurant = {
                name,
                block_no,
                address,
                zipcode,
                customers: customersDocs.map(tag => ({
                    _id: customers._id,
                    name: customers.name
                })),
                menu: {
                    _id: menuDoc._id,
                    name: menuDoc.name
                },
                overall,
                recommendation,
                remarks,
                critques: critquesDocs.map(tag => ({
                    _id: critques._id,
                    name: critques.name
                }))
            };
            // Insert the new recipe into the database
            const rest = await db.collection('restaurant').insertOne(newRestaurant);
            console.log("rest >>> ", newRestaurant);
            // Send back the created recipe
            res.status(201).json({
                message: 'Restaurant created successfully',
                restaurantId: rest.insertedId
            });
        }catch(e){
            console.error('Error creating restaurant:', e);
            //res.status(500).json({ e: 'Internal server error' });
            res.sendStatus(500);
        }
    });

}

main();
app.listen(3000, () => {
    console.log("Server started")
})
