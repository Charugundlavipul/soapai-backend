import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const GroupSchema = new Schema({
  name:      { type: String, trim:true, default: "" },
  avatarUrl: String,                       // optional logo
  slp:       { type: Schema.Types.ObjectId, ref: 'Slp', required: true },
  patients:  [{ type: Schema.Types.ObjectId, ref: 'Patient' }],
  goals:     [String],
  appointments:[{ type: Schema.Types.ObjectId, ref: 'Appointment' }]
}, { timestamps: true });

export default model('Group', GroupSchema);
