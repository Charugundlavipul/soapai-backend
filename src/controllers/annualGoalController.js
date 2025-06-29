// server/src/controllers/annualGoalController.js
import AnnualGoalCategory from "../models/AnnualGoalCategory.js";

/* GET  /api/annual-goals  – everyone sees the same list */
export const list = async (_req, res, next) => {
  try {
    const cats = await AnnualGoalCategory.find().sort({ createdAt: -1 });
    res.json(cats);
  } catch (e) {
    next(e);
  }
};

/* POST /api/annual-goals */
export const create = async (req, res, next) => {
  try {
    let { name, description = "", goals = [] } = req.body;
    if (!Array.isArray(goals)) goals = [goals];

    goals = goals.flat().map((g) =>
      typeof g === "string"
        ? { name: g, description: "" }
        : { name: g.name ?? "", description: g.description ?? "" }
    );

    const cat = await AnnualGoalCategory.create({
      name,
      description,
      goals,
      /* slp left undefined → global */
    });

    res.status(201).json(cat);
  } catch (e) {
    next(e);
  }
};

/* DELETE one goal inside a category */
export const removeGoal = async (req, res, next) => {
  try {
    const { catId, goalId } = req.params;

    const updated = await AnnualGoalCategory.findOneAndUpdate(
      { _id: catId },
      { $pull: { goals: { _id: goalId } } },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Category or goal not found" });

    res.json(updated);
  } catch (e) {
    next(e);
  }
};

/* PATCH – rename / re-describe, plus add goals */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { name, description, addGoals = [] } = req.body;

    if (!Array.isArray(addGoals)) addGoals = [addGoals];
    addGoals = addGoals
      .flat()
      .map((g) =>
        typeof g === "string"
          ? { name: g, description: "" }
          : { name: g.name ?? "", description: g.description ?? "" }
      )
      .filter((g) => g.name);

    const cat = await AnnualGoalCategory.findById(id);
    if (!cat) return res.status(404).json({ message: "Not found" });

    if (name !== undefined)        cat.name        = name;
    if (description !== undefined) cat.description = description;

    addGoals.forEach((g) => {
      if (!cat.goals.find((x) => x.name === g.name)) cat.goals.push(g);
    });

    await cat.save();
    res.json(cat);
  } catch (e) {
    next(e);
  }
};

/* DELETE an entire category */
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cat = await AnnualGoalCategory.findByIdAndDelete(id);
    if (!cat)
      return res.status(404).json({ message: "Category not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
