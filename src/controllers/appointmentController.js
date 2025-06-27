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


/**
 * DELETE  /api/appointments/:id
 * --------------------------------------------
 * 1. delete the appointment
 * 2. pull it out of the group's .appointments[]
 * 3. if no appointments remain:
 *      – delete the group
 *      – clear group ref on members
 *      – remove avatar file (if local)
 */
export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    /* 1️⃣  locate & delete the appointment -------------------- */
    const appt = await Appointment.findOneAndDelete({
      _id: id,
      slp: req.user._id,
    }).populate("group", "patients avatarUrl slp");
    if (!appt) return res.status(404).json({ message: "Not found" });

    /* 2️⃣  if this appointment belonged to a group … ---------- */
    if (appt.group) {
      const gId = appt.group._id;

      // pull the id out of the array (in case you store it there)
      await Group.updateOne({ _id: gId }, { $pull: { appointments: id } });

      // how many appointments are still tied to that group?
      const remaining = await Appointment.countDocuments({ group: gId });

      /* 3️⃣  if there are **zero** left, delete the group too -- */
      if (remaining === 0) {
        const grp = await Group.findOneAndDelete({
          _id: gId,
          slp: req.user._id,
        });

        if (grp) {
          /* unlink local avatar file (if any) */
          if (grp.avatarUrl?.startsWith("http")) {
            const local = grp.avatarUrl.replace(
              `${req.protocol}://${req.get("host")}`,
              "."
            );
            if (fs.existsSync(local)) fs.unlinkSync(local);
          }

          /* clear group on each patient ----------------------- */
          await Patient.updateMany(
            { _id: { $in: grp.patients } },
            { $unset: { group: "" } }
          );
        }
      }
    }

    return res.json({ ok: true });
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

/* POST  /api/appointments/bulk
   body: { appointments:[ { type, group, patient, dateTimeStart, dateTimeEnd } ] }
*/
export const createBulk = async (req,res,next)=>{
  try{
    const { appointments=[] } = req.body;
    if(!Array.isArray(appointments) || appointments.length===0)
      return res.status(400).json({ message:"appointments[] required" });

    /* reuse the existing create() logic for each row */
    const created = [];
    for (const payload of appointments){
      const aReq = { ...payload, slp:req.user._id };
      const appt = await Appointment.create(aReq);

      /* --- backlink group / patient (same as single create) ---- */
      if (payload.type==="group" && payload.group){
        await Group.findByIdAndUpdate(payload.group,
            { $addToSet:{ appointments: appt._id }});
        const grp = await Group.findById(payload.group,"patients");
        if(grp?.patients?.length){
          await Patient.updateMany(
            { _id:{ $in: grp.patients } },
            { $addToSet:{ appointments: appt._id },
              $push:{ attendance:{
                appointment: appt._id,
                date: payload.dateTimeStart,
                status:"not-started"} } }
          );
        }
      }else if(payload.type==="individual" && payload.patient){
        await Patient.findByIdAndUpdate(payload.patient,{
          $addToSet:{ appointments: appt._id },
          $push:{ attendance:{
            appointment: appt._id,
            date: payload.dateTimeStart,
            status:"not-started"} }
        });
      }
      created.push(appt);
    }

    res.status(201).json(created);
  }catch(e){ next(e); }
};
