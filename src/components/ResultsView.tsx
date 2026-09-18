import React, { useState } from 'react';
import { ExternalLink, CheckCircle, Clock, ShieldAlert, XCircle, Search, Download } from 'lucide-react';

interface ResultsViewProps {
  job: any;
  setActiveTab: (tab: string) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ job, setActiveTab }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  if (!job) return null;

  const filteredTasks = job.tasks.filter((t: any) => {
    const matchesSearch = t.task.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.task.targetSite.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold font-display text-white">Step 7: Task Submission Results</h1>
        <p className="text-slate-400">
          Searchable matrix of generated content, captured live published URLs, and verification results.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search keywords or target URLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published & Verified</option>
            <option value="PENDING_MODERATION">Pending Moderation</option>
            <option value="REQUIRES_MANUAL_ACTION">Requires Human Action</option>
            <option value="FAILED">Failed</option>
          </select>

          <button
            onClick={() => setActiveTab('export')}
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-lg shadow-indigo-600/30 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Row #</th>
                <th className="px-6 py-4">Keyword</th>
                <th className="px-6 py-4">Content Type</th>
                <th className="px-6 py-4">Generated Title</th>
                <th className="px-6 py-4">AI Provider</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Final Published URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTasks.map((t: any) => {
                const pubUrl = t.submission?.finalPublishedUrl;
                return (
                  <tr key={t.task.rowIndex} className="hover:bg-slate-900/40 transition">
                    <td className="px-6 py-4 font-mono text-slate-500">#{t.task.rowIndex}</td>
                    <td className="px-6 py-4 font-medium text-white max-w-xs truncate">{t.task.keyword}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {t.task.contentType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 max-w-xs truncate">{t.generation?.aiResponse.title || 'N/A'}</td>
                    <td className="px-6 py-4 font-semibold text-purple-400">{t.generation?.providerUsed || 'N/A'}</td>
                    <td className="px-6 py-4">
                      {t.status === 'PUBLISHED' && (
                        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center space-x-1 w-max">
                          <CheckCircle className="w-3 h-3" />
                          <span>PUBLISHED</span>
                        </span>
                      )}
                      {t.status === 'REQUIRES_MANUAL_ACTION' && (
                        <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold flex items-center space-x-1 w-max">
                          <ShieldAlert className="w-3 h-3" />
                          <span>HUMAN ACTION</span>
                        </span>
                      )}
                      {t.status === 'PENDING_MODERATION' && (
                        <span className="px-2 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold flex items-center space-x-1 w-max">
                          <Clock className="w-3 h-3" />
                          <span>MODERATION</span>
                        </span>
                      )}
                      {(t.status === 'FAILED' || t.status === 'VERIFICATION_FAILED') && (
                        <span className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold flex items-center space-x-1 w-max">
                          <XCircle className="w-3 h-3" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-indigo-400">
                      {pubUrl ? (
                        <a
                          href={pubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center space-x-1 max-w-xs truncate"
                        >
                          <span>{pubUrl}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-600 font-sans italic">Not published</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
