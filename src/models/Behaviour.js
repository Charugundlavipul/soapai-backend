import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const InstanceSchema = new Schema({
  startTime:     Date,
  endTime:       Date,
  aiDescription: String,
  title:         String
}, { _id:false });

const BehaviourSchema = new Schema({
  name:        { type:String, required:true, trim:true },
  description: { type:String, default:'' },
  instances  : { type:[InstanceSchema], default:[] },
  slp:         { type:Schema.Types.ObjectId, ref:'Slp', required:true }
}, { timestamps:true });

export default model('Behaviour', BehaviourSchema);
