// server/src/controllers/behaviourController.js
import Behaviour from "../models/Behaviour.js";
import parseTimeString from "../utils/parseTimeString.js";
/* ─────────── GET  /api/behaviours ─────────── */
export const list = async (req, res, next) => {
  try {
    const behs = await Behaviour
      .find({ slp: req.user._id })
      .sort({ createdAt: -1 });
    res.json(behs);
  } catch (e) { next(e); }
};

    
export const create = async (req, res, next) => {
  try {
    const { name, description = "", instances = [] } = req.body;

    // if caller sent a single object instead of array, normalise it
    const instArr = (Array.isArray(instances) ? instances : [instances])
  .map(i => ({
    ...i,
    ...(i.startTime ? { startTime: parseTimeString(i.startTime) } : {}),
    ...(i.endTime   ? { endTime  : parseTimeString(i.endTime)   } : {})
  }));

    const beh = await Behaviour.create({
      name,
      description,
      instances: instArr,      // ← will be [] if none supplied
      slp: req.user._id
    });

    /*  Return just what the UI needs; keep full doc if you prefer. */
    res.status(201).json({
      _id:        beh._id,
      name:       beh.name,
      description: beh.description,
      instances:  beh.instances
    });
  } catch (e) { next(e); }
};

/* ─────────── DELETE /api/behaviours/:id ─────────── */
export const remove = async (req, res, next) => {
  try {
    const ok = await Behaviour.findOneAndDelete({
      _id: req.params.id,
      slp: req.user._id
    });
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
};
