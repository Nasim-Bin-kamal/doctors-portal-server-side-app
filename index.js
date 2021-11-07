const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");


//initialize firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



//middleware
app.use(cors());
app.use(express.json());


const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hgh42.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//token authorization function
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers?.authorization?.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }


    next();
}



async function run() {
    try {
        await client.connect();
        const database = client.db('doctorPortalsDB');
        const appointmentCollection = database.collection('appointments');
        const userCollection = database.collection('users');




        // //GET API for appointments   
        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = req.query.date;
            const query = { email: email, date: date };
            const cursor = appointmentCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        });

        //POST API for add a  appointment in database
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            // console.log(appointment);

            const result = await appointmentCollection.insertOne(appointment);
            res.json(result);
        });

        //POST API for user data
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });

        //GET API for single user
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        });

        //
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updatedDoc = { $set: user };
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.json(result);

        });

        //PUT API for admin
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await userCollection.findOne({ email: requester });
                if (requesterAccount.role === "admin") {
                    const updatedDoc = {
                        $set: {
                            role: 'admin'
                        }
                    };
                    const result = await userCollection.updateOne(filter, updatedDoc);
                    // console.log(result);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'You do not have permission to make admin' });
            }

        });







    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello!! form doctors portal server side');
});


app.listen(port, () => {
    console.log('Listeninig from port:', port);
});


