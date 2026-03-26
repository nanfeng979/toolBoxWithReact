import { ipcRenderer, contextBridge } from 'electron'

// 区分是在主系统（host）中还是在 iframe 子应用中
// 在 miniapp 协议下，我们只暴露受限的 Host API
if (window.location.protocol === 'miniapp:') {
  contextBridge.exposeInMainWorld('hostApi', {
    showNotification: (title: string, body: string) => ipcRenderer.invoke('host:show-notification', title, body),
    openFileDialog: () => ipcRenderer.invoke('host:open-file-dialog'),
    openDirectoryDialog: () => ipcRenderer.invoke('host:open-directory'),
    readDirectoryFiles: (dirPath: string) => ipcRenderer.invoke('host:read-dir', dirPath),
    copyFile: (srcPath: string, destPath: string) => ipcRenderer.invoke('host:copy-file', srcPath, destPath),
    getThemeColor: () => ipcRenderer.invoke('host:get-theme-color'),
  });
} else {
  // --------- Expose some API to the Renderer process ---------
  contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
      const [channel, listener] = args
      return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // Mini App APIs
  miniApp: {
    getInstalledApps: () => ipcRenderer.invoke('mini-app:get-installed'),
    importApp: () => ipcRenderer.invoke('mini-app:import'),
    uninstallApp: (appId: string) => ipcRenderer.invoke('mini-app:uninstall', appId),
  },

  // Plugin APIs
  plugins: {
    getInstalledPlugins: () => ipcRenderer.invoke('plugin:get-installed'),
    importPlugin: () => ipcRenderer.invoke('plugin:import'),
    uninstallPlugin: (pluginId: string) => ipcRenderer.invoke('plugin:uninstall', pluginId),
    getInjectionsForApp: (appId: string) => ipcRenderer.invoke('plugin:get-injections', appId),
  }
  });
}
