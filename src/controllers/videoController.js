// server/src/controllers/videoController.js
import Video        from '../models/Video.js';
import Appointment  from '../models/Appointment.js';
import { uploader } from '../middlewares/upload.js';
import { transcribe } from '../utils/transcribe.js';
import Patient from '../models/Patient.js';
import Group   from '../models/Group.js';

export const uploadMulter = uploader.single('video');   // mp4, mov, …

/* ─────────────────────────  POST /api/appointments/:id/video  ───────────────────────── */
export const create = async (req, res, next) => {
  try {
    const { title, goals = [], notes } = req.body;      // ← goals
    const { id: appointment } = req.params;

    /* 1️⃣  Create the Video doc (no transcript yet) */
    const video = await Video.create({
      title,
      appointment,
      slp: req.user._id,
      goals: Array.isArray(goals) ? goals : [goals],    // ⬅️  save as simple strings
      notes,
      fileUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    });

    /* 2️⃣  Back-link to the appointment */
    await Appointment.findOneAndUpdate(
      { _id: appointment, slp: req.user._id },
      { video: video._id }
    );

    /* 3️⃣  Append a visitHistory stub to every participant */
    (async () => {
      try {
        const appt = await Appointment.findById(appointment)
          .populate('group',   'patients')
          .populate('patient', 'name');

        const participants =
          appt.type === 'group'
            ? (await Group.findById(appt.group)).patients
            : [appt.patient];

        const visitStub = {
          date:        appt.dateTimeEnd || new Date(),
          appointment: appt._id,
          type:        appt.type,
          aiInsights:  [],
          activities:  []
        };

        await Promise.all(
          participants.map(pid =>
            Patient.findByIdAndUpdate(
              pid,
              { $push: { visitHistory: visitStub } }
            )
          )
        );
      } catch (err) {
        console.error('visitHistory append failed:', err);
      }
    })();

    /* 4️⃣  Fire-and-forget Whisper transcription */
    (async () => {
      try {
        const transcript = await transcribe(req.file.path);      // [{start,end,text}]
        await Video.findByIdAndUpdate(video._id, { transcript });
      } catch (err) {
        console.error('Transcription failed:', err.message);
      }
    })();

    /* 5️⃣  Respond immediately */
    res.status(201).json(video);
  } catch (e) { next(e); }
};

/* ─────────────────────────  GET /api/videos/:id  ───────────────────────── */
export const getOne = async (req, res, next) => {
  try {
    const vid = await Video.findOne({
      _id: req.params.id,
      slp: req.user._id
    });                              // ⬅️  no populate needed – goals are strings
    if (!vid) return res.status(404).json({ message: 'Not found' });
    res.json(vid);
  } catch (e) { next(e); }
};

/* ─────────────────────────  PATCH /api/videos/:id/goals  ─────────────────────────
   Replace the entire goal list for a video
*/
export const updateGoals = async (req, res, next) => {
  try {
    const { goals = [] } = req.body;
    const { id } = req.params;

    if (!Array.isArray(goals))
      return res.status(400).json({ message: 'goals must be an array' });

    const vid = await Video.findOneAndUpdate(
      { _id: id, slp: req.user._id },
      { goals },
      { new: true }
    );

    if (!vid) return res.status(404).json({ message: 'Not found' });
    res.json(vid);
  } catch (e) { next(e); }
};
