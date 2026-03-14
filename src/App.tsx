// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Settings, FolderIcon, Puzzle, Search, ChevronDown, X, Play, Trash2, LayoutTemplate } from 'lucide-react';
import { cn } from './lib/utils';
import { MiniAppManifest, PluginManifest } from './vite-env';
import { useAppStore } from './stores/appStore';
import { CommandPalette } from './components/CommandPalette';
import { FileExplorer } from './components/FileExplorer';

export default function App() {
  const { activeTab, setActiveTab, openTabs, openApp, closeTab, setCommandPaletteOpen, workspacePath, fileTree, setWorkspace } = useAppStore();
  const [sidebarWidth] = useState(260);
  const [activeSidebarMode, setActiveSidebarMode] = useState<'apps' | 'plugins' | 'explorer'>('apps');
  
  const [installedApps, setInstalledApps] = useState<MiniAppManifest[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<PluginManifest[]>([]);
  
  const iframeRefs = useRef<{ [key: string]: HTMLIFrameElement | null }>({});

  const fetchApps = async () => {
    try {
      const apps = await window.ipcRenderer.miniApp.getInstalledApps();
      setInstalledApps(apps);
    } catch (err) {
      console.error('Failed to fetch apps:', err);
    }
  };

  const fetchPlugins = async () => {
    try {
      const plugins = await window.ipcRenderer.plugins.getInstalledPlugins();
      setInstalledPlugins(plugins);
    } catch (err) {
      console.error('Failed to fetch plugins:', err);
    }
  };

  useEffect(() => {
    fetchApps();
    fetchPlugins();
  }, []);

  const handleImport = async () => {
    try {
      const result = await window.ipcRenderer.miniApp.importApp();
      if (result.success) {
        alert(result.message);
        fetchApps();
      } else if (result.message !== '用户取消') {
        alert(result.message);
      }
    } catch (err) {
      alert('App Import failed');
    }
  };

  const handleImportPlugin = async () => {
    try {
      const result = await window.ipcRenderer.plugins.importPlugin();
      if (result.success) {
        alert(result.message);
        fetchPlugins();
      } else if (result.message !== '用户取消') {
        alert(result.message);
      }
    } catch (err) {
      alert('Plugin Import failed');
    }
  };

  const handleUninstallApp = async (appId: string) => {
    if (!confirm(`Are you sure you want to uninstall app: ${appId}?`)) return;
    try {
      const result = await window.ipcRenderer.miniApp.uninstallApp(appId);
      if (result.success) {
        fetchApps();
        closeTab(appId);
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert('Uninstall failed');
    }
  };

  const handleUninstallPlugin = async (pluginId: string) => {
    if (!confirm(`Are you sure you want to uninstall plugin: ${pluginId}?`)) return;
    try {
      const result = await window.ipcRenderer.plugins.uninstallPlugin(pluginId);
      if (result.success) {
        fetchPlugins();
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert('Uninstall failed');
    }
  };

  const handleOpenFolder = async () => {
    try {
      const result = await window.ipcRenderer.invoke('explorer:open-folder');
      if (result) {
        setWorkspace(result.path, result.tree);
        setActiveSidebarMode('explorer');
      }
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  const handleIframeLoad = async (appId: string) => {
    console.log(`Iframe loaded for ${appId}`);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#1e1e1e] text-[#cccccc] select-none">
      {/* Menu Bar / Title Bar */}
      <div className="h-9 flex items-center bg-[#323233] px-3 text-sm border-b border-[#2b2b2b] drag">
        <div className="flex gap-4 no-drag relative group/file">
          <span className="hover:bg-[#454545] px-2 py-1 rounded cursor-pointer peer">File</span>
          {/* Simple Dropdown simulation */}
          <div className="absolute top-8 left-0 w-64 bg-[#252526] border border-[#454545] shadow-lg hidden peer-hover:block hover:block z-[100] py-1 text-xs">
            <div className="px-4 py-1.5 hover:bg-[#007acc] hover:text-white cursor-pointer flex justify-between">
              <span>New File</span>
              <span className="text-[#8e8e8e]">Ctrl+N</span>
            </div>
            <div className="px-4 py-1.5 hover:bg-[#007acc] hover:text-white cursor-pointer flex justify-between" onClick={handleOpenFolder}>
              <span>Open Folder...</span>
              <span className="text-[#8e8e8e]">Ctrl+K Ctrl+O</span>
            </div>
            <div className="border-t border-[#454545] my-1"></div>
            <div className="px-4 py-1.5 hover:bg-[#007acc] hover:text-white cursor-pointer" onClick={handleImport}>
              <span>Import Mini App...</span>
            </div>
          </div>

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
          <div 
            className={cn("p-1 rounded cursor-pointer relative", activeSidebarMode === 'explorer' ? "text-white" : "text-[#8e8e8e] hover:text-white")}
            onClick={() => setActiveSidebarMode('explorer')}
          >
            {activeSidebarMode === 'explorer' && <div className="absolute left-[-16px] top-0 bottom-0 w-[2px] bg-blue-500" />}
            <LayoutTemplate className="w-7 h-7 p-1" />
          </div>

          <div 
            className={cn("p-1 rounded cursor-pointer relative", activeSidebarMode === 'apps' ? "text-white" : "text-[#8e8e8e] hover:text-white")}
            onClick={() => setActiveSidebarMode('apps')}
          >
            {activeSidebarMode === 'apps' && <div className="absolute left-[-16px] top-0 bottom-0 w-[2px] bg-blue-500" />}
            <FolderIcon className="w-7 h-7" />
          </div>
          
          <Search 
            className="w-7 h-7 p-1 text-[#8e8e8e] hover:text-white cursor-pointer" 
            onClick={() => setCommandPaletteOpen(true)}
          />
          
          <div 
            className={cn("p-1 rounded cursor-pointer relative", activeSidebarMode === 'plugins' ? "text-white" : "text-[#8e8e8e] hover:text-white")}
            onClick={() => setActiveSidebarMode('plugins')}
          >
            {activeSidebarMode === 'plugins' && <div className="absolute left-[-16px] top-0 bottom-0 w-[2px] bg-blue-500" />}
            <Puzzle className="w-7 h-7" />
          </div>
          
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
            {activeSidebarMode === 'apps' ? 'Mini Apps' : 'Plugins'}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {activeSidebarMode === 'explorer' && (
              <FileExplorer tree={fileTree} rootName={workspacePath} />
            )}

            {activeSidebarMode === 'apps' && (
               <>
                <div className="group flex items-center justify-between px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer">
                  <div className="flex items-center">
                    <ChevronDown className="w-4 h-4 mr-1" />
                    <span className="text-sm font-bold">INSTALLED APPS</span>
                  </div>
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
                      onClick={() => openApp(app)}
                    >
                      <Play className="w-3 h-3 mr-2" />
                      <span className="text-sm flex-1 truncate">{app.name}</span>
                      <Trash2 
                        className="w-3 h-3 text-[#8e8e8e] hover:text-red-400 opacity-0 group-hover:opacity-100" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUninstallApp(app.id);
                        }}
                      />
                    </div>
                  ))
                )}
              </>
            )}

            {activeSidebarMode === 'plugins' && (
              <>
                <div className="group flex items-center justify-between px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer">
                  <div className="flex items-center">
                    <ChevronDown className="w-4 h-4 mr-1" />
                    <span className="text-sm font-bold">INSTALLED PLUGINS</span>
                  </div>
                </div>
                {installedPlugins.length === 0 ? (
                  <div className="px-6 py-2 text-xs text-[#8e8e8e]">No plugins installed.</div>
                ) : (
                  installedPlugins.map(plugin => (
                    <div 
                      key={plugin.id} 
                      className="flex flex-col px-6 py-2 cursor-default group hover:bg-[#2a2d2e]"
                    >
                      <div className="flex items-center">
                        <Puzzle className="w-3 h-3 mr-2 text-[#007acc]" />
                        <span className="text-sm flex-1 truncate text-white">{plugin.name}</span>
                        <Trash2 
                          className="w-3 h-3 text-[#8e8e8e] hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUninstallPlugin(plugin.id);
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-[#8e8e8e] ml-5 mt-1 truncate">
                        Target: {Array.isArray(plugin.targetApps) ? plugin.targetApps.join(', ') : plugin.targetApps}
                      </span>
                    </div>
                  ))
                )}
              </>
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
            
            {openTabs.map(tab => (
              <div
                key={`tab-${tab.tabId}`}
                className={cn(
                  "flex items-center px-3 border-r border-[#1e1e1e] cursor-pointer min-w-[120px] max-w-[200px]",
                  activeTab === tab.tabId ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-[#969696]"
                )}
                onClick={() => setActiveTab(tab.tabId)}
              >
                <div className="w-4 h-4 mr-2 flex items-center justify-center">
                  <Play className="w-3 h-3 text-[#007acc]" />
                </div>
                <span className="text-xs truncate flex-1">{tab.title || tab.app.name}</span>
                <X
                  className="w-3 h-3 ml-2 hover:bg-[#454545] rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.tabId);
                  }}
                />
              </div>
            ))}
          </div>

          {/* View Content */}
          <div className="flex-1 overflow-auto relative">
            <div className={cn("absolute inset-0", activeTab === 'welcome' ? 'block' : 'hidden')}>
              <div className="p-8">
                <h1 className="text-4xl font-light mb-4 text-[#ffffff]">ToolsBox</h1>
                <p className="text-[#8e8e8e] text-lg mb-8">A VS Code-like desktop container for Mini Apps & Plugins.</p>
                
                <div className="grid grid-cols-2 gap-8 max-w-4xl">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold border-b border-[#2b2b2b] pb-2 text-[#ffffff]">Start</h3>
                    <div className="space-y-2">
                      <div className="text-sm text-[#3794ff] hover:underline cursor-pointer flex items-center" onClick={handleImport}>
                        Import Mini App
                      </div>
                      <div className="text-sm text-[#3794ff] hover:underline cursor-pointer flex items-center" onClick={handleImportPlugin}>
                        Import Plugin
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold border-b border-[#2b2b2b] pb-2 text-[#ffffff]">Recent</h3>
                    <div className="text-sm text-[#8e8e8e]">No recently used apps.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Render all open tabs, hidden if not active */}
            {openTabs.map(tab => {
              const urlObj = new URL(`miniapp://${tab.app.id}/${tab.app.entry.replace(/^\/+/, '')}`);
              urlObj.searchParams.set('tabId', tab.tabId);
              if (tab.payload) {
                urlObj.searchParams.set('payload', encodeURIComponent(JSON.stringify(tab.payload)));
              }
              const srcUrl = urlObj.toString();

              return (
                <div
                  key={tab.tabId}
                  className={cn("h-full w-full bg-white relative", activeTab === tab.tabId ? 'block' : 'hidden')}
                >
                  <iframe
                    ref={el => iframeRefs.current[tab.tabId] = el}
                    src={srcUrl}
                    title={tab.title || tab.app.name}
                    onLoad={() => handleIframeLoad(tab.tabId)}
                    className="w-full h-full border-none absolute inset-0"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                  />
                </div>
              );
            })}
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
      <CommandPalette apps={installedApps} />
    </div>
  );
}

