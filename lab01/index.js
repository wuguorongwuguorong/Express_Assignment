// 1. SETUP EXPRESS
const express = require('express');
const cors = require("cors");
const { ObjectId } = require("mongodb");

require('dotenv').config();
const MongoClient = require("mongodb").MongoClient;
const dbname = "ABC_Restaurant"; // CHANGE THIS TO YOUR ACTUAL DATABASE NAME

const mongoUri = process.env.MONGO_URI;
const app = express();
const bcrypt = require('bcrypt');

app.use(express.json());
app.use(cors());

async function connect(uri, dbname) {
    let client = await MongoClient.connect(uri, {
        useUnifiedTopology: true
    })
    _db = client.db(dbname);
    return _db;
}
const jwt = require('jsonwebtoken');

const generateAccessToken = (id, email) => {
    return jwt.sign({
        'user_id': id,
        'email': email
    }, process.env.TOKEN_SECRET, {
        expiresIn: "1h"
    });
}
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(403);
    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}
async function main() {

    let db = await connect(mongoUri, dbname);


    //route starts here
    //get details of restaurant
    app.get("/restaurant",verifyToken, async (req, res) => {
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
    app.get("/search", async function (req, res) {
        try {
            const critques = req.query.critques;
            const remarks = req.query.remarks;
            const menu = req.query.menu;
            
            let critera = {};
            
            if (critques) {
                critera['critques'] = critques;
            }
            if (remarks) {
                critera['remarks'] = remarks;
            }
            if (menu) {
                critera['menu'] = menu;
            }
         
            console.log(critera)
            
            const result = await db.collection('restaurant').find(critera).project({
                'name':1,
                'menu': 1,
                'remarks': 1,
                'critques': 1
            }).toArray();
            console.log(result)
            res.json({ 
                result
             });
        } catch (error) {
            console.error('Error searching restaurant:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    //create a new restaurant
    app.post('/restaurant', async function (req, res) {
        try {
            const { name, block_no, address, zipcode, customers, menu, remarks, critques, overall, recommendation } = req.body;

            if (!name || !menu || !customers || !remarks || !critques) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            const menuDoc = await db.collection('menu').findOne({ name: menu });
            if (!menuDoc) {
                return res.status(400).json({ error: 'Invalid menu' });
            }

            const customersDocs = await db.collection('customers').findOne({
                name: new RegExp(customers, 'i')
            });
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
                customers: {
                    _id: customersDocs._id,
                    name: customersDocs.name
                },
                menu: {
                    _id: menuDoc._id,
                    name: menuDoc.name
                },
                overall,
                recommendation,
                remarks,
                critques: critquesDocs.map(crit => ({
                    _id: crit._id,
                    name: crit.name
                }))
            };
            // Insert the new restaurant into the database
            const rest = await db.collection('restaurant').insertOne(newRestaurant);
           
            res.status(201).json({
                message: 'Restaurant created successfully',
                restaurantId: rest.insertedId
            });
        } catch (e) {
            console.error('Error creating restaurant:', e);
            res.status(500).json({ e: 'Internal server error', details: e.message });
        
        }
    });

    //delete starts here
    app.delete('/restaurant/:id', async function (req, res) {
        try {
            const restaurantId = req.params.id;
            const result = await db.collection('restaurant').deleteOne({ _id: new ObjectId(restaurantId) });
            res.status(201).json({
                message: 'Restaurant deleted successfully',
                result
            })
        } catch (e) {
            res.status(500).json({ e: 'Internal server error',details: e.message });
        }
    })

    //insert within the collection starts here
    app.post('/restaurant/:id/overview', async function (req, res) {
        try {
            const restid = req.params.id;
            const { cost, time, date } = req.body;

            if (!cost || !time || !date) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const newOverview = { overviewId: new ObjectId(), cost: Number(cost), time, date: new Date() };
            const result = await db.collection('restaurant').updateOne({_id: new ObjectId(restid) }, { $push: { overview: newOverview } });

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'restaurant not found' });
            }
            res.status(201).json({
                message: 'Restaurant updated successfully',
                result
            })
        } catch (e) {
            console.error('Error creating overview:', e);
            res.status(500).json({ e: 'Internal server error' });
        }
    });

    //update within the collection starts here
    app.put('/restaurant/:restaurantId/overview/:overviewId', async function(req, res) {
        try {
            const restaurantId = req.params.restaurantId;
            const overviewId = req.params.overviewId;
            const { cost, time, date } = req.body;
    
            //validation
            if (!cost || !time || !date) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const updatedOverview = {
                overview_id: new ObjectId(overviewId),
                cost: Number(cost),
                time,
                date: new Date()  // Update the date to reflect the edit time
            };
            const result = await db.collection('restaurant').updateOne(
                { 
                    _id: new ObjectId(restaurantId),
                    "overview.overviewId": new ObjectId(overviewId)
                },
                { 
                    $set: { "overview.$": updatedOverview }
                }
            );
    
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Restaurant or Overview not found' });
            }
    
            res.status(201).json({
                message: 'overview updated successfully',
                result
            });
        } catch (error) {
            console.error('Error updating overview:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    app.post('/users', async function (req, res) {
        console.log("req.body >>> ", req.body);
        const result = await db.collection("users").insertOne({
            'email': req.body.email,
            'password': await bcrypt.hash(req.body.password, 12)
        })
        res.status(201).json({
            "message": "New user account",
            "result": result
        })
    })
    app.post('/login', async (req, res) => {
        try {
            console.log("body >>> ", req.body);
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password are required' });
            }
            const user = await db.collection('users').findOne({ email: email });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid password' });
            }
            const accessToken = generateAccessToken(user._id, user.email);
            res.json({ accessToken: accessToken });
        } catch (e) {
            console.log(e);
            res.sendStatus(500);
        }

    });
}

main();
app.listen(3000, () => {
    console.log("Server started")
})
