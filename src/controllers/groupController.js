// server/src/controllers/groupController.js
import mongoose from 'mongoose';
import Group    from '../models/Group.js';
import Patient  from '../models/Patient.js';
import fs from 'fs';
import Appointment from '../models/Appointment.js';

/* ───────────── GET /api/groups ───────────── */
export const list = async (req, res, next) => {
  try {
    const groups = await Group
      .find({ slp: req.user._id })
      .populate('patients', 'name')
      .sort({ createdAt: -1 });

    res.json(groups);
  } catch (e) {
    next(e);
  }
};

export const getOneGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("patients", "name avatarUrl") 
      .exec();

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Returns { _id, name, avatarUrl, slp, patients: [ { _id, name, avatarUrl }, … ], goals, appointments, … }
    res.json(group);
  } catch (err) {
    next(err);
  }
};

/* ───────────── POST /api/groups ──────────── */
export const create = async (req, res, next) => {
  try {
    
    let { patients = [], name, goals = [] } = req.body;
    if (typeof goals === 'string')
     goals = goals.split(',').map(s => s.trim()).filter(Boolean);
    // patients might come as single string, nested array, or plain array
    patients = Array.isArray(patients) ? patients.flat() : [patients];
    patients = patients.filter(Boolean);                    // drop empties
    const memberIds = patients;

    // make sure every member belongs to this SLP
    const validCount = await Patient.countDocuments({
      _id: { $in: memberIds },
      slp: req.user._id
    });
    if (validCount !== memberIds.length) {
      return res.status(400).json({ message: 'Invalid member list' });
    }

    /* 2️⃣  Create the group */
    const group = await Group.create({
      name,
      avatarUrl: req.file
   ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
   : undefined,
      patients: memberIds,
      goals,
      slp: req.user._id
    });

    /* 3️⃣  Back-link patients → group */
    await Patient.updateMany(
      { _id: { $in: memberIds } },
      { group: group._id }
    );

    res.status(201).json(group);
  } catch (e) {
    next(e);
  }
};



export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = await Group.findOneAndDelete({
      _id: id,
      slp: req.user._id
    });
    if (!group) return res.status(404).json({ message: 'Not found' });

    // unlink avatar
    if (group.avatarUrl?.startsWith('http')) {
      const localPath = group.avatarUrl.replace(`${req.protocol}://${req.get('host')}`, '.');
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }

    // clear group reference on patients
    await Patient.updateMany(
      { _id: { $in: group.patients } },
      { $unset: { group: '' } }
    );
    await Appointment.deleteMany({ group: id });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

// Add this function to groupController.js

export const updateGoals = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { goals } = req.body; // should be array of strings

    if (!Array.isArray(goals))
      return res.status(400).json({ message: "Goals must be an array" });

    const group = await Group.findOneAndUpdate(
      { _id: id, slp: req.user._id },
      { goals },
      { new: true }
    );

    if (!group) return res.status(404).json({ message: "Group not found" });
    res.json(group);
  } catch (e) {
    next(e);
  }
};

