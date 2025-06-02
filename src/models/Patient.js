import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const PatientSchema = new Schema({
  name:  { type: String, required: true },
  age:   Number,
  address: String,
  pastHistory: [String],
  avatarUrl: String, 

  slp:   { type: Schema.Types.ObjectId, ref: 'Slp', required: true },
  group: { type: Schema.Types.ObjectId, ref: 'Group', default: null },

  goals:        [String],
  appointments: [{ type: Schema.Types.ObjectId, ref: 'Appointment' }]
}, { timestamps: true });

export default model('Patient', PatientSchema);
