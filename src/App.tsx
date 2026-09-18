import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { UploadView } from './components/UploadView';
import { ColumnMappingView } from './components/ColumnMappingView';
import { WebsiteConfigView } from './components/WebsiteConfigView';
import { ContentGenerationView } from './components/ContentGenerationView';
import { ReviewView } from './components/ReviewView';
import { SubmissionProgressView } from './components/SubmissionProgressView';
import { ResultsView } from './components/ResultsView';
import { ExportView } from './components/ExportView';
import { SettingsView } from './components/SettingsView';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [job, setJob] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [dryRun, setDryRun] = useState(false);

  // Connect to SSE stream whenever job changes
  useEffect(() => {
    if (!job?.id) return;

    const eventSource = new EventSource(`/api/jobs/${job.id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'INIT') {
          setJob(data.job);
          setLogs(data.job.logs || []);
        } else if (data.type === 'TASK_UPDATED') {
          setJob((prev: any) => {
            if (!prev) return prev;
            const updatedTasks = prev.tasks.map((t: any) =>
              t.task.rowIndex === data.rowIndex ? data.task : t
            );
            return { ...prev, tasks: updatedTasks };
          });
        } else if (data.type === 'STATS_UPDATED') {
          setJob((prev: any) => (prev ? { ...prev, stats: data.stats } : prev));
        } else if (data.type === 'JOB_STATUS_CHANGED') {
          setJob((prev: any) => (prev ? { ...prev, status: data.status } : prev));
        } else if (data.type === 'JOB_REMAPPED') {
          setJob((prev: any) => prev ? { ...prev, tasks: data.tasks, columnMapping: data.mapping } : prev);
        } else if (data.type === 'LOG') {
          setLogs((prev) => [...prev, data.log]);
        }
      } catch (err) {
        console.error(err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [job?.id]);

  const handleUploadSuccess = (jobData: any) => {
    setJob(jobData);
    setLogs(jobData.logs || []);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        jobId={job?.id}
        dryRun={dryRun}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <DashboardView job={job} setActiveTab={setActiveTab} />}
        {activeTab === 'upload' && <UploadView onUploadSuccess={handleUploadSuccess} setActiveTab={setActiveTab} />}
        {activeTab === 'mapping' && <ColumnMappingView job={job} setJob={setJob} setActiveTab={setActiveTab} />}
        {activeTab === 'website-config' && <WebsiteConfigView job={job} setActiveTab={setActiveTab} />}
        {activeTab === 'generation' && <ContentGenerationView job={job} setActiveTab={setActiveTab} />}
        {activeTab === 'review' && (
          <ReviewView job={job} setActiveTab={setActiveTab} dryRun={dryRun} setDryRun={setDryRun} />
        )}
        {activeTab === 'submission' && (
          <SubmissionProgressView job={job} setActiveTab={setActiveTab} logs={logs} />
        )}
        {activeTab === 'results' && <ResultsView job={job} setActiveTab={setActiveTab} />}
        {activeTab === 'export' && <ExportView job={job} setActiveTab={setActiveTab} />}
        {activeTab === 'settings' && <SettingsView dryRun={dryRun} setDryRun={setDryRun} />}
      </main>
    </div>
  );
}

export default App;
