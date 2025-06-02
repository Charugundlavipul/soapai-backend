// server/src/controllers/recommendationController.js
import Appointment    from "../models/Appointment.js";
import Recommendation from "../models/Recommendation.js";
import Patient        from "../models/Patient.js";

export const createRecommendation = async (req, res, next) => {
  try {
    const apptId = req.params.id;
    const appt = await Appointment.findById(apptId)
      .populate("group")
      .populate("patient");

    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    if (appt.recommendation) {
      return res.status(400).json({ message: "Already generated" });
    }

    let groupInsights = [];
    let individualInsights = [];

    if (appt.type === "group") {
      groupInsights = [
        {
          time: "00:00 - 00:05",
          text: `Group “${appt.group.name}” tended to shift topics frequently.`,
          tag: "AI Insight: Topic Drift Detected",
          tagColor: "bg-red-100 text-red-600"
        }
      ];

      // For each patient in that group, stub one insight
      const patientDocs = await Patient.find({ _id: { $in: appt.group.patients } });
      individualInsights = patientDocs.map((pat) => ({
        patient: pat._id,
        insights: [
          {
            time: "00:10 - 00:12",
            text: `Patient ${pat.name} spoke less than expected.`,
            tag: "AI Insight: Low Verbal Output",
            tagColor: "bg-red-100 text-red-600"
          }
        ]
      }));
    } else {
      // Individual appointment
      groupInsights = [];
      individualInsights = [
        {
          patient: appt.patient._id,
          insights: [
            {
              time: "00:00 - 00:03",
              text: `Patient ${appt.patient.name} showed strong eye contact.`,
              tag: "AI Insight: Good Eye Contact",
              tagColor: "bg-green-100 text-green-600"
            }
          ]
        }
      ];
    }

    const newRec = await Recommendation.create({
      appointment: appt._id,
      groupInsights,
      individualInsights,
      materials: []
    });

    appt.recommendation = newRec._id;
    await appt.save();

    return res.status(201).json(newRec);
  } catch (err) {
    next(err);
  }
};

export const getRecommendation = async (req, res, next) => {
  try {
    const apptId = req.params.id;
    const appt = await Appointment.findById(apptId).populate({
      path: "recommendation",
      populate: {
        path: "individualInsights.patient",
        select: "name avatarUrl"
      }
    });

    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    if (!appt.recommendation) {
      return res.status(404).json({ message: "No recommendations yet" });
    }

    return res.json(appt.recommendation);
  } catch (err) {
    next(err);
  }
};
