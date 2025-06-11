import mongoose from "mongoose";
const { Schema, model } = mongoose;

const CategorySchema = new Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    /* list of simple goal strings; extend with status/owner if ever needed */
    goals: [
   {
    _id:        { type: Schema.Types.ObjectId, auto: true },
     name:        { type: String, required: true, trim: true },
     description: { type: String, default: "" },
   },
],

    slp:         { type: Schema.Types.ObjectId, ref: "Slp", required: true },
  },
  { timestamps: true }
);

export default model("AnnualGoalCategory", CategorySchema);
