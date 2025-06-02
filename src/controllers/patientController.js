import Patient from '../models/Patient.js';
import Group   from '../models/Group.js';
import fs from 'fs';
import path from 'path';
import Slp from '../models/Slp.js'; 
import Appointment from '../models/Appointment.js';

export const list = async (req, res, next) => {
  try {
    const patients = await Patient
      .find({ slp: req.user._id })
      .sort({ createdAt: -1 });
    res.json(patients);
  } catch (e) { next(e); }
};

export const create = async (req, res, next) => {
  try {
       
   if (typeof req.body.goals === 'string')
     req.body.goals = req.body.goals.split(',').map(s => s.trim()).filter(Boolean);
   if (typeof req.body.pastHistory === 'string')
     req.body.pastHistory = req.body.pastHistory.split(',').map(s => s.trim()).filter(Boolean);


       const data = {
     ...req.body,
     slp: req.user._id,
      avatarUrl: req.file
   ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
   : undefined
   };
    const patient = await Patient.create(data);

   // attach patient id to the SLP’s clients list
   await Slp.findByIdAndUpdate(
     req.user._id,
     { $addToSet: { clients: patient._id } }
   );

    // attach to group if provided
    if (patient.group) {
      await Group.findByIdAndUpdate(patient.group,
        { $addToSet: { patients: patient._id } });
    }

    res.status(201).json(patient);
  } catch (e) { next(e); }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findOneAndDelete({
      _id: id,
      slp: req.user._id
    });
    if (!patient) return res.status(404).json({ message: 'Not found' });

    // unlink avatar
    if (patient.avatarUrl?.startsWith('http')) {
      const localPath = patient.avatarUrl.replace(`${req.protocol}://${req.get('host')}`, '.');
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }

    // pull from SLP.clients
    await Slp.findByIdAndUpdate(req.user._id, { $pull: { clients: id } });

    // pull from group.patients
    if (patient.group) {
      await Group.findByIdAndUpdate(patient.group, { $pull: { patients: id } });
    }
    // delete appointments
    await Appointment.deleteMany({ patient: id });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

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

/* ── NEW: PATCH /api/clients/:id ─────────────────────────────────────── */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Ensure only the owning SLP may update
    const patient = await Patient.findOne({ _id: id, slp: req.user._id });
    if (!patient) {
      return res
        .status(404)
        .json({ message: 'Patient not found or unauthorized' });
    }

    // Normalize any comma-separated strings
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

    // Only allow these fields to be updated:
    const updatable = ['name', 'age', 'address', 'pastHistory', 'goals', 'group'];
    updatable.forEach(field => {
      if (req.body[field] !== undefined) {
        patient[field] = req.body[field];
      }
    });

    // If an avatar file was uploaded, update avatarUrl
    if (req.file) {
      patient.avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    // If group changed, ensure we keep group.patients in sync:
    if (req.body.group !== undefined) {
      // Remove from old group:
      if (patient.group && patient.group.toString() !== req.body.group) {
        await Group.findByIdAndUpdate(patient.group, {
          $pull: { patients: patient._id }
        });
      }
      // Add to new group:
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