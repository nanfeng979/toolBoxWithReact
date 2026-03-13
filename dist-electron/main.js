var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, dialog, protocol, BrowserWindow, net, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
class MiniAppService {
  constructor() {
    __publicField(this, "baseDir");
    this.baseDir = path.join(app.getPath("userData"), "mini-apps");
    this.ensureBaseDir();
  }
  async ensureBaseDir() {
    try {
      await fs.access(this.baseDir);
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }
  /**
   * 扫描 mini-apps 目录，获取已安装的小程序列表
   */
  async getInstalledApps() {
    await this.ensureBaseDir();
    const apps = [];
    try {
      const items = await fs.readdir(this.baseDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const appDir = path.join(this.baseDir, item.name);
          const manifestPath = path.join(appDir, "app.json");
          try {
            const manifestData = await fs.readFile(manifestPath, "utf-8");
            const manifest = JSON.parse(manifestData);
            manifest.id = item.name;
            apps.push(manifest);
          } catch (err) {
            console.error(`Failed to parse app.json for ${item.name}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("Failed to read mini-apps directory:", err);
    }
    return apps;
  }
  /**
   * 提供一种机制选择外部文件夹导入为小程序
   */
  async importApp(browserWindow) {
    await this.ensureBaseDir();
    const result = await dialog.showOpenDialog(browserWindow, {
      title: "选择小程序文件夹",
      properties: ["openDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: "用户取消" };
    }
    const sourceDir = result.filePaths[0];
    const manifestPath = path.join(sourceDir, "app.json");
    try {
      await fs.access(manifestPath);
      const manifestData = await fs.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestData);
      if (!manifest.id || !manifest.name) {
        throw new Error("app.json 缺少必要字段 (id, name)");
      }
      const targetDir = path.join(this.baseDir, manifest.id);
      try {
        await fs.access(targetDir);
        return { success: false, message: `小程序ID [${manifest.id}] 已存在，请先卸载` };
      } catch {
      }
      await fs.cp(sourceDir, targetDir, { recursive: true });
      return { success: true, message: `应用 ${manifest.name} 安装成功` };
    } catch (err) {
      return { success: false, message: `导入失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
  /**
   * 卸载/删除小程序
   */
  async uninstallApp(appId) {
    const targetDir = path.join(this.baseDir, appId);
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
      return { success: true, message: `小程序 [${appId}] 已卸载` };
    } catch (err) {
      return { success: false, message: `卸载失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
protocol.registerSchemesAsPrivileged([
  {
    scheme: "miniapp",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
const miniAppService = new MiniAppService();
app.whenReady().then(() => {
  protocol.handle("miniapp", (request) => {
    try {
      const url = new URL(request.url);
      const appId = url.hostname;
      const fileRelPath = decodeURIComponent(url.pathname);
      const appDir = path.join(app.getPath("userData"), "mini-apps", appId);
      const targetPath = path.join(appDir, fileRelPath || "index.html");
      if (!targetPath.startsWith(appDir)) {
        return new Response("Access Denied", { status: 403 });
      }
      return net.fetch(pathToFileURL(targetPath).toString());
    } catch (err) {
      console.error("Failed to handle miniapp protocol:", err);
      return new Response("File practically not found", { status: 404 });
    }
  });
  ipcMain.handle("mini-app:get-installed", () => {
    return miniAppService.getInstalledApps();
  });
  ipcMain.handle("mini-app:import", () => {
    if (win) {
      return miniAppService.importApp(win);
    }
    return { success: false, message: "No window available" };
  });
  ipcMain.handle("mini-app:uninstall", (_, appId) => {
    return miniAppService.uninstallApp(appId);
  });
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
