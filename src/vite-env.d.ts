/// <reference types="vite/client" />

export interface MiniAppManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  entry: string;
  framework?: 'html' | 'react';
  react?: {
    entry?: string;
    mountId?: string;
    title?: string;
  };
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  targetApps: string[] | '*';
}

declare global {
  interface Window {
    ipcRenderer: {
      on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
      off: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
      send: (channel: string, ...args: any[]) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      miniApp: {
        getInstalledApps: () => Promise<MiniAppManifest[]>;
        importApp: () => Promise<{ success: boolean; message: string }>;
        uninstallApp: (appId: string) => Promise<{ success: boolean; message: string }>;
      };
      plugins: {
        getInstalledPlugins: () => Promise<PluginManifest[]>;
        importPlugin: () => Promise<{ success: boolean; message: string }>;       
        uninstallPlugin: (pluginId: string) => Promise<{ success: boolean; message: string }>;      
        getInjectionsForApp: (appId: string) => Promise<{ css: string, js: string }>;
      };
    };
  }
}

