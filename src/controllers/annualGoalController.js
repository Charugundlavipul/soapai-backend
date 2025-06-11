import AnnualGoalCategory from "../models/AnnualGoalCategory.js";

/* GET /api/annual-goals */
export const list = async (req, res, next) => {
  try {
    const cats = await AnnualGoalCategory
      .find({ slp: req.user._id })
      .sort({ createdAt: -1 });
    res.json(cats);
  } catch (e) { next(e); }
};

/* POST /api/annual-goals */
export const create = async (req, res, next) => {
  try {
 let { name, description = "", goals = [] } = req.body;

 if (!Array.isArray(goals)) goals = [goals];

 goals = goals.flat().map(g => {
   if (typeof g === "string") return { name: g, description: "" };
   return { name: g.name ?? "", description: g.description ?? "" };
 });

    const cat = await AnnualGoalCategory.create({
      name,
      description,
      goals,
      slp: req.user._id,
    });

    res.status(201).json(cat);
  } catch (e) { next(e); }
};

/* DELETE /api/annual-goals/:id */
/* DELETE /api/annual-goals/:catId/goals/:goalId
   – remove ONE goal (by its _id) from the category */
export const removeGoal = async (req, res, next) => {
  try {
    const { catId, goalId } = req.params;

    const updated = await AnnualGoalCategory.findOneAndUpdate(
      { _id: catId, slp: req.user._id },
      { $pull: { goals: { _id: goalId } } },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Category or goal not found" });

    res.json(updated);                 // return the new category doc
  } catch (e) { next(e); }
};

/* PATCH /api/annual-goals/:id  – rename / re-describe, plus ADD goals */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { name, description, addGoals = [] } = req.body;

    /* normalise addGoals into [{name,description}] */
    if (!Array.isArray(addGoals)) addGoals = [addGoals];
    addGoals = addGoals
      .flat()
      .map((g) =>
        typeof g === "string"
          ? { name: g, description: "" }
          : { name: g.name ?? "", description: g.description ?? "" }
      )
      .filter((g) => g.name); // drop empties

    const cat = await AnnualGoalCategory.findOne({
      _id: id,
      slp: req.user._id,
    });
    if (!cat) return res.status(404).json({ message: "Not found" });

    if (name !== undefined) cat.name = name;
    if (description !== undefined) cat.description = description;

    /* append but avoid duplicates by goal.name */
    addGoals.forEach((g) => {
      if (!cat.goals.find((x) => x.name === g.name)) cat.goals.push(g);
    });

    await cat.save();
    res.json(cat);
  } catch (e) {
    next(e);
  }
};

