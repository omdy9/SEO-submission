import React from 'react';
import { Download, FileSpreadsheet, CheckCircle2, ArrowLeft } from 'lucide-react';

interface ExportViewProps {
  job: any;
  setActiveTab: (tab: string) => void;
}

export const ExportView: React.FC<ExportViewProps> = ({ job, setActiveTab }) => {
  if (!job) return null;

  const handleDownload = () => {
    window.open(`/api/export/${job.id}`, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold font-display text-white">Step 8: Export Enriched Excel Report</h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Download the final Excel spreadsheet containing original rows along with generated titles, copy, AI providers, published URLs, and verification results.
        </p>
      </div>

      <div className="glass-card p-10 rounded-2xl border border-slate-800 space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <FileSpreadsheet className="w-10 h-10" />
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-1">SEO_Submission_Report_{job.id}.xlsx</h3>
          <p className="text-xs text-slate-400">{job.tasks.length} Rows Processed • Verified Status Appended</p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setActiveTab('results')}
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Results Matrix</span>
          </button>

          <button
            onClick={handleDownload}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-8 py-3.5 rounded-xl font-bold text-base shadow-xl shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" />
            <span>Download Completed Excel File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
