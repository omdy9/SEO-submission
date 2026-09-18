import React, { useState } from 'react';
import { Sparkles, ArrowRight, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ContentGenerationViewProps {
  job: any;
  setActiveTab: (tab: string) => void;
}

export const ContentGenerationView: React.FC<ContentGenerationViewProps> = ({ job, setActiveTab }) => {
  const [generating, setGenerating] = useState(false);

  if (!job) return null;

  const handleStartGeneration = async () => {
    setGenerating(true);
    try {
      await fetch(`/api/jobs/${job.id}/generate`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const generatedCount = job.tasks.filter((t: any) => t.generation).length;
  const isComplete = generatedCount === job.tasks.length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold font-display text-white">Step 4: AI Content Generation & Uniqueness Checks</h1>
        <p className="text-slate-400">
          Google Gemini API generates tailored copy per task row while enforcing TF-IDF similarity deduplication.
        </p>
      </div>

      {/* Control Banner */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">AI Content Generator Status</h3>
          <p className="text-sm text-slate-400">
            Generated {generatedCount} of {job.tasks.length} task copy packages
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleStartGeneration}
            disabled={generating || isComplete}
            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium shadow-lg transition ${
              generating
                ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
                : isComplete
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Generating AI Copy...' : isComplete ? 'Generation Complete' : 'Start AI Generation'}</span>
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-medium border border-slate-700 transition"
          >
            <span>Proceed to Review</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Task List Cards */}
      <div className="space-y-4">
        {job.tasks.map((t: any) => {
          const gen = t.generation;
          const similarity = gen ? Math.round(gen.similarityScore * 100) : 0;
          return (
            <div key={t.task.rowIndex} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs text-slate-500 font-semibold">Row #{t.task.rowIndex}</span>
                  <span className="font-bold text-white text-base">{t.task.keyword}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {t.task.contentType}
                  </span>
                </div>

                {gen ? (
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
                      Provider: {gen.providerUsed}
                    </span>
                    <span className={`px-2 py-1 rounded border font-semibold flex items-center space-x-1 ${
                      similarity <= 70 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Similarity: {similarity}%</span>
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 italic">Pending generation</span>
                )}
              </div>

              {gen && (
                <div className="bg-slate-900/60 p-4 rounded-xl space-y-2 border border-slate-800/80">
                  <div className="font-semibold text-sm text-indigo-300">{gen.aiResponse.title}</div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{gen.aiResponse.content}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
