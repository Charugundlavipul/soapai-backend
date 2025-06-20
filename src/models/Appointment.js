// server/src/models/Appointment.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;





const AppointmentSchema = new Schema({
  slp:   { type: Schema.Types.ObjectId, ref: "Slp", required: true },

  type:   { type: String, enum: ["group", "individual"], required: true },
  group:  { type: Schema.Types.ObjectId, ref: "Group" },
  patient:{ type: Schema.Types.ObjectId, ref: "Patient" },

  dateTimeStart: { type: Date, required: true },
  dateTimeEnd:   { type: Date, required: true },

  status: {
    type: String,
    enum: ["upcoming", "ongoing", "completed", "cancelled"],
    default: "upcoming"
  },

  video: {   // link to Video
    type: Schema.Types.ObjectId,
    ref: "Video",
    default: null
  },

  recommendation: { 
    type: Schema.Types.ObjectId,
    ref: "Recommendation",
    default: null
  },
    /* ---------- session outcomes ---------- */
  aiInsights: [                        // generic list (works for group OR individual)
    {
      time:     String,
      text:     String,
      tag:      String,
      tagColor: String
    }
  ],
   activities: [{                     //  just keep the ObjectId refs
    type: Schema.Types.ObjectId,
    ref:  "Activity"
  }],

}, { timestamps: true });

export default model("Appointment", AppointmentSchema);
