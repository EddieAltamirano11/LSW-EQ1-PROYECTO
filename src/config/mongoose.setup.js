import mongoose from 'mongoose';

// Sin buffering, una consulta con la base desconectada falla de inmediato en
// lugar de quedarse colgada ~10s esperando la reconexión.
mongoose.set('bufferCommands', false);

export default mongoose;
