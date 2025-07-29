// server/src/controllers/patientController.js
import fs from 'fs';
import path from 'path';
import Patient from '../models/Patient.js';
import Group   from '../models/Group.js';
import Slp     from '../models/Slp.js';
import Appointment from '../models/Appointment.js';
import Material from "../models/Material.js";
import mongoose from "mongoose"; 

/* ───── helper: keep .progress = highest value in .history ───── */
function recomputeOverall(row) {
  if (row.history?.length) {
    row.progress = Math.max(...row.history.map(h => h.progress));
  }
}


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
    const updatable = ['name', 'age', 'address', 'pastHistory', 'goals', 'group','grade', 'avatarUrl'];     
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
    const { id }    = req.params;   // patient id
    const { visit } = req.body;     // { date, appointment, type, … }

    /* ---- basic validation ---- */
    if (!visit?.date || !visit?.type || !visit?.appointment) {
      return res.status(400).json({ message: "Incomplete visit data" });
    }

    /* ---- normalise fields ---- */
   if (typeof visit.appointment === "string") {
  // cast to string first so TS knows it isn’t a number
  visit.appointment = mongoose.Types.ObjectId.createFromHexString(
    String(visit.appointment)
  );
}
    if (Array.isArray(visit.activities)) {
      visit.activities = visit.activities
        .map(a => (typeof a === "string" ? a : a?._id))
        .filter(Boolean);
    } else {
      visit.activities = [];
    }

    /* ---- atomic update (no optimistic-lock) ---- */
       const session = await mongoose.startSession();
    let out;
    await session.withTransaction(async () => {
      // 1️⃣ remove any existing row for this appointment
      await Patient.updateOne(
        { _id: id, slp: req.user._id },
        { $pull: { visitHistory: { appointment: visit.appointment } } },
        { session }
      );

      // 2️⃣ append the fresh row
      out = await Patient.findOneAndUpdate(
        { _id: id, slp: req.user._id },
        { $push: { visitHistory: visit } },
        { new: true, projection: { visitHistory: 1 }, session }
      );
    });
    session.endSession();

    if (!out) return res.status(404).json({ message: "Patient not found" });
    res.json(out);
  } catch (err) { next(err); }
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

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/materials/${filename}`;     // ← static mount

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
/* ────────── PATCH /api/clients/:id/goal-progress ────────── */
export const updateGoalProgress = async (req, res, next) => {
  try {
    const { id }    = req.params;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "items must be an array" });
    }

    /* ---------- fetch current patient ---------- */
    const patient = await Patient.findOne({ _id: id, slp: req.user._id });
    if (!patient) return res.status(404).json({ message: "Not found" });

    /* ---------- map of existing goalProgress rows (before update) ---------- */
    const current = Object.fromEntries(
      patient.goalProgress.map(r => [r.name, r.toObject?.() ?? r])
    );

    /* ---------- merge incoming items with existing rows ---------- */
    const merged = items.map(it => {
      const prev = current[it.name] || {};

      return {
        name      : it.name,
        comment   : it.comment      ?? prev.comment      ?? "",
        startDate : it.startDate
                      ? new Date(it.startDate)
                      : prev.startDate  ?? Date.now(),
        targetDate: it.targetDate
                      ? new Date(it.targetDate)
                      : prev.targetDate ?? null,
        associated: Array.isArray(it.associated)
                      ? it.associated
                      : prev.associated ?? [],
        history   : Array.isArray(it.history) && it.history.length
                      ? it.history
                      : prev.history    ?? [],
        /* keep slider value unless history exists */
        progress  : typeof it.progress === "number"
                      ? it.progress
                      : prev.progress   ?? 0
      };
    });

    /* ---------- copy untouched goals (not present in request) ---------- */
    const touched   = new Set(items.map(i => i.name));
    const untouched = Object.values(current).filter(r => !touched.has(r.name));

    patient.goalProgress = [...merged, ...untouched];

    /* ---------- recompute .progress when history is available ---------- */
    patient.goalProgress.forEach(row => {
      if (row.history?.length) {
        row.progress = Math.max(...row.history.map(h => h.progress));
      }
    });

    await patient.save();
    return res.json(patient.goalProgress);
  } catch (err) {
    next(err);
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
    pat.goalProgress.forEach(recomputeOverall);
  });
  await pat.save();
  res.json(pat.goalProgress);
};

// server/src/controllers/patientController.js
/* ─── PATCH  /api/clients/:id/attendance/:apptId ─── */
export const updateAttendanceStatus = async (req, res, next) => {
  try {
    const { id, apptId } = req.params;                 // patient id & appointment id
    const { status, goals = [] } = req.body;           // "present" | "absent"

    if (!["present", "absent"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    /* 1️⃣  fetch patient & the appointment meta we need */
    const [pat, appointment] = await Promise.all([
      Patient.findOne({ _id: id, slp: req.user._id }),
      Appointment.findById(apptId).select("dateTimeStart"),
    ]);

    if (!pat) return res.status(404).json({ message: "Patient not found" });

    const apptDate = appointment?.dateTimeStart || new Date(); // fallback now()

    /* 2️⃣  upsert attendance row */
    const attRow = pat.attendance.find(a => String(a.appointment) === apptId);
    if (attRow) {
      attRow.status = status;
    } else {
      pat.attendance.push({
        appointment: apptId,
        date       : apptDate,
        status,
      });
    }

    /* 3️⃣  when **present** update goal-progress history          */
    if (status === "present" && Array.isArray(goals) && goals.length) {
      goals.forEach(gName => {
        if (!pat.goals.includes(gName)) return;        // skip strangers

        let gp = pat.goalProgress.find(r => r.name === gName);
        if (!gp) {
          gp = { name: gName, history: [] };
          pat.goalProgress.push(gp);
        }

        const existing = gp.history.find(h => String(h.appointment) === apptId);
        if (existing) {
          // keep original date, only update value
          existing.progress = gp.progress ?? 0;
        } else {
          gp.history.push({
            appointment: apptId,
            date       : apptDate,
            progress   : gp.progress ?? 0,
          });
        }

        // keep .progress = highest in history
        recomputeOverall(gp);
      });
    }

    await pat.save();
    res.json({ attendance: pat.attendance, goalProgress: pat.goalProgress });
  } catch (e) {
    next(e);
  }
};


/* ─── PATCH /api/clients/:id/goal-progress/:apptId ─── */
export const upsertGoalProgressForVisit = async (req, res, next) => {
  try {
    const { id, apptId } = req.params;       // patient id, appointment id
    const { goals = [], visitDate } = req.body;       // [{ name, progress }]

    if (!Array.isArray(goals) || !goals.length)
      return res.status(400).json({ message:"goals array required" });

    const pat = await Patient.findOne({ _id:id, slp:req.user._id });
    if (!pat) return res.status(404).json({ message:"Not found" });

    const apptDate = visitDate ? new Date(visitDate) : new Date();
    goals.forEach(({ name, progress }) => {
      if (!pat.goals.includes(name)) return;          // ignore strangers

      let gp = pat.goalProgress.find(r => r.name === name);
      if (!gp) {
        gp = { name, history:[] };
        pat.goalProgress.push(gp);
      }

      
      const row = gp.history.find(h => String(h.appointment) === apptId);
      if (row) {
        row.progress = progress;               // keep original date untouched
      } else {
        gp.history.push({
          appointment: apptId,
          date       : apptDate,               // ✅ correct stamp
          progress
        });
      }
      recomputeOverall(gp);
    });

      
    await pat.save();
    res.json(pat.goalProgress);
  } catch (err) { next(err); }
};


// server/src/controllers/patientController.js
export const addActivitiesToVisit = async (req, res, next) => {
  try {
    const { id, apptId }     = req.params;          // patient & appointment
    const { activities = []} = req.body;            // [activityId]

    if (!activities.length)
      return res.status(400).json({ message:"activities array required" });

    const pat = await Patient.findOne({ _id:id, slp:req.user._id });
    if (!pat) return res.status(404).json({ message:"Not found" });

    const visit = pat.visitHistory.find(v => String(v.appointment) === apptId);
    if (!visit) return res.status(404).json({ message:"Visit row missing" });

    activities.forEach(a => {
      if (!visit.activities.includes(a)) visit.activities.push(a);
    });

    await pat.save();
    res.json(visit);
  } catch (err) { next(err); }
};
