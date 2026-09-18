import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react';

interface UploadViewProps {
  onUploadSuccess: (jobData: any) => void;
  setActiveTab: (tab: string) => void;
}

export const UploadView: React.FC<UploadViewProps> = ({ onUploadSuccess, setActiveTab }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (selected.name.endsWith('.xlsx') || selected.name.endsWith('.xls')) {
        setFile(selected);
        setError(null);
      } else {
        setError('Please upload a valid Excel file (.xlsx or .xls)');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse Excel file');
      }

      onUploadSuccess(data.job);
      setActiveTab('mapping');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold font-display text-white">Step 1: Upload Task Excel File</h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Upload an Excel spreadsheet containing columns for <strong>Keyword</strong>, <strong>Content Type</strong>, and <strong>Submission Site</strong>.
        </p>
      </div>

      <div className="glass-card p-10 rounded-2xl border border-slate-800 space-y-6">
        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
            file
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/50'
          }`}
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="excel-file-input"
          />

          <label htmlFor="excel-file-input" className="cursor-pointer space-y-4 inline-block">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
              {file ? <FileSpreadsheet className="w-8 h-8 text-emerald-400" /> : <Upload className="w-8 h-8" />}
            </div>

            {file ? (
              <div>
                <div className="flex items-center justify-center space-x-2 text-emerald-400 font-semibold text-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span>{file.name}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB • Ready for processing</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium text-white">Drag & drop your Excel file here</p>
                <p className="text-sm text-slate-400 mt-1">or click to browse your computer (.xlsx)</p>
              </div>
            )}
          </label>
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleUploadSubmit}
            disabled={!file || loading}
            className={`inline-flex items-center space-x-2 px-6 py-3 rounded-xl font-medium shadow-lg transition-all ${
              file && !loading
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>{loading ? 'Processing Excel File...' : 'Continue to Column Mapping'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
