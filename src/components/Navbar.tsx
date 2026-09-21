import React from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  TableProperties, 
  Globe2, 
  Sparkles, 
  CheckCircle2, 
  Send, 
  ListChecks, 
  Download, 
  Settings,
  Zap
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  jobId?: string;
  dryRun: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, jobId, dryRun }) => {
  const tabs = [
    { id: 'quick-mode', label: '⚡ Quick Mode', icon: Zap, accent: true },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: '1. Upload Excel', icon: Upload },
    { id: 'mapping', label: '2. Column Mapping', icon: TableProperties },
    { id: 'website-config', label: '3. Website Config', icon: Globe2 },
    { id: 'generation', label: '4. AI Generation', icon: Sparkles },
    { id: 'review', label: '5. Review & Approval', icon: CheckCircle2 },
    { id: 'submission', label: '6. Submission Progress', icon: Send },
    { id: 'results', label: '7. Results', icon: ListChecks },
    { id: 'export', label: '8. Export', icon: Download },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-lg text-white tracking-tight">SEO Submit<span className="gradient-text">Pro</span></span>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span>Automation Engine</span>
                {dryRun && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                    TEST DRY-RUN
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Active Job Badge */}
          {jobId && (
            <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Active Job: <strong className="text-white">{jobId}</strong></span>
            </div>
          )}

        </div>

        {/* Tab Navigation Menu */}
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isAccent = (tab as any).accent;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive && isAccent
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-md shadow-yellow-500/30'
                    : isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : isAccent
                    ? 'text-yellow-400 hover:text-yellow-200 hover:bg-yellow-500/10 border border-yellow-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive && isAccent ? 'text-black' : isAccent ? 'text-yellow-400' : isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
