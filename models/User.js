import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const MongooseUserModel = mongoose.model('User', UserSchema);

// Fallback JSON-file database implementation when MongoDB is offline (e.g. IP whitelist / network blocks)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB_PATH = path.join(__dirname, '../local_db.json');

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function readLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read local DB file:', e);
  }
  return { users: [] };
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write local DB file:', e);
  }
}

class LocalUserInstance {
  constructor(fields) {
    this._id = fields._id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.googleId = fields.googleId;
    this.email = fields.email;
    this.name = fields.name;
    this.picture = fields.picture;
    this.geminiApiKey = fields.geminiApiKey || '';
    this.resumeText = fields.resumeText || '';
    this.cumulativeReport = fields.cumulativeReport || null;
    this.reports = fields.reports || [];
    this.createdAt = fields.createdAt || new Date();
    this.updatedAt = fields.updatedAt || new Date();
  }

  async save() {
    const db = readLocalDb();
    const existingIndex = db.users.findIndex(u => u._id === this._id || (this.googleId && u.googleId === this.googleId));
    this.updatedAt = new Date();
    
    const serialized = {
      _id: this._id,
      googleId: this.googleId,
      email: this.email,
      name: this.name,
      picture: this.picture,
      geminiApiKey: this.geminiApiKey,
      resumeText: this.resumeText,
      cumulativeReport: this.cumulativeReport,
      reports: this.reports,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };

    if (existingIndex >= 0) {
      db.users[existingIndex] = serialized;
    } else {
      db.users.push(serialized);
    }
    
    writeLocalDb(db);
    return this;
  }
}

// Export a hybrid constructor that returns Mongoose documents if connected, or Local instances if not
function User(fields) {
  if (isMongoConnected()) {
    return new MongooseUserModel(fields);
  } else {
    return new LocalUserInstance(fields);
  }
}

User.findOne = async function(query) {
  if (isMongoConnected()) {
    return await MongooseUserModel.findOne(query);
  } else {
    const db = readLocalDb();
    const found = db.users.find(u => {
      for (let key in query) {
        if (u[key] !== query[key]) return false;
      }
      return true;
    });
    return found ? new LocalUserInstance(found) : null;
  }
};

User.findById = async function(id) {
  if (isMongoConnected()) {
    return await MongooseUserModel.findById(id);
  } else {
    const db = readLocalDb();
    const found = db.users.find(u => u._id === id);
    return found ? new LocalUserInstance(found) : null;
  }
};

User.MongooseUserModel = MongooseUserModel;

export default User;
