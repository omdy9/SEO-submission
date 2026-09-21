import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { ExcelService } from '../../src/services/excelService';
import { AIService } from '../../src/services/aiService';
import { UniquenessService } from '../../src/services/uniquenessService';
import { SubmissionAdapter } from '../../src/services/submissionAdapter';
import { VerificationService } from '../../src/services/verificationService';
import { JobManager } from './jobManager';
import { ColumnMapping } from '../../src/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const uploadDir = process.env.VERCEL ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

let appSettings = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  submissionUsername: process.env.SUBMISSION_USERNAME || '',
  submissionPassword: process.env.SUBMISSION_PASSWORD || '',
  dryRun: false,
  similarityThreshold: globalThis.parseFloat(process.env.SIMILARITY_THRESHOLD || '0.70'),
  concurrency: 1,
};

// 1. Upload Excel — returns headers, auto-mapping, and parsed tasks
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    const filePath = req.file.path;
    
    // Keep the file for potential re-mapping later
    const persistPath = path.join(uploadDir, `excel_${Date.now()}.xlsx`);
    fs.copyFileSync(filePath, persistPath);

    const parseResult = await ExcelService.parseExcel(filePath);

    if (parseResult.tasks.length === 0) {
      return res.status(400).json({ error: 'Excel file contains no valid keyword task rows.' });
    }

    const job = JobManager.createJob(
      parseResult.tasks,
      parseResult.headers,
      parseResult.autoMapping,
      parseResult.sampleRows,
      persistPath
    );

    // Clean up original upload temp file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      jobId: job.id,
      job: JobManager.toSafeJSON(job),
      headers: parseResult.headers,
      autoMapping: parseResult.autoMapping,
      sampleRows: parseResult.sampleRows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Manual Column Re-Mapping — re-parses Excel with user-chosen column indices
app.post('/api/jobs/:id/remap', async (req: Request, res: Response): Promise<any> => {
  try {
    const jobId = String(req.params.id);
    const job = JobManager.getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const { mapping } = req.body as { mapping: ColumnMapping };
    if (!mapping || !mapping.keyword || !mapping.contentType || !mapping.targetSite) {
      return res.status(400).json({ error: 'Invalid mapping: keyword, contentType, and targetSite are required.' });
    }

    if (!job.excelFilePath || !fs.existsSync(job.excelFilePath)) {
      return res.status(400).json({ error: 'Original Excel file not available for re-mapping.' });
    }

    const parseResult = await ExcelService.parseExcel(job.excelFilePath, mapping);

    if (parseResult.tasks.length === 0) {
      return res.status(400).json({ error: 'Re-mapping produced no valid rows.' });
    }

    JobManager.updateJobTasks(jobId, parseResult.tasks, mapping);

    const updatedJob = JobManager.getJob(jobId)!;
    res.json({
      message: `Re-mapped successfully. ${parseResult.tasks.length} rows parsed.`,
      job: JobManager.toSafeJSON(updatedJob),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Job Details
app.get('/api/jobs/:id', (req: Request, res: Response): any => {
  const jobId = String(req.params.id);
  const job = JobManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(JobManager.toSafeJSON(job));
});

// 4. List All Jobs
app.get('/api/jobs', (req: Request, res: Response) => {
  const jobs = JobManager.getAllJobsSafe();
  res.json(jobs);
});

// 5. SSE Stream
app.get('/api/jobs/:id/stream', (req: Request, res: Response): any => {
  const jobId = String(req.params.id);
  const job = JobManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  JobManager.registerSSEClient(jobId, res);
  res.write(`data: ${JSON.stringify({ type: 'INIT', job: JobManager.toSafeJSON(job) })}\n\n`);
});

// 6. Trigger AI Generation
app.post('/api/jobs/:id/generate', async (req: Request, res: Response): Promise<any> => {
  const jobId = String(req.params.id);
  const job = JobManager.getJob(jobId);

  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json({ message: 'Generation started' });

  JobManager.updateJobStatus(jobId, 'GENERATING');
  JobManager.addLog(jobId, 'info', 'Starting batch AI content generation...');

  const aiService = new AIService();
  const uniquenessService = new UniquenessService();

  for (const item of job.tasks) {
    if (item.status === 'PENDING' || item.status === 'FAILED') {
      try {
        JobManager.updateTask(jobId, item.task.rowIndex, { status: 'ANALYZING' });
        JobManager.addLog(jobId, 'info', `Generating content for row ${item.task.rowIndex} ("${item.task.keyword}")...`);

        let genResult = await aiService.generateContent(item.task);
        let uniqCheck = uniquenessService.checkUniqueness(
          genResult.aiResponse.content,
          appSettings.similarityThreshold
        );

        let retries = 0;
        while (!uniqCheck.isUnique && retries < 2) {
          retries++;
          JobManager.addLog(jobId, 'warn', `Similarity score ${(uniqCheck.maxSimilarity * 100).toFixed(1)}% exceeds threshold. Regenerating row ${item.task.rowIndex} (Attempt ${retries})...`);
          
          const note = `CRITICAL: Re-write content to be completely distinct from "${uniqCheck.matchedTitle}". Change phrasing and structure.`;
          genResult = await aiService.generateContent(item.task, note);
          uniqCheck = uniquenessService.checkUniqueness(
            genResult.aiResponse.content,
            appSettings.similarityThreshold
          );
        }

        genResult.similarityScore = uniqCheck.maxSimilarity;
        uniquenessService.saveToHistory(
          item.task.keyword,
          item.task.contentType,
          genResult.aiResponse.title,
          genResult.aiResponse.content
        );

        JobManager.updateTask(jobId, item.task.rowIndex, {
          generation: genResult,
          status: 'GENERATED',
        });
        JobManager.addLog(jobId, 'info', `✅ Content generated for row ${item.task.rowIndex}: "${genResult.aiResponse.title}"`);
      } catch (err: any) {
        JobManager.updateTask(jobId, item.task.rowIndex, {
          status: 'FAILED',
          error: err.message,
        });
        JobManager.addLog(jobId, 'error', `❌ Content generation failed for row ${item.task.rowIndex}: ${err.message}`);
      }
    }
  }

  JobManager.updateJobStatus(jobId, 'GENERATED');
  JobManager.addLog(jobId, 'info', 'All task content generated. Ready for review and approval.');
});

// 7. Approve Tasks
app.post('/api/jobs/:id/approve', (req: Request, res: Response): any => {
  const jobId = String(req.params.id);
  const job = JobManager.getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const { rowIndices } = req.body;

  job.tasks.forEach((t) => {
    if (rowIndices === 'all' || (Array.isArray(rowIndices) && rowIndices.includes(t.task.rowIndex))) {
      if (t.generation && t.status === 'GENERATED') {
        JobManager.updateTask(jobId, t.task.rowIndex, { status: 'GENERATED' });
      }
    }
  });

  res.json({ message: 'Tasks approved' });
});

// 8. Edit Task Content
app.put('/api/jobs/:id/tasks/:rowIndex', (req: Request, res: Response): any => {
  const jobId = String(req.params.id);
  const rowIndex = String(req.params.rowIndex);
  const { title, short_description, content, target_url } = req.body;

  const job = JobManager.getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const parsedRow = globalThis.parseInt(rowIndex, 10);
  const taskIndex = job.tasks.findIndex((t) => t.task.rowIndex === parsedRow);
  if (taskIndex !== -1 && job.tasks[taskIndex].generation) {
    const current = job.tasks[taskIndex].generation!.aiResponse;
    job.tasks[taskIndex].generation!.aiResponse = {
      ...current,
      title: title !== undefined ? title : current.title,
      short_description: short_description !== undefined ? short_description : current.short_description,
      content: content !== undefined ? content : current.content,
      target_url: target_url !== undefined ? target_url : current.target_url,
    };
    JobManager.updateTask(jobId, parsedRow, job.tasks[taskIndex]);
    JobManager.addLog(jobId, 'info', `Edited generated content for row ${rowIndex}.`);
    return res.json(job.tasks[taskIndex]);
  }

  res.status(400).json({ error: 'Task or generation not found' });
});

// 9. Submit Approved Tasks
app.post('/api/jobs/:id/submit', async (req: Request, res: Response): Promise<any> => {
  const jobId = String(req.params.id);
  const job = JobManager.getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json({ message: 'Submission execution started' });

  JobManager.updateJobStatus(jobId, 'SUBMITTING');
  JobManager.addLog(jobId, 'info', `Starting automated submission pipeline (Dry Run: ${appSettings.dryRun})...`);

  const submissionAdapter = new SubmissionAdapter();
  const verificationService = new VerificationService();

  for (const item of job.tasks) {
    if (item.generation && (item.status === 'GENERATED' || item.status === 'FAILED')) {
      try {
        JobManager.updateTask(jobId, item.task.rowIndex, { status: 'SUBMITTED' });
        JobManager.addLog(jobId, 'info', `Submitting row ${item.task.rowIndex} to ${item.task.targetSite}...`);

        const subResult = await submissionAdapter.submitContent(
          item.task,
          item.generation.aiResponse,
          appSettings.dryRun,
          {
            username: appSettings.submissionUsername,
            password: appSettings.submissionPassword,
          }
        );

        let verResult = undefined;
        let finalStatus = subResult.status;

        if (subResult.finalPublishedUrl && subResult.status === 'PUBLISHED') {
          JobManager.addLog(jobId, 'info', `Verifying published URL: ${subResult.finalPublishedUrl}...`);
          verResult = await verificationService.verifyPublishedUrl(
            subResult.finalPublishedUrl,
            item.generation.aiResponse.title,
            item.generation.aiResponse.target_url
          );
          finalStatus = verResult.status;
        }

        JobManager.updateTask(jobId, item.task.rowIndex, {
          submission: subResult,
          verification: verResult,
          status: finalStatus,
        });

        if (finalStatus === 'PUBLISHED') {
          JobManager.addLog(jobId, 'info', `✅ Row ${item.task.rowIndex} Published & Verified! URL: ${subResult.finalPublishedUrl}`);
        } else if (finalStatus === 'REQUIRES_MANUAL_ACTION') {
          JobManager.addLog(jobId, 'warn', `⚠️ Row ${item.task.rowIndex} Requires Manual Action: ${subResult.requiresManualActionReason}`);
        } else {
          JobManager.addLog(jobId, 'error', `❌ Row ${item.task.rowIndex} status: ${finalStatus}`);
        }
      } catch (err: any) {
        JobManager.updateTask(jobId, item.task.rowIndex, {
          status: 'FAILED',
          error: err.message,
        });
        JobManager.addLog(jobId, 'error', `❌ Row ${item.task.rowIndex} submission failed: ${err.message}`);
      }
    }
  }

  JobManager.updateJobStatus(jobId, 'COMPLETED');
  JobManager.addLog(jobId, 'info', '🎉 All task submissions completed!');
});

// 10. Export Results to Excel
app.get('/api/export/:id', async (req: Request, res: Response): Promise<any> => {
  const jobId = String(req.params.id);
  const job = JobManager.getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const exportPath = path.join(uploadDir, `report_${jobId}.xlsx`);
  await ExcelService.writeResults(exportPath, job.tasks);

  res.download(exportPath, `SEO_Submission_Report_${jobId}.xlsx`, () => {
    if (fs.existsSync(exportPath)) {
      fs.unlinkSync(exportPath);
    }
  });
});

// 11. Settings API
app.get('/api/settings', (req: Request, res: Response) => {
  res.json(appSettings);
});

app.post('/api/settings', (req: Request, res: Response) => {
  appSettings = { ...appSettings, ...req.body };
  if (req.body.geminiApiKey) process.env.GEMINI_API_KEY = req.body.geminiApiKey;
  if (req.body.groqApiKey) process.env.GROQ_API_KEY = req.body.groqApiKey;
  res.json({ message: 'Settings saved', settings: appSettings });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🌐 SEO Submission Automation Server running on http://localhost:${PORT}`);
  });
}

export default app;
