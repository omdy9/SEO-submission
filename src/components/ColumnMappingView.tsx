import React, { useState, useEffect } from 'react';
import { TableProperties, CheckCircle2, ArrowRight, AlertTriangle, RefreshCw, ChevronDown, Link2, Globe, Type, FileText, Calendar } from 'lucide-react';
import { safeFetchJson } from '../services/api';

interface ColumnMappingViewProps {
  job: any;
  setJob: (job: any) => void;
  setActiveTab: (tab: string) => void;
}

interface MappingState {
  keyword: number;
  contentType: number;
  targetSite: number;
  keywordWebsite: number;
  date: number;
  finalLink: number;
}

const FIELD_CONFIG = [
  {
    key: 'keyword',
    label: 'Keyword',
    description: 'The target SEO keyword for content',
    icon: Type,
    color: 'indigo',
    required: true,
  },
  {
    key: 'contentType',
    label: 'Content Type / Submission',
    description: 'Bookmarking, Classifieds, Blogs, or Articles',
    icon: FileText,
    color: 'purple',
    required: true,
  },
  {
    key: 'targetSite',
    label: 'Submission Link / Target URL',
    description: 'Website URL where content will be submitted',
    icon: Globe,
    color: 'pink',
    required: true,
  },
  {
    key: 'keywordWebsite',
    label: 'Keyword Website',
    description: 'URL to hyperlink the keyword to in content',
    icon: Link2,
    color: 'emerald',
    required: false,
  },
  {
    key: 'date',
    label: 'Date',
    description: 'Submission date (optional)',
    icon: Calendar,
    color: 'slate',
    required: false,
  },
  {
    key: 'finalLink',
    label: 'Final Link',
    description: 'Column for final published URL output (optional)',
    icon: CheckCircle2,
    color: 'sky',
    required: false,
  },
];

export const ColumnMappingView: React.FC<ColumnMappingViewProps> = ({ job, setJob, setActiveTab }) => {
  const [mapping, setMapping] = useState<MappingState>({
    keyword: 0,
    contentType: 0,
    targetSite: 0,
    keywordWebsite: 0,
    date: 0,
    finalLink: 0,
  });
  const [isRemapping, setIsRemapping] = useState(false);
  const [remapError, setRemapError] = useState<string | null>(null);
  const [hasManualChanges, setHasManualChanges] = useState(false);

  // Initialize from job's autoMapping
  useEffect(() => {
    if (job?.columnMapping) {
      setMapping({
        keyword: job.columnMapping.keyword || 0,
        contentType: job.columnMapping.contentType || 0,
        targetSite: job.columnMapping.targetSite || 0,
        keywordWebsite: job.columnMapping.keywordWebsite || 0,
        date: job.columnMapping.date || 0,
        finalLink: job.columnMapping.finalLink || 0,
      });
    }
  }, [job?.id]);

  if (!job) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">Please upload an Excel file first.</p>
      </div>
    );
  }

  const headers: string[] = job.excelHeaders || [];

  const handleMappingChange = (field: string, value: number) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
    setHasManualChanges(true);
    setRemapError(null);
  };

  const handleApplyMapping = async () => {
    if (!mapping.keyword || !mapping.contentType || !mapping.targetSite) {
      setRemapError('Keyword, Content Type, and Submission Link are required fields.');
      return;
    }

    setIsRemapping(true);
    setRemapError(null);

    try {
      const data = await safeFetchJson(`/api/jobs/${job.id}/remap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapping: {
            keyword: mapping.keyword,
            contentType: mapping.contentType,
            targetSite: mapping.targetSite,
            keywordWebsite: mapping.keywordWebsite,
            date: mapping.date || undefined,
            finalLink: mapping.finalLink || undefined,
          },
        }),
      });

      setJob(data.job);
      setHasManualChanges(false);
    } catch (err: any) {
      setRemapError(err.message);
    } finally {
      setIsRemapping(false);
    }
  };

  // Check for mapping issues
  const mappingIssues: string[] = [];
  if (job.tasks?.length > 0) {
    const first = job.tasks[0]?.task;
    if (first) {
      if (!first.keyword) mappingIssues.push('Keyword column appears empty');
      if (first.contentType === 'Articles' && first.targetSite && !first.targetSite.startsWith('http'))
        mappingIssues.push('Content Type may be mapped to wrong column (showing URLs instead of types)');
      if (first.targetSite && !first.targetSite.startsWith('http'))
        mappingIssues.push('Submission Link does not contain a URL — likely mapped to wrong column');
    }
  }

  const getColorClasses = (color: string) => ({
    label: `text-${color}-400`,
    bg: `bg-${color}-500/10`,
    border: `border-${color}-500/20`,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold font-display text-white">Step 2: Column Mapping</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Map your Excel columns to the required fields. Auto-detection is applied first — use the dropdowns to manually override any incorrect mappings.
        </p>
      </div>

      {/* Mapping Issues Warning */}
      {mappingIssues.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-300 text-sm mb-1">Auto-detection may be incorrect</h3>
            <ul className="list-disc list-inside text-xs text-amber-300/80 space-y-1">
              {mappingIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
            <p className="text-xs text-amber-300/60 mt-2">Use the dropdowns below to fix the mapping, then click "Apply Mapping".</p>
          </div>
        </div>
      )}

      {/* Detected Excel Headers */}
      {headers.length > 0 && (
        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Detected Excel Columns:</h3>
          <div className="flex flex-wrap gap-2">
            {headers.map((h, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300"
              >
                <span className="text-indigo-400 font-bold mr-1.5">Col {i + 1}:</span>
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manual Mapping Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FIELD_CONFIG.map((field) => {
          const colors = getColorClasses(field.color);
          const Icon = field.icon;
          const currentValue = mapping[field.key as keyof MappingState];
          const isAutoDetected = job.columnMapping?.[field.key] === currentValue && currentValue > 0;
          const isUnmapped = currentValue === 0 && field.required;

          return (
            <div
              key={field.key}
              className={`glass-card p-5 rounded-2xl border transition-all ${
                isUnmapped
                  ? 'border-rose-500/40 bg-rose-500/5'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2 mb-3">
                <div className={`p-1.5 rounded-lg ${colors.bg}`}>
                  <Icon className={`w-4 h-4 ${colors.label}`} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>{field.label}</span>
                    {field.required && <span className="text-rose-400 text-[10px]">REQUIRED</span>}
                  </div>
                  <div className="text-[10px] text-slate-500">{field.description}</div>
                </div>
              </div>

              {/* Dropdown Selector */}
              <div className="relative">
                <select
                  value={currentValue}
                  onChange={(e) => handleMappingChange(field.key, parseInt(e.target.value, 10))}
                  className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer pr-10"
                >
                  <option value={0}>— Not Mapped —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i + 1}>
                      Col {i + 1}: {h}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              {/* Status Badge */}
              <div className="mt-2 text-xs">
                {currentValue > 0 ? (
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isAutoDetected ? 'Auto-Detected' : 'Manually Set'} → "{headers[currentValue - 1]}"</span>
                  </span>
                ) : (
                  <span className={field.required ? 'text-rose-400' : 'text-slate-500'}>
                    {field.required ? '⚠ Not mapped — required' : 'Not mapped (optional)'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Apply Mapping Button */}
      {(hasManualChanges || mappingIssues.length > 0) && (
        <div className="glass-card p-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Apply Column Mapping</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click to re-parse the Excel file with your manual column assignments.
            </p>
          </div>
          <button
            onClick={handleApplyMapping}
            disabled={isRemapping}
            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium shadow-lg transition ${
              isRemapping
                ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRemapping ? 'animate-spin' : ''}`} />
            <span>{isRemapping ? 'Re-parsing Excel...' : 'Apply Mapping & Re-parse'}</span>
          </button>
        </div>
      )}

      {remapError && (
        <div className="flex items-center space-x-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{remapError}</span>
        </div>
      )}

      {/* Task Preview Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-lg text-white flex items-center space-x-2">
            <TableProperties className="w-5 h-5 text-indigo-400" />
            <span>Parsed Task Preview ({job.tasks?.length || 0} Rows)</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-4">Row #</th>
                <th className="px-4 py-4">Keyword</th>
                <th className="px-4 py-4">Content Type</th>
                <th className="px-4 py-4">Submission Site URL</th>
                <th className="px-4 py-4">Keyword Website</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(job.tasks || []).slice(0, 20).map((t: any) => (
                <tr key={t.task.rowIndex} className="hover:bg-slate-900/40 transition">
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">#{t.task.rowIndex}</td>
                  <td className="px-4 py-3 font-medium text-white text-sm">{t.task.keyword || <span className="text-rose-400 italic text-xs">empty</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      t.task.contentType === 'Bookmarking'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : t.task.contentType === 'Articles'
                        ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                        : t.task.contentType === 'Blogs'
                        ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    }`}>
                      {t.task.contentType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-sky-400 truncate max-w-[200px]">
                    {t.task.targetSite ? (
                      <a href={t.task.targetSite} target="_blank" rel="noopener noreferrer" className="hover:text-sky-300 underline underline-offset-2">
                        {t.task.targetSite}
                      </a>
                    ) : (
                      <span className="text-rose-400 italic">empty</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-emerald-400 truncate max-w-[200px]">
                    {t.task.keywordWebsite || <span className="text-slate-600 italic">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(job.tasks?.length || 0) > 20 && (
            <div className="p-4 text-center text-xs text-slate-500 border-t border-slate-800">
              Showing first 20 of {job.tasks.length} rows
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setActiveTab('website-config')}
          className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-600/30 transition"
        >
          <span>Continue to Website Config</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
