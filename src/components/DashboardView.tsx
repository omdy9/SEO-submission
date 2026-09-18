import React from 'react';
import { 
  Layers, 
  Clock, 
  Sparkles, 
  CheckCheck, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ShieldAlert, 
  ArrowRight 
} from 'lucide-react';

interface DashboardViewProps {
  job: any;
  setActiveTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ job, setActiveTab }) => {
  if (!job) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="glass-card p-12 rounded-2xl border border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
            <Layers className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-display text-white mb-2">No Active Task Job Loaded</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Upload an Excel (.xlsx) file containing keywords, content types, and target submission sites to begin automation.
          </p>
          <button
            onClick={() => setActiveTab('upload')}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-600/30 transition-all"
          >
            <span>Upload Task Excel File</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const stats = job.stats || {};
  const total = stats.total || 1;
  const published = stats.published || 0;
  const progressPercent = Math.round(((published + (stats.failed || 0) + (stats.requiresHumanAction || 0)) / total) * 100);

  const cards = [
    { label: 'Total Tasks', value: stats.total || 0, icon: Layers, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Pending', value: stats.pending || 0, icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10' },
    { label: 'AI Generated', value: stats.generated || 0, icon: Sparkles, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Submitted', value: stats.submitted || 0, icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Published & Verified', value: stats.published || 0, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Pending Moderation', value: stats.pendingModeration || 0, icon: AlertTriangle, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Requires Human Action', value: stats.requiresHumanAction || 0, icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Failed', value: stats.failed || 0, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="glass-card p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-extrabold font-display text-white">Automation Dashboard</h1>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full text-xs font-semibold">
                Job #{job.id}
              </span>
            </div>
            <p className="text-slate-400">
              Created at {new Date(job.createdAt).toLocaleString()} • {stats.total} total Excel tasks loaded
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('review')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-700 transition"
            >
              Review Copy
            </button>
            <button
              onClick={() => setActiveTab('submission')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/30 transition"
            >
              Live Submissions
            </button>
          </div>
        </div>

        {/* Real-time Progress Bar */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <div className="flex justify-between items-center text-sm font-medium mb-2">
            <span className="text-slate-300">Overall Job Completion Progress</span>
            <span className="text-indigo-400 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="glass-card glass-card-hover p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-400">{c.label}</span>
                <div className={`p-2.5 rounded-xl ${c.bg} ${c.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold font-display text-white">{c.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
