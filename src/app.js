import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';

const participantSchema = joi.object({
    name: joi.string().required()
});

const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
});

const app = express();

app.use(cors());
app.use(express.json());

dotenv.config();


const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
 .then(() => db = mongoClient.db())
 .catch((err) => console.log(err.message));


app.post('/participants', async (req, res) => {
    const {name} = req.body;

    const validation = participantSchema.validate(req.body, {abortEarly: false});
    if(validation.error) return res.sendStatus(422);

    const addParticipant = {
        name,
        lastStatus: Date.now()
    }

    const firstMessage = {
        from: name,
        to: 'todos',
        text: 'entra na sala...',
		type: 'status',
		time: dayjs().format('HH:mm:ss')
    }
    
    try{
        const existParticipants = await db.collection('participants').findOne({name: name});
        if(existParticipants) return res.sendStatus(409);

        await db.collection('participants').insertOne(addParticipant);
        await db.collection('messages').insertOne(firstMessage);

        return res.sendStatus(201);
    } catch (err){
        res.status(500).send(err.message);
    }

});

app.get('/participants', async (req, res) => {

    try{
        let getParticipants = []
        getParticipants = await db.collection('participants').find().toArray();

        res.send(getParticipants);
    } catch (err){ 
        res.status(500).send(err.message);
    }
});    

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const user = req.headers.user;

    const msgToValidate = {from: user, to, text, type};
    let msgToInsert = {};

    const validation = messageSchema.validate(msgToValidate, {abortEarly: false});
    if (validation.error) return res.sendStatus(422);

    try{
        const existParticipant = await db.collection('participants').findOne({name: user});
        if (!existParticipant) return res.sendStatus(422);

        msgToInsert = {...msgToValidate, time: dayjs().format('HH:mm:ss')};
        await db.collection('messages').insertOne(msgToInsert);
        return res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/messages', async (req, res) => {
    const user = req.headers.user;
    const limit = req.query.limit;
    if(limit !== undefined){
        parseInt(limit)
        if(isNaN(limit) || limit <=0) return res.sendStatus(422);
    }

    let msgToSend = [];

    try{
        const messages = await db.collection('messages').find({$or: [{to: 'todos'}, {to: user}, {from: user}, {type: "message"}]}).toArray();
        msgToSend = messages.slice(messages.length - limit)
        res.send(msgToSend);    
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;
    if(!user) return res.sendStatus(404);
    const name= user;
    const lastStatus= Date.now();

    try{
        const existParticipant = await db.collection('participants').findOne({name: user});
        if (!existParticipant) return res.sendStatus(404);

        const add = await db.collection('participants').updateOne({name: user}, {$set: {name, lastStatus}});
        console.log(add)
        res.sendStatus(200);
    } catch (err){
        res.status(500).send(err.message);
    }
});

async function removeInactivity (){
    const lastSeconds = Date.now() - 10000;
    let lastMessages = []

    try{
        const inactives = await db.collection('participants').find({lastStatus: {$lte: lastSeconds}}).toArray() 
        if(inactives.length <= 0 ) return;
        inactives.map(async (inactive) => {
            lastMessages.push({
               from: inactive.name,
               to: "todos", 
               text: "sai da sala...",
               type: "status",
               time: dayjs().format('HH:mm:ss')
            })
            await db.collection('participants').deleteOne(inactive)
        })
        await db.collection('messages').insertMany(lastMessages);
    } catch (err){
        console.log(err.message);
    }
}

setInterval(removeInactivity, 15000);

app.listen(5000, console.log('Runing on server port 5000'));