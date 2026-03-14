import { create } from 'zustand';
import { MiniAppManifest } from '../vite-env';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface AppStore {
  activeTab: string;
  openTabs: MiniAppManifest[];
  isCommandPaletteOpen: boolean;
  workspacePath: string | null;
  fileTree: FileNode[];
  
  setActiveTab: (id: string) => void;
  openApp: (app: MiniAppManifest) => void;
  closeTab: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setWorkspace: (path: string | null, tree: FileNode[]) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeTab: 'welcome',
  openTabs: [],
  isCommandPaletteOpen: false,
  workspacePath: null,
  fileTree: [],
  
  setActiveTab: (id) => set({ activeTab: id }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setWorkspace: (path, tree) => set({ workspacePath: path, fileTree: tree }),
  
  openApp: (app) => set((state) => {
    // If not already open, add it
    const exists = state.openTabs.find(t => t.id === app.id);
    if (!exists) {
      return { 
        openTabs: [...state.openTabs, app],
        activeTab: app.id
      };
    }
    return { activeTab: app.id };
  }),
  
  closeTab: (id) => set((state) => {
    const newTabs = state.openTabs.filter(t => t.id !== id);
    let nextActiveTab = state.activeTab;
    
    // If we're closing the currently active tab
    if (state.activeTab === id) {
      // Pick the previous tab in the array if available, otherwise welcome
      const closedIndex = state.openTabs.findIndex(t => t.id === id);
      if (newTabs.length === 0) {
        nextActiveTab = 'welcome';
      } else if (closedIndex > 0) {
        nextActiveTab = newTabs[closedIndex - 1].id;
      } else {
        nextActiveTab = newTabs[0].id;
      }
    }
    
    return {
      openTabs: newTabs,
      activeTab: nextActiveTab
    };
  })
}));
