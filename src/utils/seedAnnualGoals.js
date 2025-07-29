import fs from "fs";
import path from "path";
import AnnualGoalCategory from "../models/AnnualGoalCategory.js";

const defaultsPath = path.resolve("../server/src", "seed", "defaultAnnualGoals.json");
const defaults = JSON.parse(fs.readFileSync(defaultsPath, "utf8"));

export async function seedAnnualGoalsForSlp(slpId) {
  // 1 – skip if the SLP already has categories
  const count = await AnnualGoalCategory.countDocuments({ slp: slpId });
  if (count) return;

  // 2 – clone defaults with the new slp id
  const docs = defaults.map((c) => ({
    ...c,
    slp: slpId,
  }));
  await AnnualGoalCategory.insertMany(docs);
}
