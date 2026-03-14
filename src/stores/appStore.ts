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
  type: 'miniapp' | 'editor';
  app?: MiniAppManifest;
  title?: string;
  payload?: any;
}

// 文件后缀映射注册表：key 为扩展名 (无点), value 为对应的小程序 appId
export const extRegistry: Record<string, string> = {
  'scene': 'laya-scene-viewer', // 假设：如果你装了 laya-scene-viewer，.scene 会用它打开
  'draw': 'excalidraw-app'      // 假设：.draw 用画板小程序打开
};

interface AppStore {
  activeTab: string;
  openTabs: TabInstance[];
  isCommandPaletteOpen: boolean;
  workspacePath: string | null;
  fileTree: FileNode[];
  installedApps: MiniAppManifest[];
  
  setActiveTab: (tabId: string) => void;
  setInstalledApps: (apps: MiniAppManifest[]) => void;
  openApp: (app: MiniAppManifest, options?: { tabId?: string; title?: string; payload?: any }) => void;
  openFile: (filePath: string, fileName: string) => void;
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
  installedApps: [],
  
  setActiveTab: (tabId) => set({ activeTab: tabId }),
  setInstalledApps: (apps) => set({ installedApps: apps }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setWorkspace: (path, tree) => set({ workspacePath: path, fileTree: tree }),
  
  openApp: (app, options) => set((state) => {
    const tabId = options?.tabId || app.id;
    const exists = state.openTabs.find(t => t.tabId === tabId);
    
    if (!exists) {
      const newTab: TabInstance = {
        tabId,
        type: 'miniapp',
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

  // 通用的打开文件方法，支持后缀拦截与回退
  openFile: (filePath, fileName) => set((state) => {
    const tabId = filePath;
    const exists = state.openTabs.find(t => t.tabId === tabId);
    if (exists) {
      return { activeTab: tabId };
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const targetAppId = extRegistry[ext];

    // 如果该后缀命中了注册表
    if (targetAppId) {
      const appManifest = state.installedApps.find(a => a.id === targetAppId);
      if (appManifest) {
        // 作为 Mini App 打开
        const newTab: TabInstance = {
          tabId,
          type: 'miniapp',
          app: appManifest,
          title: fileName,
          payload: { filePath }
        };
        return {
          openTabs: [...state.openTabs, newTab],
          activeTab: tabId
        };
      } else {
        // 未安装对应插件，给出提示并回退
        console.warn(`[ToolsBox] .${ext} requests ${targetAppId}, but it's not installed. Fallback to Native Editor.`);
        alert(`This file type is best viewed with the "${targetAppId}" application, which is not installed. Opening as plain text.`);
      }
    }

    // 默认回退：使用原生文本编辑器
    const newTab: TabInstance = {
      tabId,
      type: 'editor',
      title: fileName,
      payload: { filePath }
    };
    return {
      openTabs: [...state.openTabs, newTab],
      activeTab: tabId
    };
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
