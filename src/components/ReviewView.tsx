import React, { useState } from 'react';
import { CheckCircle2, Edit3, RefreshCw, XCircle, Check, ArrowRight, ToggleLeft, ToggleRight } from 'lucide-react';

interface ReviewViewProps {
  job: any;
  setActiveTab: (tab: string) => void;
  dryRun: boolean;
  setDryRun: (val: boolean) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({ job, setActiveTab, dryRun, setDryRun }) => {
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  if (!job) return null;

  const handleOpenEdit = (t: any) => {
    setEditingTask(t);
    setEditTitle(t.generation?.aiResponse.title || '');
    setEditContent(t.generation?.aiResponse.content || '');
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;

    try {
      await fetch(`/api/jobs/${job.id}/tasks/${editingTask.task.rowIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      setEditingTask(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveAll = async () => {
    try {
      await fetch(`/api/jobs/${job.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndices: 'all' }),
      });
      setActiveTab('submission');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold font-display text-white">Step 5: Review & Approval Workflow</h1>
        <p className="text-slate-400">
          Review, edit, or regenerate copy before launching automated submissions.
        </p>
      </div>

      {/* Control Banner */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setDryRun(!dryRun)}
            className="flex items-center space-x-2 text-sm font-medium text-slate-300 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 hover:border-slate-700 transition"
          >
            {dryRun ? (
              <ToggleRight className="w-6 h-6 text-amber-400" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-slate-500" />
            )}
            <span>Dry Run Mode: <strong className={dryRun ? 'text-amber-400' : 'text-slate-400'}>{dryRun ? 'ON' : 'OFF'}</strong></span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleApproveAll}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-600/30 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve All & Submit</span>
          </button>
        </div>
      </div>

      {/* Review Cards Grid */}
      <div className="space-y-4">
        {job.tasks.map((t: any) => {
          const gen = t.generation;
          if (!gen) return null;

          return (
            <div key={t.task.rowIndex} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs text-slate-500 font-semibold">Row #{t.task.rowIndex}</span>
                  <span className="font-bold text-white text-base">{t.task.keyword}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {t.task.contentType}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Copy</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-base text-indigo-300">{gen.aiResponse.title}</div>
                <div className="text-xs text-slate-400 font-mono">Target Site: {t.task.targetSite}</div>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-4 rounded-xl border border-slate-800/60">
                  {gen.aiResponse.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card p-8 rounded-2xl border border-slate-800 max-w-2xl w-full space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Edit Generated Copy (Row #{editingTask.task.rowIndex})</h3>
              <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-white">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Article Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Body Content</label>
                <textarea
                  rows={8}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono text-xs leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditingTask(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
