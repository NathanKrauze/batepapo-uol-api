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
        const getParticipants = await db.collection('participants').find().toArray();

        res.send(getParticipants);
    } catch (err){ 
        res.status(500).send(err.message);
    }
});    

app.post('/messages', async (req, res) => {
    res.send('OK post msg');
});

app.get('/messages', async (req, res) => {
    res.send('OK get msg');
});

app.post('/status', async (req, res) => {
    res.send('OK post stt');
});

app.listen(5000, console.log('Runing on server port 5000'));