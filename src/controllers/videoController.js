// server/src/controllers/videoController.js
import Video       from '../models/Video.js';
import Appointment from '../models/Appointment.js';
import { uploader } from '../middlewares/upload.js';
import { transcribe } from '../utils/transcribe.js';

export const uploadMulter = uploader.single('video'); // mp4, mov, …

export const create = async (req, res, next) => {
  try {
    const { title, behaviours = [], notes } = req.body;
    const { id: appointment } = req.params;

    // 1️⃣ Create the Video document (no transcript yet)
    const video = await Video.create({
      title,
      appointment,
      slp: req.user._id,
      behaviours: Array.isArray(behaviours) ? behaviours : [behaviours],
      notes,
      fileUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    });

    // 2️⃣ Link video back to the appointment
    await Appointment.findOneAndUpdate(
      { _id: appointment, slp: req.user._id },
      { video: video._id }
    );

    // 3️⃣ Run Whisper locally in background (non-blocking)
    (async () => {
      try {
        // transcribe() now returns [{ start, end, text }]
        const transcriptParts = await transcribe(req.file.path);
        await Video.findByIdAndUpdate(
          video._id,
          { transcript: transcriptParts }
        );
      } catch (err) {
        console.error("Transcription failed:", err.message);
      }
    })();

    // 4️⃣ Respond immediately with the Video (no transcript yet)
    res.status(201).json(video);
  } catch (e) {
    next(e);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const vid = await Video.findOne({
      _id: req.params.id,
      slp: req.user._id,
    })
    .populate("behaviours", "name");
    if (!vid) return res.status(404).json({ message: "Not found" });
    // vid.transcript (array of {start, end, text}) will be included
    res.json(vid);
  } catch (e) {
    next(e);
  }
};

export const updateBehaviours = async (req, res, next) => {
  try {
    const { behaviours = [] } = req.body;
    const { id } = req.params;

    // sanity: ensure each is a 24-char hex
    const isId = v => /^[0-9a-f]{24}$/i.test(v);
    if (!Array.isArray(behaviours) || !behaviours.every(isId))
      return res.status(400).json({ message: "behaviours must be id array" });

    const vid = await Video.findOneAndUpdate(
      { _id: id, slp: req.user._id },
      { behaviours },
      { new: true }
    ).populate("behaviours", "name");

    if (!vid) return res.status(404).json({ message: "Not found" });
    res.json(vid);
  } catch (e) {
    next(e);
  }
};
