import React from 'react';
import { Globe2, ShieldCheck, ArrowRight, Layers } from 'lucide-react';

interface WebsiteConfigViewProps {
  job: any;
  setActiveTab: (tab: string) => void;
}

export const WebsiteConfigView: React.FC<WebsiteConfigViewProps> = ({ job, setActiveTab }) => {
  if (!job) return null;

  // Extract unique target sites
  const uniqueSites: string[] = Array.from(new Set(job.tasks.map((t: any) => t.task.targetSite)));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold font-display text-white">Step 3: Website Configuration & Analysis</h1>
        <p className="text-slate-400">
          The system inspects target submission websites to determine form schemas, submission types, and anti-bot rules.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {uniqueSites.map((siteUrl, idx) => (
          <div key={idx} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Globe2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm truncate max-w-xs">{siteUrl}</h4>
                  <span className="text-xs text-emerald-400 flex items-center space-x-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Submission Form Adapter Active</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Detected Form Fields:</span>
                <span className="font-medium text-slate-200">Title, Content, URL, Tags, Summary</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Submission Mode:</span>
                <span className="font-medium text-slate-200">Playwright Browser Engine</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Associated Tasks:</span>
                <span className="font-medium text-indigo-400">
                  {job.tasks.filter((t: any) => t.task.targetSite === siteUrl).length} Tasks
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setActiveTab('generation')}
          className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-600/30 transition"
        >
          <span>Continue to AI Content Generation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
