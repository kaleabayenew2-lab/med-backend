import express from 'express';
import cors from 'cors';
import './config/db';
import clientRoutes from './routes/client.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/client', clientRoutes);

export default app;