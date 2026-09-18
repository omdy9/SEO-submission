import { ProcessedTaskResult, TaskInput, TaskStatus, ColumnMapping } from '../../src/types';
import { Response } from 'express';

export interface JobState {
  id: string;
  createdAt: string;
  tasks: ProcessedTaskResult[];
  status: 'UPLOADED' | 'GENERATING' | 'GENERATED' | 'SUBMITTING' | 'PAUSED_HUMAN_ACTION' | 'COMPLETED' | 'FAILED';
  currentTaskIndex: number;
  // Excel metadata for manual re-mapping
  excelHeaders: string[];
  columnMapping: ColumnMapping;
  excelFilePath?: string; // Kept for re-parsing on manual mapping
  sampleRows: Record<string, any>[];
  stats: {
    total: number;
    pending: number;
    generated: number;
    approved: number;
    submitted: number;
    published: number;
    pendingModeration: number;
    failed: number;
    requiresHumanAction: number;
  };
  settings: {
    dryRun: boolean;
    similarityThreshold: number;
    concurrency: number;
  };
  sseClients: Response[];
  logs: { timestamp: string; level: 'info' | 'warn' | 'error'; message: string; taskId?: number }[];
}

export class JobManager {
  private static jobs: Map<string, JobState> = new Map();

  public static createJob(
    tasks: TaskInput[],
    excelHeaders: string[] = [],
    columnMapping: ColumnMapping = { keyword: 1, contentType: 3, targetSite: 4, keywordWebsite: 0 },
    sampleRows: Record<string, any>[] = [],
    excelFilePath?: string
  ): JobState {
    const jobId = `job_${Date.now()}`;
    const initialTasks: ProcessedTaskResult[] = tasks.map((task) => ({
      task,
      status: 'PENDING',
    }));

    const job: JobState = {
      id: jobId,
      createdAt: new Date().toISOString(),
      tasks: initialTasks,
      status: 'UPLOADED',
      currentTaskIndex: 0,
      excelHeaders,
      columnMapping,
      excelFilePath,
      sampleRows,
      stats: {
        total: initialTasks.length,
        pending: initialTasks.length,
        generated: 0,
        approved: 0,
        submitted: 0,
        published: 0,
        pendingModeration: 0,
        failed: 0,
        requiresHumanAction: 0,
      },
      settings: {
        dryRun: false,
        similarityThreshold: 0.70,
        concurrency: 1,
      },
      sseClients: [],
      logs: [],
    };

    this.jobs.set(jobId, job);
    this.addLog(jobId, 'info', `Job ${jobId} created with ${tasks.length} task rows.`);
    return job;
  }

  public static getJob(jobId: string): JobState | undefined {
    return this.jobs.get(jobId);
  }

  public static getAllJobs(): JobState[] {
    return Array.from(this.jobs.values());
  }

  /** Strip non-serializable fields (sseClients, excelFilePath) for JSON responses */
  public static toSafeJSON(job: JobState): any {
    const { sseClients, excelFilePath, ...safe } = job;
    return safe;
  }

  public static getAllJobsSafe(): any[] {
    return Array.from(this.jobs.values()).map((j) => this.toSafeJSON(j));
  }

  public static updateJobTasks(jobId: string, tasks: TaskInput[], mapping: ColumnMapping): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.tasks = tasks.map((task) => ({
      task,
      status: 'PENDING' as TaskStatus,
    }));
    job.columnMapping = mapping;
    this.recalculateStats(jobId);
    this.addLog(jobId, 'info', `Column mapping updated. Re-parsed ${tasks.length} rows.`);
    this.broadcastSSE(jobId, { type: 'JOB_REMAPPED', tasks: job.tasks, mapping });
  }

  public static updateTask(jobId: string, rowIndex: number, updates: Partial<ProcessedTaskResult>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const taskIndex = job.tasks.findIndex((t) => t.task.rowIndex === rowIndex);
    if (taskIndex !== -1) {
      job.tasks[taskIndex] = { ...job.tasks[taskIndex], ...updates };
      this.recalculateStats(jobId);
      this.broadcastSSE(jobId, { type: 'TASK_UPDATED', rowIndex, task: job.tasks[taskIndex] });
    }
  }

  public static updateJobStatus(jobId: string, status: JobState['status']): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;
    this.broadcastSSE(jobId, { type: 'JOB_STATUS_CHANGED', status });
  }

  public static addLog(jobId: string, level: 'info' | 'warn' | 'error', message: string, taskId?: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const entry = { timestamp: new Date().toISOString(), level, message, taskId };
    job.logs.push(entry);
    this.broadcastSSE(jobId, { type: 'LOG', log: entry });
  }

  public static registerSSEClient(jobId: string, res: Response): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.sseClients.push(res);
    res.on('close', () => {
      job.sseClients = job.sseClients.filter((client) => client !== res);
    });
  }

  public static broadcastSSE(jobId: string, data: any): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const payload = `data: ${JSON.stringify(data)}\n\n`;
    job.sseClients.forEach((client) => {
      client.write(payload);
    });
  }

  public static recalculateStats(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const stats = {
      total: job.tasks.length,
      pending: 0,
      generated: 0,
      approved: 0,
      submitted: 0,
      published: 0,
      pendingModeration: 0,
      failed: 0,
      requiresHumanAction: 0,
    };

    job.tasks.forEach((t) => {
      switch (t.status) {
        case 'PENDING':
        case 'ANALYZING':
          stats.pending++;
          break;
        case 'GENERATED':
          stats.generated++;
          break;
        case 'SUBMITTED':
          stats.submitted++;
          break;
        case 'PUBLISHED':
          stats.published++;
          break;
        case 'PENDING_MODERATION':
          stats.pendingModeration++;
          break;
        case 'REQUIRES_MANUAL_ACTION':
          stats.requiresHumanAction++;
          break;
        case 'FAILED':
        case 'VERIFICATION_FAILED':
          stats.failed++;
          break;
      }
    });

    job.stats = stats;
    this.broadcastSSE(jobId, { type: 'STATS_UPDATED', stats });
  }
}
