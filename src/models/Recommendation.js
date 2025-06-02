// server/src/models/Recommendation.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const InsightSchema = new Schema(
  {
    time:     { type: String, required: true },
    text:     { type: String, required: true },
    tag:      { type: String, required: true },
    tagColor: { type: String, required: true }
  },
  { _id: false }
);

const IndividualInsightSchema = new Schema(
  {
    patient:  { type: Schema.Types.ObjectId, ref: "Patient", required: true },
    insights: { type: [InsightSchema], default: [] }
  },
  { _id: false }
);

const RecommendationSchema = new Schema(
  {
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true
    },
    groupInsights:      { type: [InsightSchema], default: [] },
    individualInsights: { type: [IndividualInsightSchema], default: [] },
    materials:          { type: [String], default: [] }
  },
  { timestamps: true }
);

export default model("Recommendation", RecommendationSchema);
