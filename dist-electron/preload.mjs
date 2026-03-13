"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  },
  // Mini App APIs
  miniApp: {
    getInstalledApps: () => electron.ipcRenderer.invoke("mini-app:get-installed"),
    importApp: () => electron.ipcRenderer.invoke("mini-app:import"),
    uninstallApp: (appId) => electron.ipcRenderer.invoke("mini-app:uninstall", appId)
  },
  // Plugin APIs
  plugins: {
    getInstalledPlugins: () => electron.ipcRenderer.invoke("plugin:get-installed"),
    importPlugin: () => electron.ipcRenderer.invoke("plugin:import"),
    uninstallPlugin: (pluginId) => electron.ipcRenderer.invoke("plugin:uninstall", pluginId),
    getInjectionsForApp: (appId) => electron.ipcRenderer.invoke("plugin:get-injections", appId)
  }
});
