import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';

const router = Router();

// GET /api/reports - Fetch all reports & cumulative report
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      reports: user.reports || [],
      cumulativeReport: user.cumulativeReport || null
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to retrieve interview reports' });
  }
});

// POST /api/reports - Submit a new interview report and update cumulative report
router.post('/', authenticate, async (req, res) => {
  const { reportData } = req.body;

  if (!reportData) {
    return res.status(400).json({ error: 'Report data is required' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const apiKey = user.geminiApiKey || req.body.apiKey;
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API Key is missing. Please save it in your profile.' });
    }

    // Add new report to the user's reports array
    user.reports.push(reportData);
    
    // Update cumulative report using Gemini API
    let updatedCumulative = null;
    const oldCumulative = user.cumulativeReport;

    if (!oldCumulative) {
      // First report: Initialize cumulative report with the new report data
      updatedCumulative = {
        overallScore: reportData.overallScore,
        metrics: {
          technicalDepth: reportData.metrics?.technicalDepth || 70,
          communicationClarity: reportData.metrics?.communicationClarity || 70,
          problemSolving: reportData.metrics?.problemSolving || 70,
          poiseAndStructure: reportData.metrics?.poiseAndStructure || 70
        },
        executiveSummary: `This is your initial cumulative baseline. ${reportData.executiveSummary}`,
        methodology: reportData.methodology,
        keyFindings: reportData.keyFindings || [],
        insightsPatterns: reportData.insightsPatterns || 'Initial interview session registered.',
        recommendations: reportData.recommendations || [],
        conclusion: reportData.conclusion
      };
    } else {
      // Subsequent reports: Merge old cumulative report and new report using Gemini
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a Student Mentor representing the IIT Kharagpur interview preparation community.
Your task is to analyze a candidate's previous cumulative report and their latest interview report to generate an updated "Standard Cumulative Performance Report" that is cumulative of all reports.

Compare the old cumulative baseline and the new performance. Track the progress of the candidate, showing if they improved, which areas remain weak, or what new strengths they demonstrated.

Old Cumulative Performance:
${JSON.stringify(oldCumulative, null, 2)}

Latest Interview Performance:
${JSON.stringify(reportData, null, 2)}

Generate the new updated Standard Cumulative Report. You MUST respond with a valid JSON object matching the following structure:
{
  "overallScore": 82, // Cumulative average score out of 100 based on progress
  "metrics": {
    "technicalDepth": 80, // Updated cumulative score
    "communicationClarity": 85, // Updated cumulative score
    "problemSolving": 78, // Updated cumulative score
    "poiseAndStructure": 83 // Updated cumulative score
  },
  "executiveSummary": "A detailed 2-3 sentence overview analyzing the candidate's cumulative interview readiness and trends over time (e.g. improvements, growth areas, or newly identified strengths).",
  "methodology": "Explain the cumulative assessment methodology.",
  "keyFindings": [
    "Recurring or updated finding 1",
    "Recurring or updated finding 2"
  ],
  "insightsPatterns": "Examine trends in candidate performance, noting any positive or negative trajectory across interviews.",
  "recommendations": [
    "Actionable, prioritized cumulative recommendation 1",
    "Actionable, prioritized cumulative recommendation 2"
  ],
  "conclusion": "Final cumulative assessment verdict and interview readiness outlook."
}`;

        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        });

        const text = response.response.text();
        if (text) {
          updatedCumulative = JSON.parse(text);
        } else {
          throw new Error('Empty response from Gemini merge');
        }
      } catch (geminiError) {
        console.error('Gemini Cumulative Merge Error, falling back to mathematical average:', geminiError);
        
        // Fallback: Simple math average & concat strings if Gemini fails
        const count = user.reports.length;
        const calcAvg = (field) => {
          const sum = user.reports.reduce((acc, r) => acc + (r.metrics?.[field] || 70), 0);
          return Math.round(sum / count);
        };

        updatedCumulative = {
          overallScore: Math.round(user.reports.reduce((acc, r) => acc + r.overallScore, 0) / count),
          metrics: {
            technicalDepth: calcAvg('technicalDepth'),
            communicationClarity: calcAvg('communicationClarity'),
            problemSolving: calcAvg('problemSolving'),
            poiseAndStructure: calcAvg('poiseAndStructure')
          },
          executiveSummary: `Cumulative average of ${count} interview(s). Latest summary: ${reportData.executiveSummary}`,
          methodology: 'Mathematical moving average baseline due to merge utility fallback.',
          keyFindings: Array.from(new Set([...(oldCumulative.keyFindings || []), ...(reportData.keyFindings || [])])).slice(0, 5),
          insightsPatterns: `Aggregated data from ${count} sessions. Last checked performance showed a score of ${reportData.overallScore}.`,
          recommendations: Array.from(new Set([...(oldCumulative.recommendations || []), ...(reportData.recommendations || [])])).slice(0, 5),
          conclusion: 'Cumulative summary baseline maintained.'
        };
      }
    }

    user.cumulativeReport = updatedCumulative;
    await user.save();

    res.json({
      message: 'Report saved and cumulative profile updated successfully',
      reports: user.reports,
      cumulativeReport: user.cumulativeReport
    });
  } catch (error) {
    console.error('Error saving report:', error);
    res.status(500).json({ error: 'Failed to save report and update profile' });
  }
});

export default router;
