// server/src/models/Patient.js
import mongoose from 'mongoose';
const { Schema, model } = mongoose;


const InterventionSchema = new Schema(
  {
    name          : { type: String, required: true },
    description   : { type: String, default: "" },
    procedure     : { type: String, default: "" },
    targetDisorder: { type: String, default: "" },
    source        : { type: String, default: "" },
  },
  { _id: false }
);

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

const GoalVisitSchema = new Schema(
  {
    appointment : { type:Schema.Types.ObjectId, ref:"Appointment", required:true },
    date        : { type:Date, required:true },
    progress    : { type:Number, default:0 }
  },
  { _id:false }
);

const GoalProgressSchema = new Schema(
  {
    name       : { type:String, required:true },
    progress   : { type:Number, default:0 },      
    comment    : { type:String, default:"" },
    startDate  : { type:Date,   default:Date.now },
    targetDate : { type:Date,   default:null },
    associated : {
      type:[{
        activityName : String,
        onDate       : { type:Date, default:Date.now }
      }],
      default:[]
    },
    history    : { type:[GoalVisitSchema], default:[] }
  },
  { _id:false }
);

/* quick virtual so the UI can read “latest” progress instantly */
GoalProgressSchema.virtual("latest").get(function () {
  if (!this.history.length) return 0;
  return Math.max(...this.history.map(h => h.progress ?? 0));
});


/* ─── Main Patient schema ─── */
const PatientSchema = new Schema({
  name:         { type: String, required: true },
  age:          { type: Number },
  address:      { type: String },
  grade:        { type: String, default: "" },
  pastHistory:  { type: [String], default: [] },
  avatarUrl:    { type: String, default: "" },
  visitHistory: { type: [VisitSchema], default: [] },
    stgs: {
    type: [
      {
        appointment: {
          type     : Schema.Types.ObjectId,
          ref      : "Appointment",
          required : true,
        },
        text: { type: String, required: true },
        interventions: { type: [InterventionSchema], default: [] },
      },
    ],
    default: [],
  },
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
      },
    ],
    default: [],
  },
}, { timestamps: true });

export default model('Patient', PatientSchema);
