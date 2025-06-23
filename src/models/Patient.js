// server/src/models/Patient.js
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/* ─── Sub‐schemas ─── */

const ActivitySchema = new Schema({
  name:        { type: String, required: true },
  description: { type: String, default: "" },
  evidence:    { type: String, default: "" },
  recommended: { type: Boolean, default: false },
  score:       { type: Number },
  associatedGoals: [String],
}, { _id: false });

// One “visit” entry in visitHistory
const VisitSchema = new Schema({
  date:        { type: Date, required: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
  type:        { type: String, enum: ["group", "individual"], required: true },
  note: { type: String, default: "" },
  aiInsights: [
    {
      text:  String,
      tag:   String,
      color: String,
    }
  ],
    activities: [{
    type: Schema.Types.ObjectId,
    ref:  "Activity"
  }],
}, { _id: false });

// One “material” (file) entry tied to a particular visit
const MaterialSchema = new Schema({
  visitDate:   { type: Date, required: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
  fileUrl:     { type: String, required: true },
  filename:    { type: String, required: true },
}, { _id: false });

const GoalProgressSchema = new Schema({
  name:        { type:String, required:true },   // goal text
 associated:  [{                                 // “history” entries
   activityName: String,                         // e.g. “Emotion Charades”
   onDate:      { type:Date, default:Date.now }  // when it happened
 }],
  progress:    { type:Number, default:0 },        // %
  comment:     { type:String, default:"" },
 startDate:   { type:Date, default:Date.now },   // when doctor set the goal
 targetDate:  { type: Date,   default: null },                                // optional due-date
}, {_id:false});


/* ─── Main Patient schema ─── */
const PatientSchema = new Schema({
  name:         { type: String, required: true },
  age:          { type: Number },
  address:      { type: String },
  grade:        { type: String, default: "" },
  pastHistory:  { type: [String], default: [] },
  avatarUrl:    { type: String, default: "" },
  visitHistory: { type: [VisitSchema], default: [] },
  materials:    { type: [MaterialSchema], default: [] },
  slp:          { type: Schema.Types.ObjectId, ref: 'Slp', required: true },
  group:        { type: Schema.Types.ObjectId, ref: 'Group', default: null },
  goals:        { type: [String], default: [] },
  goalProgress: { type: [GoalProgressSchema], default: [] },
  appointments: { type: [Schema.Types.ObjectId], ref: 'Appointment', default: [] },   
  attendance: {
    type: [
      {
        appointment: { type: Schema.Types.ObjectId, ref: "Appointment", required:true },
        date:        { type: Date, required: true },
        status: {
          type: String,
          enum: ["not-started", "present", "absent"],
          default: "not-started",
        },
        progress: { type: Number, default: 0 }, // e.g. 50% done
      },
    ],
    default: [],
  },
}, { timestamps: true });

export default model('Patient', PatientSchema);
