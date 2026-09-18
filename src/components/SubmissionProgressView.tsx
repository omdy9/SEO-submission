import React, { useState } from 'react';
import { Send, Terminal, ShieldAlert, CheckCircle, ArrowRight, Play, Pause } from 'lucide-react';

interface SubmissionProgressViewProps {
  job: any;
  setActiveTab: (tab: string) => void;
  logs: any[];
}

export const SubmissionProgressView: React.FC<SubmissionProgressViewProps> = ({ job, setActiveTab, logs }) => {
  const [submitting, setSubmitting] = useState(false);

  if (!job) return null;

  const handleStartSubmission = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/jobs/${job.id}/submit`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const humanActionTask = job.tasks.find((t: any) => t.status === 'REQUIRES_MANUAL_ACTION');

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold font-display text-white">Step 6: Submission Progress & Execution</h1>
        <p className="text-slate-400">
          Playwright browser engine automates site submissions and verifies published live URLs in real time.
        </p>
      </div>

      {/* Control Banner */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">Submission Execution Engine</h3>
          <p className="text-sm text-slate-400">
            {job.stats?.published || 0} of {job.tasks.length} tasks published & verified
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleStartSubmission}
            disabled={submitting || job.status === 'COMPLETED'}
            className={`inline-flex items-center space-x-2 px-6 py-3 rounded-xl font-medium shadow-lg transition ${
              submitting
                ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
                : job.status === 'COMPLETED'
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Executing Submissions...' : job.status === 'COMPLETED' ? 'Submissions Completed' : 'Launch Submissions'}</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-medium border border-slate-700 transition"
          >
            <span>View Results</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Human Action Warning Modal Alert */}
      {humanActionTask && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-2xl flex items-start space-x-4">
          <ShieldAlert className="w-8 h-8 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-300 text-lg">HUMAN ACTION REQUIRED (Row #{humanActionTask.task.rowIndex})</h4>
            <p className="text-sm text-slate-300">
              The submission target <strong>{humanActionTask.task.targetSite}</strong> encountered anti-bot verification or a login wall ({humanActionTask.submission?.requiresManualActionReason}).
            </p>
            <p className="text-xs text-amber-400 font-semibold pt-1">
              Please complete verification in your browser and resume processing.
            </p>
          </div>
        </div>
      )}

      {/* Live Log Console */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-mono text-xs text-slate-300">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>Live Automation Execution Stream</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>

        <div className="p-6 font-mono text-xs bg-slate-950/90 text-slate-300 max-h-80 overflow-y-auto space-y-2 leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic">No execution logs recorded yet. Click "Launch Submissions" to start.</div>
          ) : (
            logs.map((log: any, idx: number) => (
              <div key={idx} className="flex space-x-3">
                <span className="text-slate-600 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className={log.level === 'warn' ? 'text-amber-400' : log.level === 'error' ? 'text-rose-400' : 'text-slate-300'}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
