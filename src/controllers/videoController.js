// server/src/controllers/videoController.js
import Video        from '../models/Video.js';
import Appointment  from '../models/Appointment.js';
import { transcribe } from '../utils/transcribe.js';
import Patient from '../models/Patient.js';
import Group   from '../models/Group.js';
import { BUCKETS, generatePresignedUrl } from '../config/minio.js';

/* ─────────────────────────  GET /api/videos  ───────────────────────── */
export const list = async (req, res, next) => {
  try {
    const videos = await Video.find({ slp: req.user._id })
      .sort({ createdAt: -1 });

    // Generate fresh presigned URLs for each video
    for (const video of videos) {
      if (video.minioInfo?.bucketName && video.minioInfo?.objectName) {
        video.fileUrl = await generatePresignedUrl(
          video.minioInfo.bucketName,
          video.minioInfo.objectName,
          'getObject',
          24 * 60 * 60 // 24 hours
        );
      }
    }

    res.json(videos);
  } catch (e) {
    next(e);
  }
};

/* ─────────────────────────  POST /api/appointments/:id/video  ───────────────────────── */
export const create = async (req, res, next) => {
  try {
    const { title, goals = [], notes } = req.body;      // ← goals
    const { id: appointment } = req.params;

    // Check if MinIO file info is available
    if (!req.minioFile) {
      return res.status(400).json({ error: 'No file uploaded to MinIO' });
    }

    /* 1️⃣  Create the Video doc (no transcript yet) */
    const video = await Video.create({
      title,
      appointment,
      slp: req.user._id,
      goals: Array.isArray(goals) ? goals : [goals],    // ⬅️  save as simple strings
      notes,
      fileUrl: req.minioFile.url,
      minioInfo: {
        bucketName: req.minioFile.bucketName,
        objectName: req.minioFile.objectName,
        originalName: req.minioFile.originalName
      }
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
        // For MinIO, we need to handle transcription differently
        // We'll need to download the file temporarily or use a streaming approach
        // For now, we'll skip transcription until we implement MinIO-compatible transcription
        console.log('Transcription skipped - MinIO integration pending');
        // TODO: Implement MinIO-compatible transcription
        // const transcript = await transcribe(req.file.path);
        // await Video.findByIdAndUpdate(video._id, { transcript });
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
    
    // Generate fresh presigned URL if MinIO info exists
    if (vid.minioInfo?.bucketName && vid.minioInfo?.objectName) {
      vid.fileUrl = await generatePresignedUrl(
        vid.minioInfo.bucketName,
        vid.minioInfo.objectName,
        'getObject',
        24 * 60 * 60 // 24 hours
      );
    }
    
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
    if (!vid) return res.status(404).json({ message: "Not found" });

    /* 2️⃣  Find all participants of that appointment */
    const appt = await Appointment.findById(vid.appointment)
      .populate("patient", "_id goals")
      .populate("group",   "patients");

    const participants =
      appt.type === "group"
        ? (await Group.findById(appt.group)).patients          // full docs
        : [appt.patient];

    /* 3️⃣  For each participant, upsert history rows @ 0 % */
    await Promise.all(
      participants.map(async (p) => {
        const pat = await Patient.findById(p._id || p);
        if (!pat) return;

        goals.forEach((gName) => {
          /* ignore if goal not in this patient’s master list */
          if (!pat.goals.includes(gName)) return;

          let gp = pat.goalProgress.find((r) => r.name === gName);
          if (!gp) {
            gp = { name: gName, progress: 0, history: [] };
            pat.goalProgress.push(gp);
          }

          const row = gp.history.find(
            (h) => String(h.appointment) === String(appt._id)
          );
          if (!row) {
            gp.history.push({
              appointment: appt._id,
              date       : new Date(),
              progress   : gp.progress ?? 0,
            });
          }
        });

        await pat.save();
      })
    );

    res.json(vid);
  } catch (e) { next(e); }
};
