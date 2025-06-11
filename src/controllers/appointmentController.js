// server/src/controllers/appointmentController.js
import Appointment from '../models/Appointment.js';
import { isBefore, isWithinInterval } from 'date-fns';
import Group from '../models/Group.js';
import Patient from '../models/Patient.js';

const computeStatus = (start, end) => {
  const now = new Date();
  if (isWithinInterval(now, { start, end })) return 'ongoing';
  if (isBefore(now, start)) return 'upcoming';
  return 'completed';
};

export const create = async (req, res, next) => {
  try {
    const body = { ...req.body, slp: req.user._id };
    body.status = computeStatus(new Date(body.dateTimeStart), new Date(body.dateTimeEnd));

    let appt = await Appointment.create(body);
    appt = await appt.populate([
      { path: 'group', select: 'name' },
      { path: 'patient', select: 'name' }
    ]);
    res.status(201).json(appt);
  } catch (e) {
    next(e);
  }
};

export const list = async (req, res, next) => {
  try {
    let appts = await Appointment
      .find({ slp: req.user._id })
      .populate("video", "_id")
      .populate('group', 'name')
      .populate('patient', 'name')
      .sort({ dateTimeStart: 1 });

    // Recompute status on the fly so long-running server stays accurate
    appts = appts.map(a => {
      a.status = computeStatus(a.dateTimeStart, a.dateTimeEnd);
      return a;
    });

    res.json(appts);
  } catch (e) {
    next(e);
  }
};

const statusOf = (start, end) => {
  const now = new Date();
  if (isWithinInterval(now, { start, end })) return 'ongoing';
  if (isBefore(now, start)) return 'upcoming';
  return 'completed';
};

/* ─ PATCH /api/appointments/:id ─ */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      type,
      group,
      patient,
      dateTimeStart,
      dateTimeEnd,
      aiInsights,
      activities,
      status // Optional: if you send status from frontend
    } = req.body;

    // Validate type ↔ target
    if (type === 'group' && !group) return res.status(400).json({ message: 'group id required' });
    if (type === 'individual' && !patient) return res.status(400).json({ message: 'patient id required' });

    const updateDoc = {
      type,
      dateTimeStart,
      dateTimeEnd,
      status: status || statusOf(new Date(dateTimeStart), new Date(dateTimeEnd)),
      aiInsights,
      activities,
    };
    if (type === 'group') {
      updateDoc.group = group;
      updateDoc.$unset = { patient: 1 };
    } else {
      updateDoc.patient = patient;
      updateDoc.$unset = { group: 1 };
    }

    // Update the appointment
    const appt = await Appointment.findOneAndUpdate(
      { _id: id, slp: req.user._id },
      updateDoc,
      { new: true }
    ).populate('group', 'name').populate('patient', 'name');

    if (!appt) return res.status(404).json({ message: 'Not found' });

    res.json(appt);
  } catch (e) {
    next(e);
  }
};

/* ─ DELETE /api/appointments/:id ─ */
export const remove = async (req, res, next) => {
  try {
    const appt = await Appointment.findOneAndDelete({
      _id: req.params.id,
      slp: req.user._id
    });
    if (!appt) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Only allow the SLP who owns it to fetch
    const appt = await Appointment.findOne({ _id: id, slp: req.user._id })
      .populate('group', 'name')
      .populate('patient', 'name')
      .populate('video', '_id')
      .populate({
        path: 'recommendation',
        populate: {
          path: 'individualInsights.patient',
          select: 'name avatarUrl'
        }
      });

    if (!appt) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Recompute status on the fly
    appt.status = computeStatus(appt.dateTimeStart, appt.dateTimeEnd);

    res.json(appt);
  } catch (err) {
    next(err);
  }
};
