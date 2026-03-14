import { create } from 'zustand';
import { MiniAppManifest } from '../vite-env';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export interface TabInstance {
  tabId: string;
  app: MiniAppManifest;
  title?: string;
  payload?: any;
}

interface AppStore {
  activeTab: string;
  openTabs: TabInstance[];
  isCommandPaletteOpen: boolean;
  workspacePath: string | null;
  fileTree: FileNode[];
  
  setActiveTab: (tabId: string) => void;
  openApp: (app: MiniAppManifest, options?: { tabId?: string; title?: string; payload?: any }) => void;
  closeTab: (tabId: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setWorkspace: (path: string | null, tree: FileNode[]) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeTab: 'welcome',
  openTabs: [],
  isCommandPaletteOpen: false,
  workspacePath: null,
  fileTree: [],
  
  setActiveTab: (tabId) => set({ activeTab: tabId }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setWorkspace: (path, tree) => set({ workspacePath: path, fileTree: tree }),
  
  openApp: (app, options) => set((state) => {
    const tabId = options?.tabId || app.id;
    const exists = state.openTabs.find(t => t.tabId === tabId);
    
    if (!exists) {
      const newTab: TabInstance = {
        tabId,
        app,
        title: options?.title || app.name,
        payload: options?.payload
      };
      return { 
        openTabs: [...state.openTabs, newTab],
        activeTab: tabId
      };
    }
    return { activeTab: tabId };
  }),
  
  closeTab: (tabId) => set((state) => {
    const newTabs = state.openTabs.filter(t => t.tabId !== tabId);
    let nextActiveTab = state.activeTab;
    
    // If we're closing the currently active tab
    if (state.activeTab === tabId) {
      // Pick the previous tab in the array if available, otherwise welcome
      const closedIndex = state.openTabs.findIndex(t => t.tabId === tabId);
      if (newTabs.length === 0) {
        nextActiveTab = 'welcome';
      } else if (closedIndex > 0) {
        nextActiveTab = newTabs[closedIndex - 1].tabId;
      } else {
        nextActiveTab = newTabs[0].tabId;
      }
    }
    
    return {
      openTabs: newTabs,
      activeTab: nextActiveTab
    };
  })
}));
