// server/src/controllers/groupController.js
import mongoose    from "mongoose";
import fs          from "fs";

import Group       from "../models/Group.js";
import Patient     from "../models/Patient.js";
import Appointment from "../models/Appointment.js";

/* ────────────────────────────────────────────────────────────
   GET /api/groups  → list all groups for the signed-in SLP
   ──────────────────────────────────────────────────────────── */
export const list = async (req, res, next) => {
  try {
    const groups = await Group.find({ slp: req.user._id })
      /* include avatar + the NEW stgs array for each member */
      .populate("patients", "name avatarUrl age stgs")
      .sort({ createdAt: -1 });

    res.json(groups);
  } catch (e) { next(e); }
};

/* ────────────────────────────────────────────────────────────
   GET /api/groups/:id  → one group with member details
   ──────────────────────────────────────────────────────────── */
export const getOneGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("patients", "name avatarUrl age stgs")
      .exec();

    if (!group) return res.status(404).json({ message: "Group not found" });
    res.json(group);              // members now come with .stgs
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────
   POST /api/groups  → create a new group
   ──────────────────────────────────────────────────────────── */
export const create = async (req, res, next) => {
  try {
    let { patients = [], name, goals = [] } = req.body;

    /* normalise comma-separated goals */
    if (typeof goals === "string") {
      goals = goals.split(",").map(s => s.trim()).filter(Boolean);
    }

    patients = Array.isArray(patients) ? patients.flat() : [patients];
    patients = patients.filter(Boolean);

    /* every patient must belong to this SLP */
    const ok = await Patient.countDocuments({ _id: { $in: patients }, slp: req.user._id });
    if (ok !== patients.length)
      return res.status(400).json({ message: "Invalid member list" });

    /* create the group */
    const group = await Group.create({
      name,
      avatarUrl: req.file
        ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        : undefined,
      patients,
      goals,
      slp: req.user._id
    });

    /* backlink patients → group */
    await Patient.updateMany({ _id: { $in: patients } }, { group: group._id });

    res.status(201).json(group);
  } catch (e) { next(e); }
};

/* ────────────────────────────────────────────────────────────
   DELETE /api/groups/:id  → remove a group & clean up relations
   ──────────────────────────────────────────────────────────── */
export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = await Group.findOneAndDelete({ _id: id, slp: req.user._id });
    if (!group) return res.status(404).json({ message: "Not found" });

    /* delete local avatar file (if any) */
    if (group.avatarUrl?.startsWith(`${req.protocol}://${req.get("host")}`)) {
      const localPath = group.avatarUrl.replace(`${req.protocol}://${req.get("host")}`, ".");
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }

    /* clear patients.group field */
    await Patient.updateMany({ _id: { $in: group.patients } }, { $unset: { group: "" } });

    /* delete all appointments linked to this group */
    await Appointment.deleteMany({ group: id });

    res.json({ ok: true });
  } catch (e) { next(e); }
};

/* ────────────────────────────────────────────────────────────
   PATCH /api/groups/:id/goals  → replace the goals array
   ──────────────────────────────────────────────────────────── */
export const updateGoals = async (req, res, next) => {
  try {
    const { id }   = req.params;
    const { goals } = req.body;

    if (!Array.isArray(goals))
      return res.status(400).json({ message: "Goals must be an array" });

    const group = await Group.findOneAndUpdate(
      { _id: id, slp: req.user._id },
      { goals },
      { new: true }
    );

    if (!group) return res.status(404).json({ message: "Group not found" });
    res.json(group);
  } catch (e) { next(e); }
};
