import React, { useState, useEffect, useRef } from 'react';
import {
  Zap, Plus, Trash2, Copy, Download, RefreshCw, CheckCircle2,
  AlertTriangle, Clock, Loader2, Link2, Globe, ClipboardPaste,
  ChevronDown, ChevronUp, X, ExternalLink
} from 'lucide-react';
import { safeFetchJson } from '../services/api';

interface QuickRow {
  id: string;
  keyword: string;
  link: string;
}

interface SiteResult {
  siteName: string;
  siteUrl: string;
  status: 'pending' | 'generating' | 'submitting' | 'published' | 'failed' | 'moderated';
  finalPublishedUrl?: string;
  title?: string;
  error?: string;
}

interface RowResult {
  rowId: string;
  keyword: string;
  link: string;
  sites: SiteResult[];
  expanded: boolean;
}

const BOOKMARKING_SITES = [
  { name: 'Tumblr', url: 'https://www.tumblr.com' },
  { name: 'Raindrop', url: 'https://app.raindrop.io' },
  { name: 'Instapaper', url: 'https://www.instapaper.com' },
  { name: 'Mix', url: 'https://mix.com' },
  { name: 'Scoop.it', url: 'https://www.scoop.it' },
  { name: 'JustPaste.it', url: 'https://justpaste.it' },
  { name: 'Padlet', url: 'https://padlet.com' },
  { name: 'Pearltrees', url: 'https://www.pearltrees.com' },
  { name: 'Flipboard', url: 'https://flipboard.com' },
  { name: 'Diigo', url: 'https://www.diigo.com' },
  { name: 'Linktree', url: 'https://linktr.ee' },
];

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

/** Returns the N sites assigned to keyword at index ri, cycling through the pool */
function assignSitesForKeyword(pool: string[], ri: number, n: number): string[] {
  const totalPool = pool.length;
  if (totalPool === 0 || n === 0) return [];
  const assigned: string[] = [];
  for (let i = 0; i < n; i++) {
    assigned.push(pool[(ri * n + i) % totalPool]);
  }
  return assigned;
}

export const QuickModeView: React.FC = () => {
  const [rows, setRows] = useState<QuickRow[]>([
    { id: genId(), keyword: '', link: '' },
  ]);
  const [results, setResults] = useState<RowResult[]>([]);
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [sitesPerKeyword, setSitesPerKeyword] = useState(3);
  const [selectedSites, setSelectedSites] = useState<string[]>(
    BOOKMARKING_SITES.map((s) => s.url)
  );
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(false);

  const handleAddRow = () =>
    setRows((prev) => [...prev, { id: genId(), keyword: '', link: '' }]);

  const handleRemoveRow = (id: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const handleRowChange = (id: string, field: 'keyword' | 'link', value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const handleBulkPaste = () => {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const newRows: QuickRow[] = lines.map((line) => {
      const [keyword = '', link = ''] = line.split(',').map((s) => s.trim());
      return { id: genId(), keyword, link };
    });
    if (newRows.length > 0) {
      setRows(newRows);
      setBulkText('');
      setShowBulkPaste(false);
    }
  };

  const toggleSite = (url: string) => {
    setSelectedSites((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const handleRun = async () => {
    const validRows = rows.filter((r) => r.keyword.trim() && r.link.trim());
    if (validRows.length === 0) return;

    abortRef.current = false;
    setRunning(true);

    // Round-robin: each keyword gets a different slice of `sitesPerKeyword` sites
    const initialResults: RowResult[] = validRows.map((row, ri) => {
      const assignedUrls = assignSitesForKeyword(selectedSites, ri, sitesPerKeyword);
      return {
        rowId: row.id,
        keyword: row.keyword,
        link: row.link,
        expanded: true,
        sites: assignedUrls.map((siteUrl) => {
          const site = BOOKMARKING_SITES.find((s) => s.url === siteUrl);
          return {
            siteName: site?.name || siteUrl,
            siteUrl,
            status: 'pending' as const,
          };
        }),
      };
    });
    setResults(initialResults);

    for (let ri = 0; ri < validRows.length; ri++) {
      if (abortRef.current) break;
      const row = validRows[ri];
      const assignedUrls = assignSitesForKeyword(selectedSites, ri, sitesPerKeyword);

      for (let si = 0; si < assignedUrls.length; si++) {
        if (abortRef.current) break;
        const siteUrl = assignedUrls[si];

        // Mark as generating
        setResults((prev) =>
          prev.map((r) =>
            r.rowId === row.id
              ? {
                  ...r,
                  sites: r.sites.map((s) =>
                    s.siteUrl === siteUrl ? { ...s, status: 'generating' } : s
                  ),
                }
              : r
          )
        );

        try {
          const data = await safeFetchJson('/api/quick-run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword: row.keyword,
              link: row.link,
              targetSite: siteUrl,
              dryRun,
            }),
          });

          const finalStatus =
            data.status === 'PUBLISHED'
              ? 'published'
              : data.status === 'PENDING_MODERATION'
              ? 'moderated'
              : 'failed';

          setResults((prev) =>
            prev.map((r) =>
              r.rowId === row.id
                ? {
                    ...r,
                    sites: r.sites.map((s) =>
                      s.siteUrl === siteUrl
                        ? {
                            ...s,
                            status: finalStatus,
                            finalPublishedUrl: data.finalPublishedUrl,
                            title: data.title,
                            error: data.error,
                          }
                        : s
                    ),
                  }
                : r
            )
          );
        } catch (err: any) {
          setResults((prev) =>
            prev.map((r) =>
              r.rowId === row.id
                ? {
                    ...r,
                    sites: r.sites.map((s) =>
                      s.siteUrl === siteUrl
                        ? { ...s, status: 'failed', error: err.message }
                        : s
                    ),
                  }
                : r
            )
          );
        }
      }
    }

    setRunning(false);
  };

  const handleStop = () => {
    abortRef.current = true;
    setRunning(false);
  };

  const handleCopyAllLinks = () => {
    const allLinks: string[] = [];
    results.forEach((r) => {
      r.sites.forEach((s) => {
        if (s.finalPublishedUrl) {
          allLinks.push(`${r.keyword} | ${s.siteName} | ${s.finalPublishedUrl}`);
        }
      });
    });
    navigator.clipboard.writeText(allLinks.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    const rows: string[] = ['Keyword,Website Link,Platform,Final Published URL,Status'];
    results.forEach((r) => {
      r.sites.forEach((s) => {
        rows.push(
          `"${r.keyword}","${r.link}","${s.siteName}","${s.finalPublishedUrl || ''}","${s.status}"`
        );
      });
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quick_mode_results_${Date.now()}.csv`;
    a.click();
  };

  const toggleExpand = (rowId: string) => {
    setResults((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, expanded: !r.expanded } : r))
    );
  };

  const totalPublished = results.reduce(
    (acc, r) => acc + r.sites.filter((s) => s.status === 'published').length,
    0
  );
  const totalSubmissions = results.reduce((acc, r) => acc + r.sites.length, 0);

  const statusColors: Record<string, string> = {
    pending: 'text-slate-500 bg-slate-800/60 border-slate-700',
    generating: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
    submitting: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
    published: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    moderated: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    failed: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  };

  const statusLabel: Record<string, string> = {
    pending: 'Pending',
    generating: 'Generating…',
    submitting: 'Submitting…',
    published: 'Published ✓',
    moderated: 'In Moderation',
    failed: 'Failed',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-semibold mb-2">
          <Zap className="w-3.5 h-3.5" />
          <span>Quick Mode — No Excel Required</span>
        </div>
        <h1 className="text-3xl font-extrabold font-display text-white">
          Keyword + Link → <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Auto-Post Everywhere</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Enter keywords and your website link. AI generates unique bookmarking content and automatically posts to all configured platforms, giving you final published URLs instantly.
        </p>
      </div>

      {/* Settings Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Mode toggle */}
          <div className="flex items-center space-x-3 text-sm">
            <span className="text-slate-400 font-medium">Mode:</span>
            <button
              onClick={() => setDryRun(!dryRun)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                dryRun
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {dryRun ? '🧪 Dry Run ON (simulated)' : '🚀 Live Mode'}
            </button>
          </div>

          {/* Sites per keyword */}
          <div className="flex items-center space-x-3">
            <span className="text-slate-400 text-xs font-medium whitespace-nowrap">Sites per keyword:</span>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setSitesPerKeyword(n)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold border transition ${
                    sitesPerKeyword === n
                      ? 'bg-yellow-500 border-yellow-400 text-black'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="text-slate-500 text-xs">per keyword (round-robin across pool)</span>
          </div>
        </div>

        {/* Site pool toggle */}
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300">Site Pool ({selectedSites.length} active)</span>
            <span className="text-slate-600 text-xs">— sites cycle across keywords in order</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BOOKMARKING_SITES.map((site, idx) => {
              const active = selectedSites.includes(site.url);
              const poolIdx = selectedSites.indexOf(site.url);
              return (
                <button
                  key={site.url}
                  onClick={() => toggleSite(site.url)}
                  title={active ? `Pool position #${poolIdx + 1}` : 'Click to add to pool'}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition flex items-center space-x-1 ${
                    active
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                  }`}
                >
                  {active && (
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-900/50 rounded px-1">
                      #{poolIdx + 1}
                    </span>
                  )}
                  <span>{site.name}</span>
                </button>
              );
            })}
          </div>

          {/* Preview distribution */}
          {rows.some((r) => r.keyword.trim()) && selectedSites.length > 0 && (
            <div className="mt-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Preview Distribution</p>
              {rows.filter((r) => r.keyword.trim()).slice(0, 6).map((row, ri) => {
                const assigned = assignSitesForKeyword(selectedSites, ri, sitesPerKeyword);
                return (
                  <div key={row.id} className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-medium truncate max-w-[140px]">{row.keyword || `Keyword ${ri+1}`}</span>
                    <span className="text-slate-600">→</span>
                    <div className="flex flex-wrap gap-1">
                      {assigned.map((url) => {
                        const s = BOOKMARKING_SITES.find((b) => b.url === url);
                        return (
                          <span key={url} className="px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-medium">
                            {s?.name || url}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {rows.filter((r) => r.keyword.trim()).length > 6 && (
                <p className="text-[10px] text-slate-600">+ {rows.filter((r) => r.keyword.trim()).length - 6} more keywords…</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center space-x-2">
            <Link2 className="w-4 h-4 text-yellow-400" />
            <span>Keywords & Links</span>
          </h3>
          <button
            onClick={() => setShowBulkPaste(!showBulkPaste)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Bulk Paste</span>
          </button>
        </div>

        {showBulkPaste && (
          <div className="p-5 border-b border-slate-800 bg-slate-950/50">
            <p className="text-xs text-slate-400 mb-2">
              Paste one row per line in format: <code className="text-indigo-300">keyword, https://yoursite.com</code>
            </p>
            <textarea
              rows={5}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'DGFT Consultant in Mumbai, https://eximadvisory.com\nDGFT Consultant in Pune, https://eximadvisory.com'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
            <div className="flex space-x-2 mt-2">
              <button
                onClick={handleBulkPaste}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition"
              >
                Import Rows
              </button>
              <button
                onClick={() => setShowBulkPaste(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-800/60">
          {rows.map((row, idx) => (
            <div key={row.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-xs text-slate-600 font-mono w-6 flex-shrink-0">#{idx + 1}</span>
              <input
                type="text"
                value={row.keyword}
                onChange={(e) => handleRowChange(row.id, 'keyword', e.target.value)}
                placeholder="e.g. DGFT Consultant in Mumbai"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
              <input
                type="url"
                value={row.link}
                onChange={(e) => handleRowChange(row.id, 'link', e.target.value)}
                placeholder="https://yourwebsite.com"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-mono"
              />
              <button
                onClick={() => handleRemoveRow(row.id)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleAddRow}
            className="flex items-center space-x-2 text-sm text-indigo-400 hover:text-indigo-300 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-slate-400">
          {rows.filter((r) => r.keyword && r.link).length} keyword(s) × {sitesPerKeyword} site(s) each ={' '}
          <strong className="text-white">
            {rows.filter((r) => r.keyword && r.link).length * sitesPerKeyword}
          </strong>{' '}
          total submissions (round-robin across {selectedSites.length}-site pool)
        </div>

        <div className="flex items-center space-x-3">
          {running && (
            <button
              onClick={handleStop}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 transition"
            >
              <X className="w-4 h-4" />
              <span>Stop</span>
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={running || rows.filter((r) => r.keyword && r.link).length === 0 || selectedSites.length === 0 || sitesPerKeyword === 0}
            className={`inline-flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold shadow-xl transition ${
              running
                ? 'bg-yellow-600/40 text-yellow-200 cursor-wait'
                : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black shadow-yellow-500/30'
            }`}
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>{running ? 'Auto-Posting in Progress…' : '⚡ Generate & Auto-Post All'}</span>
          </button>
        </div>
      </div>

      {/* Live Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary Bar */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Live Results</h3>
              <p className="text-sm text-slate-400">
                <span className="text-emerald-400 font-semibold">{totalPublished}</span> of{' '}
                {totalSubmissions} submissions published
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCopyAllLinks}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy All Links'}</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Per-keyword results */}
          {results.map((result) => (
            <div key={result.rowId} className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
              {/* Keyword Header */}
              <button
                onClick={() => toggleExpand(result.rowId)}
                className="w-full p-5 flex items-center justify-between hover:bg-slate-900/40 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-sm">
                    <span className="font-bold text-white">{result.keyword}</span>
                    <span className="text-slate-500 ml-2 font-mono text-xs">{result.link}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-emerald-400 font-semibold">
                      {result.sites.filter((s) => s.status === 'published').length} published
                    </span>
                    <span className="text-slate-600 text-xs">/ {result.sites.length}</span>
                    {result.sites.some((s) => s.status === 'generating' || s.status === 'submitting') && (
                      <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin ml-1" />
                    )}
                  </div>
                </div>
                {result.expanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {result.expanded && (
                <div className="border-t border-slate-800 divide-y divide-slate-800/60">
                  {result.sites.map((site) => (
                    <div
                      key={site.siteUrl}
                      className="flex items-center gap-4 px-5 py-3"
                    >
                      <div className="w-28 flex-shrink-0 text-xs font-semibold text-slate-300">{site.siteName}</div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${statusColors[site.status]}`}
                      >
                        {statusLabel[site.status]}
                      </span>

                      {site.finalPublishedUrl ? (
                        <a
                          href={site.finalPublishedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300 font-mono truncate max-w-md transition"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span>{site.finalPublishedUrl}</span>
                        </a>
                      ) : site.error ? (
                        <span className="text-xs text-rose-400 truncate max-w-sm">{site.error}</span>
                      ) : (
                        <span className="text-xs text-slate-600 italic">—</span>
                      )}

                      {site.finalPublishedUrl && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(site.finalPublishedUrl!);
                          }}
                          className="ml-auto p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition flex-shrink-0"
                          title="Copy link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
