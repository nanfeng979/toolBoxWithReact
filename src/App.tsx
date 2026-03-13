import React, { useState } from 'react';
import { 
  FolderIcon, 
  Settings, 
  Puzzle, 
  Search, 
  ChevronRight, 
  ChevronDown,
  X,
  Play
} from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState('welcome');
  const [sidebarWidth, setSidebarWidth] = useState(260);

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
        <div className="flex-1 text-center text-xs text-[#8e8e8e]">ToolsBox - VS Code Mini App Client</div>
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
            {/* List placeholder */}
            <div className="flex items-center px-6 py-1 hover:bg-[#2a2d2e] cursor-pointer">
              <Play className="w-3 h-3 mr-2" />
              <span className="text-sm">Welcome App</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          {/* Tabs */}
          <div className="h-9 flex bg-[#252526] overflow-x-auto">
            <div className={cn(
              "flex items-center px-3 border-r border-[#1e1e1e] cursor-pointer min-w-[120px] max-w-[200px]",
              activeTab === 'welcome' ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-[#969696]"
            )}>
              <span className="text-xs truncate flex-1">Welcome</span>
              <X className="w-3 h-3 ml-2 hover:bg-[#454545] rounded" />
            </div>
          </div>

          {/* View Content */}
          <div className="flex-1 p-8 overflow-auto">
            <h1 className="text-4xl font-light mb-4 text-[#ffffff]">ToolsBox</h1>
            <p className="text-[#8e8e8e] text-lg mb-8">A VS Code-like desktop container for Mini Apps & Plugins.</p>
            
            <div className="grid grid-cols-2 gap-8 max-w-4xl">
              <div className="space-y-4">
                <h3 className="text-xl font-bold border-b border-[#2b2b2b] pb-2 text-[#ffffff]">Start</h3>
                <div className="space-y-2">
                  <div className="text-sm text-[#3794ff] hover:underline cursor-pointer">New Mini App</div>
                  <div className="text-sm text-[#3794ff] hover:underline cursor-pointer">Import from Folder</div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold border-b border-[#2b2b2b] pb-2 text-[#ffffff]">Recent</h3>
                <div className="text-sm text-[#8e8e8e]">No recently used apps.</div>
              </div>
            </div>
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
          <span className="hover:bg-[#1f8ad2] px-1 cursor-default">MiniAppClient v0.1.0</span>
        </div>
      </div>
    </div>
  );
}

