import mongoose from "mongoose";
const { Schema, model } = mongoose;

const materialSchema = new Schema({
  client:      { type: Schema.Types.ObjectId, ref: "Patient", required: true },
  visitDate:   { type: Date, required: true },
  appointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
  activityName:{ type: String, required: true },   // ← we query on this
  filename:    String,
  fileUrl:     String
},{ timestamps:true });

export default model("Material", materialSchema);
