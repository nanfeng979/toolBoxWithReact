import React, { useState, useEffect } from 'react';
import { 
  FolderIcon, 
  Settings, 
  Puzzle, 
  Search, 
  ChevronRight, 
  ChevronDown,
  X,
  Play,
  Trash2
} from 'lucide-react';
import { cn } from './lib/utils';
import { MiniAppManifest } from './vite-env';

export default function App() {
  const [activeTab, setActiveTab] = useState('welcome');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [installedApps, setInstalledApps] = useState<MiniAppManifest[]>([]);

  const fetchApps = async () => {
    try {
      // @ts-ignore - using the bridged api
      const apps = await window.ipcRenderer.miniApp.getInstalledApps();
      setInstalledApps(apps);
    } catch (err) {
      console.error('Failed to fetch apps:', err);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleImport = async () => {
    try {
      // @ts-ignore
      const result = await window.ipcRenderer.miniApp.importApp();
      if (result.success) {
        alert(result.message);
        fetchApps(); // refresh list
      } else if (result.message !== '用户取消') {
        alert(result.message);
      }
    } catch (err) {
      alert('Import failed');
    }
  };

  const handleUninstall = async (appId: string) => {
    if (!confirm(`Are you sure you want to uninstall ${appId}?`)) return;
    try {
      // @ts-ignore
      const result = await window.ipcRenderer.miniApp.uninstallApp(appId);
      if (result.success) {
        fetchApps();
        if (activeTab === appId) setActiveTab('welcome');
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert('Uninstall failed');
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#1e1e1e] text-[#cccccc] select-none">
      {/* Menu Bar / Title Bar */}
      <div className="h-9 flex items-center bg-[#323233] px-3 text-sm border-b border-[#2b2b2b] drag">
        <div className="flex gap-4 no-drag">
          <span className="hover:bg-[#454545] px-2 py-1 rounded cursor-default">File</span>
          <span className="hover:bg-[#454545] px-2 py-1 rounded cursor-default">Edit</span>
          <span className="hover:bg-[#454545] px-2 py-1 rounded cursor-default">Selection</span>
          <span className="hover:bg-[#454545] px-2 py-1 rounded cursor-default">View</span>
          <span className="hover:bg-[#454545] px-2 py-1 rounded cursor-default">Go</span>
          <span className="hover:bg-[#454545] px-2 py-1 rounded cursor-default">Run</span>
        </div>
        <div className="flex-1 text-center text-xs text-[#8e8e8e] drag">ToolsBox - VS Code Mini App Client</div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        <div className="w-12 bg-[#333333] flex flex-col items-center py-4 gap-4 border-r border-[#2b2b2b]">
          <FolderIcon className="w-7 h-7 p-1 text-[#8e8e8e] hover:text-white cursor-pointer" />
          <Search className="w-7 h-7 p-1 text-[#8e8e8e] hover:text-white cursor-pointer" />
          <Puzzle className="w-7 h-7 p-1 text-[#8e8e8e] hover:text-white cursor-pointer" />
          <div className="mt-auto pb-4 flex flex-col gap-4 items-center">
            <Settings className="w-7 h-7 p-1 text-[#8e8e8e] hover:text-white cursor-pointer" />
          </div>
        </div>

        {/* Side Bar */}
        <div 
          style={{ width: sidebarWidth }}
          className="bg-[#252526] flex flex-col border-r border-[#2b2b2b]"
        >
          <div className="h-9 flex items-center px-4 text-xs font-bold uppercase tracking-wider text-[#bbbbbb]">
            Mini Apps
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="group flex items-center px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer">
              <ChevronDown className="w-4 h-4 mr-1" />
              <span className="text-sm font-bold">INSTALLED</span>
            </div>
            {installedApps.length === 0 ? (
              <div className="px-6 py-2 text-xs text-[#8e8e8e]">No apps installed.</div>
            ) : (
              installedApps.map(app => (
                <div 
                  key={app.id} 
                  className={cn(
                    "flex items-center px-6 py-1 cursor-pointer group",
                    activeTab === app.id ? "bg-[#37373d]" : "hover:bg-[#2a2d2e]"
                  )}
                  onClick={() => setActiveTab(app.id)}
                >
                  <Play className="w-3 h-3 mr-2" />
                  <span className="text-sm flex-1 truncate">{app.name}</span>
                  <Trash2 
                    className="w-3 h-3 text-[#8e8e8e] hover:text-red-400 opacity-0 group-hover:opacity-100" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUninstall(app.id);
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          {/* Tabs */}
          <div className="h-9 flex bg-[#252526] overflow-x-auto">
            <div 
              className={cn(
                "flex items-center px-3 border-r border-[#1e1e1e] cursor-pointer min-w-[120px] max-w-[200px]",
                activeTab === 'welcome' ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-[#969696]"
              )}
              onClick={() => setActiveTab('welcome')}
            >
              <span className="text-xs truncate flex-1">Welcome</span>
            </div>
            
            {installedApps.filter(app => activeTab === app.id).map(app => (
              <div 
                key={`tab-${app.id}`}
                className="flex items-center px-3 border-r border-[#1e1e1e] cursor-pointer min-w-[120px] max-w-[200px] bg-[#1e1e1e] text-white"
              >
                <span className="text-xs truncate flex-1">{app.name}</span>
                <X 
                  className="w-3 h-3 ml-2 hover:bg-[#454545] rounded" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('welcome');
                  }}
                />
              </div>
            ))}
          </div>

          {/* View Content */}
          <div className="flex-1 overflow-auto relative">
            {activeTab === 'welcome' ? (
              <div className="p-8">
                <h1 className="text-4xl font-light mb-4 text-[#ffffff]">ToolsBox</h1>
                <p className="text-[#8e8e8e] text-lg mb-8">A VS Code-like desktop container for Mini Apps & Plugins.</p>
                
                <div className="grid grid-cols-2 gap-8 max-w-4xl">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold border-b border-[#2b2b2b] pb-2 text-[#ffffff]">Start</h3>
                    <div className="space-y-2">
                      <div className="text-sm text-[#3794ff] hover:underline cursor-pointer" onClick={handleImport}>
                        Import from Folder
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold border-b border-[#2b2b2b] pb-2 text-[#ffffff]">Recent</h3>
                    <div className="text-sm text-[#8e8e8e]">No recently used apps.</div>
                  </div>
                </div>
              </div>
            ) : (
              (() => {
                const app = installedApps.find(a => a.id === activeTab);
                if (!app) return <div className="p-8 text-red-500">App missing or uninstalled.</div>;
                
                // Construct the miniapp protocol URL based on the manifest's entry point
                // Usually entry is like "index.html"
                const srcUrl = `miniapp://${app.id}/${app.entry.replace(/^\/+/, '')}`;

                return (
                  <div className="h-full w-full bg-white relative">
                    <iframe 
                      src={srcUrl}
                      title={app.name}
                      className="w-full h-full border-none absolute inset-0"
                      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                    />
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-[#007acc] flex items-center px-3 text-[11px] text-white">
        <div className="flex gap-4">
          <span className="hover:bg-[#1f8ad2] px-1 cursor-default">Ready</span>
        </div>
        <div className="flex-1"></div>
        <div className="flex gap-4">
          <span className="hover:bg-[#1f8ad2] px-1 cursor-default">UTF-8</span>
          <span className="hover:bg-[#1f8ad2] px-1 cursor-default">Spaces: 2</span>
          <span className="hover:bg-[#1f8ad2] px-1 cursor-default">ToolsBox v0.1.0</span>
        </div>
      </div>
    </div>
  );
}

