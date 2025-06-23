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
    const {
      type,                // "group" | "individual"
      group,               // ObjectId  (when type === "group")
      patient,             // ObjectId  (when type === "individual")
      dateTimeStart,
      dateTimeEnd,
    } = req.body;

    /* 1️⃣  create the appointment itself */
    const appt = await Appointment.create({
      ...req.body,
      slp: req.user._id,
    });

    /* 2️⃣  link ↔ group / patient collections so it’s easy to query later */
    if (type === "group") {
      /* 2a ‒ save the id on the Group doc */
      await Group.findByIdAndUpdate(group, {
        $addToSet: { appointments: appt._id },
      });

      /* 2b ‒ push into every patient who belongs to that group */
      const grp = await Group.findById(group, "patients");
      if (grp?.patients?.length) {
        await Patient.updateMany(
          { _id: { $in: grp.patients } },
          { $addToSet: { appointments: appt._id } }
        );
      const attendanceRow = {
        appointment: appt._id,
        date:        dateTimeStart,   // ← add the start date
        status:      "not-started",
      };
      await Patient.updateMany(
        { _id: { $in: grp.patients } },
        {
          $addToSet: { appointments: appt._id },
          $push:     { attendance: attendanceRow },
        }
      );
      }
    } else {
      /* individual session → just the one patient */
      await Patient.findByIdAndUpdate(patient, {
        $addToSet: { appointments: appt._id },
      });
      const attendanceRow = {
        appointment: appt._id,
        date:        dateTimeStart,   // ← add the start date
        status:      "not-started",
      };
      await Patient.findByIdAndUpdate(patient, {
        $addToSet: { appointments: appt._id },
        $push:     { attendance: attendanceRow },
      });
    }

    res.status(201).json(appt);
  } catch (err) {
    next(err);
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

       if (appt && dateTimeStart) {
     await Patient.updateMany(
       { attendance: { $elemMatch: { appointment: appt._id } } },
       { $set: { "attendance.$[elem].date": dateTimeStart } },
       { arrayFilters: [ { "elem.appointment": appt._id } ] }
     );
   }

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
      .populate('activities', 'name description materials createdAt members')
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
