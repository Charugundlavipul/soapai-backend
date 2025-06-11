// server/src/controllers/patientController.js
import fs from 'fs';
import path from 'path';
import Patient from '../models/Patient.js';
import Group   from '../models/Group.js';
import Slp     from '../models/Slp.js';
import Appointment from '../models/Appointment.js';
import Material from "../models/Material.js";

/* ───────── absolute path for uploads/materials ───────── */
const MATERIALS_DIR = path.join(process.cwd(), "uploads", "materials");

/* make sure upload dirs exist one time at server start */
if (!fs.existsSync(MATERIALS_DIR)) fs.mkdirSync(MATERIALS_DIR, { recursive:true });

// ensure uploads/materials exists once at boot
if (!fs.existsSync(MATERIALS_DIR)) {
  fs.mkdirSync(MATERIALS_DIR, { recursive: true });
}
// ─────────────  GET /api/clients/:id/materials  ─────────────


export const listMaterials = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { appointment, activity } = req.query;   // optional filters

    const pat = await Patient.findById(id, "materials");
    if (!pat) return res.status(404).json({ message: "Patient not found" });

    let out = pat.materials;
    if (appointment) out = out.filter(m => String(m.appointment) === appointment);
    if (activity)    out = out.filter(m => m.activity === activity);

    res.json(out);
  } catch (err) { next(err); }
};


/* ─── List all patients for the current SLP ─── */
export const list = async (req, res, next) => {
  try {
    const patients = await Patient
      .find({ slp: req.user._id })
      .sort({ createdAt: -1 });
    res.json(patients);
  } catch (e) {
    next(e);
  }
};

/* ─── Create a new patient ─── */
export const create = async (req, res, next) => {
  try {
    // Normalize comma‐separated strings into arrays
    if (typeof req.body.goals === 'string') {
      req.body.goals = req.body.goals
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }
    if (typeof req.body.pastHistory === 'string') {
      req.body.pastHistory = req.body.pastHistory
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }

       /* Handle comma-separated strings you already have … */

  /* ── normalise goalProgress ─────────────────────────────── */
  if (req.body.goalProgress) {
    // goalProgress can arrive as:
    //   – one JSON string  ->  req.body.goalProgress = '{"name":"…"}'
    //   – multiple strings ->  ["{…}", "{…}"]
    //   – already-parsed   ->  [{} , {}]

    const raw = Array.isArray(req.body.goalProgress)
      ? req.body.goalProgress
      : [req.body.goalProgress];

    req.body.goalProgress = raw.map(item =>
      // if it’s still a string → JSON.parse
      typeof item === "string" ? JSON.parse(item) : item
    );
  }



    const data = {
      ...req.body,
      slp: req.user._id,
      avatarUrl: req.file
        ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
        : undefined
    };

    const patient = await Patient.create(data);

    // Add patient to SLP’s clients array
    await Slp.findByIdAndUpdate(req.user._id, {
      $addToSet: { clients: patient._id }
    });

    // If group was provided, add patient to that group
    if (patient.group) {
      await Group.findByIdAndUpdate(patient.group, {
        $addToSet: { patients: patient._id }
      });
    }

    res.status(201).json(patient);
  } catch (e) {
    next(e);
  }
};

/* ─── Get a single patient (without visitHistory populated) ─── */
export const getOne = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.id,
      slp: req.user._id
    }).exec();
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json(patient);
  } catch (err) {
    next(err);
  }
};

/* ─── Get a patient profile, including visitHistory.appointment populated ─── */
export const getProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findOne({ _id: id, slp: req.user._id })
      .populate('group', 'name avatarUrl')
      .populate('visitHistory.appointment', 'dateTimeStart type group patient')
      .exec();
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json(patient);
  } catch (e) {
    next(e);
  }
};

/* ─── Update (PUT) patient fields (name, age, address, pastHistory, goals, group, avatar) ─── */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findOne({ _id: id, slp: req.user._id });
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found or unauthorized' });
    }

    // Normalize comma‐separated goals/pastHistory if the client sent strings
    if (typeof req.body.goals === 'string') {
      req.body.goals = req.body.goals
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }
    if (typeof req.body.pastHistory === 'string') {
      req.body.pastHistory = req.body.pastHistory
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }

    // Only allow updating these fields
    const updatable = ['name', 'age', 'address', 'pastHistory', 'goals', 'group'];
    updatable.forEach(field => {
      if (req.body[field] !== undefined) {
        patient[field] = req.body[field];
      }
    });

    // If avatar file is uploaded, replace avatarUrl
    if (req.file) {
      patient.avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    // If group changed, sync group.patients arrays
    if (req.body.group !== undefined) {
      // Remove from old group
      if (patient.group && patient.group.toString() !== req.body.group) {
        await Group.findByIdAndUpdate(patient.group, {
          $pull: { patients: patient._id }
        });
      }
      // Add to new group
      if (req.body.group) {
        await Group.findByIdAndUpdate(req.body.group, {
          $addToSet: { patients: patient._id }
        });
      }
      patient.group = req.body.group;
    }

    await patient.save();
    res.json(patient);
  } catch (err) {
    next(err);
  }
};

/* ─── Delete a patient (and unlink from SLP and Group, remove appointments) ─── */
export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findOneAndDelete({
      _id: id,
      slp: req.user._id
    });
    if (!patient) {
      return res.status(404).json({ message: 'Not found' });
    }

    // If avatarUrl is a local file, delete it from disk
    if (patient.avatarUrl?.startsWith(`${req.protocol}://${req.get('host')}`)) {
      const localPath = patient.avatarUrl.replace(`${req.protocol}://${req.get('host')}`, '.');
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }

    // Remove from SLP.clients
    await Slp.findByIdAndUpdate(req.user._id, {
      $pull: { clients: patient._id }
    });

    // Remove from group.patients
    if (patient.group) {
      await Group.findByIdAndUpdate(patient.group, {
        $pull: { patients: patient._id }
      });
    }

    // Delete all appointments for this patient
    await Appointment.deleteMany({ patient: patient._id });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/* ─── PATCH /api/clients/:id/goals  → replace the entire goals array ─── */
export const updateGoals = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { goals } = req.body;
    if (!Array.isArray(goals)) {
      return res.status(400).json({ message: 'Goals must be an array' });
    }
    const patient = await Patient.findOneAndUpdate(
      { _id: id, slp: req.user._id },
      { goals },
      { new: true }
    );
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json(patient);
  } catch (e) {
    next(e);
  }
};

export const addVisitHistory = async (req, res, next) => {
  try {
    const { id } = req.params;         // patient ID
    const { visit } = req.body;       // visit = { date, appointment, type, aiInsights, activities }

    if (!visit || !visit.date || !visit.type || !visit.appointment) {
      return res.status(400).json({ message: "Incomplete visit data" });
    }

    // 1) Find the patient document
    const patient = await Patient.findOne({ _id: id, slp: req.user._id });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // 2) Remove any existing visit entry for the same appointment
    patient.visitHistory = patient.visitHistory.filter(
      (vh) => String(vh.appointment) !== String(visit.appointment)
    );

    // 3) Push the new visit object
    patient.visitHistory.push(visit);

    // 4) Save and return the updated patient
    await patient.save();
    res.json(patient);
  } catch (e) {
    next(e);
  }
};

export const addMaterial = async (req, res, next) => {
  try {
    const clientId          = req.params.id;               // from URL
    const {
      visitDate   = new Date().toISOString(),              // yyyy-mm-ddThh…
      appointment = null,
      activity    = "misc"
    } = req.body;

    if (!req.file)
      return res.status(400).json({ message: "No file uploaded" });

    /* ---------- build nice filename & move file ---------- */
    const niceDate = visitDate.slice(0, 10);               // yyyy-mm-dd
     const safeAct  = activity.toLowerCase()
   .replace(/[^a-z0-9]+/g, "_")
   .replace(/^_+|_+$/g, "");   // cap length / fallback
    const ext      = path.extname(req.file.originalname || ".pdf");
    const filename = `material_${niceDate}_${safeAct}${ext}`;

    const dest = path.join(MATERIALS_DIR, filename);
    fs.renameSync(req.file.path, dest);                    // <- move

    const fileUrl = `/uploads/materials/${filename}`;      // ← static mount

    /* ---------- save in embedded materials array ---------- */
    const update = {
      $pull: {                                             // remove older dup
        materials: { appointment, activity }
      },
    };
    await Patient.updateOne({ _id: clientId }, update);

    const push = {
      $push: {
        materials: {
          visitDate,
          appointment,
          activity,
          filename,
          fileUrl
        }
      }
    };
    const pat = await Patient.findByIdAndUpdate(clientId, push,
                   { new:true, select:"materials" });

    if (!pat) return res.status(404).json({ message:"Patient not found" });

    /* return the row we just inserted */
    return res.json(pat.materials.at(-1));
  } catch (err) { next(err); }
};

// server/src/controllers/patientController.js

/* ────────── PATCH /api/clients/:id/goal-progress ────────── */
export const updateGoalProgress = async (req, res, next) => {
  try {
    const { id }    = req.params;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "items must be an array" });
    }

    // Only the owning SLP
    const patient = await Patient.findOne({ _id: id, slp: req.user._id });
    if (!patient) return res.status(404).json({ message: "Not found" });

    // Replace goalProgress with the new array, casting dates to JS Date
    patient.goalProgress = items.map((it) => ({
      name:        it.name,
      progress:    it.progress,
      comment:     it.comment,
      startDate:   it.startDate ? new Date(it.startDate) : Date.now(),
      targetDate:  it.targetDate ? new Date(it.targetDate) : null,
      associated:  Array.isArray(it.associated) ? it.associated.map(a => ({
        activityName: a.activityName,
        onDate:       a.onDate ? new Date(a.onDate) : Date.now()
      })) : []
    }));

    await patient.save();
    // Return the full, updated goalProgress array
    res.json(patient.goalProgress);
  } catch (e) {
    next(e);
  }
};

export const addGoalHistory = async (req,res,next)=>{
  const { id } = req.params;
  const { goals = [], activityName } = req.body;
  const pat = await Patient.findOne({ _id:id, slp:req.user._id });
  if(!pat) return res.status(404).json({message:"Not found"});

  goals.forEach(g=>{
    const row = pat.goalProgress.find(r=>r.name===g);
    if(row){
      row.associated.push({ activityName, onDate:new Date() });
    }
  });
  await pat.save();
  res.json(pat.goalProgress);
};
