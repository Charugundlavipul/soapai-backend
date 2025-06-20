import mongoose from "mongoose";
const { Schema, model } = mongoose;

/* one document per activity, re-used anywhere */
const ActivitySchema = new Schema(
  {
    slp:   { type: Schema.Types.ObjectId, ref: "Slp",  required: true },

    name:  { type: String, required: true },
    description: { type: String, required: true },      // full Markdown
    materials:   [String],

    /* bookkeeping */
    members: [{ type: Schema.Types.ObjectId, ref: "Patient" }],
    goals:   [String],
  },
  { timestamps: true }
);

export default model("Activity", ActivitySchema);
