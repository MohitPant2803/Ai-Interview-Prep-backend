import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
  role: { type: String, required: true },
  overallScore: { type: Number, required: true },
  metrics: {
    technicalDepth: Number,
    communicationClarity: Number,
    problemSolving: Number,
    poiseAndStructure: Number
  },
  executiveSummary: String,
  methodology: String,
  keyFindings: [String],
  detailedFeedback: mongoose.Schema.Types.Mixed, // Storing question-by-question findings
  insightsPatterns: String,
  recommendations: [String],
  limitations: String,
  conclusion: String,
  chatHistory: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  picture: { type: String },
  geminiApiKey: { type: String, default: '' },
  resumeText: { type: String, default: '' },
  cumulativeReport: { type: mongoose.Schema.Types.Mixed, default: null },
  reports: [ReportSchema]
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
