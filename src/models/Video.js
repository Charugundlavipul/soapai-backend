import mongoose from 'mongoose';
const { Schema, model } = mongoose;

 const Utterance = new mongoose.Schema({
   speaker:  String,          // “A”, “B” … comes from Whisper
   start:    Number,          // seconds
   end:      Number,
   text:     String
 }, { _id:false });

 
const VideoSchema = new Schema({
  title:        { type: String, required: true },
  appointment:  { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
  slp:          { type: Schema.Types.ObjectId, ref: 'Slp', required: true },
  behaviours:   [{ type: Schema.Types.ObjectId, ref: 'Behaviour' }],
  notes:        String,
  fileUrl:      String,
  transcript: [Utterance],       // /uploads/abc.mp4
  createdAt:    { type: Date, default: Date.now }
});


export default model('Video', VideoSchema);
