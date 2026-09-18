import React, { useState, useEffect } from 'react';
import { Settings, Key, Sliders, Save, CheckCircle2 } from 'lucide-react';

interface SettingsViewProps {
  dryRun: boolean;
  setDryRun: (val: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ dryRun, setDryRun }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.70);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setGeminiKey(data.geminiApiKey || '');
        setGroqKey(data.groqApiKey || '');
        setSimilarityThreshold(data.similarityThreshold || 0.70);
      })
      .catch(() => null);
  }, []);

  const handleSaveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: geminiKey,
          groqApiKey: groqKey,
          dryRun,
          similarityThreshold,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold font-display text-white">System Settings & API Keys</h1>
        <p className="text-slate-400">
          Configure server-side AI provider credentials and automation parameters securely.
        </p>
      </div>

      <div className="glass-card p-8 rounded-2xl border border-slate-800 space-y-6">
        {/* AI Keys Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Key className="w-5 h-5 text-indigo-400" />
            <span>AI Provider API Credentials</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Google Gemini API Key (Primary Provider)
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Groq API Key (Fallback Provider)
              </label>
              <input
                type="password"
                placeholder="gsk_..."
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Deduplication & Similarity Threshold */}
        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Sliders className="w-5 h-5 text-purple-400" />
            <span>Uniqueness Deduplication Threshold</span>
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-slate-300">TF-IDF Similarity Cutoff Threshold</span>
              <span className="text-purple-400 font-bold">{Math.round(similarityThreshold * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.40"
              max="0.90"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <p className="text-xs text-slate-500">
              If content generated for a row has a similarity score higher than {Math.round(similarityThreshold * 100)}%, it will automatically trigger AI content regeneration up to 2 times.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          {saved && (
            <span className="text-emerald-400 text-xs font-semibold flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Settings saved successfully!</span>
            </span>
          )}
          <button
            onClick={handleSaveSettings}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-600/30 transition ml-auto"
          >
            <Save className="w-4 h-4" />
            <span>Save Configurations</span>
          </button>
        </div>
      </div>
    </div>
  );
};
