import { app, BrowserWindow, ipcMain, protocol, net, webFrameMain, Notification, dialog } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { MiniAppService } from './services/miniAppService'
import { PluginService } from './services/pluginService'
import { ExplorerService } from './services/explorerService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 注册特权协议，保证内部的 iframe 具有完整的 Web 功能（如 fetch 支持、跨域等）
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'miniapp', 
    privileges: { 
      standard: true, 
      secure: true, 
      supportFetchAPI: true, 
      corsEnabled: true 
    } 
  },
  { 
    scheme: 'workspace-file', 
    privileges: { 
      standard: true, 
      secure: true, 
      supportFetchAPI: true, 
      corsEnabled: true 
    } 
  },
  { 
    scheme: 'asset', 
    privileges: { 
      standard: true, 
      secure: true, 
      supportFetchAPI: true, 
      corsEnabled: true 
    } 
  }
])

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegrationInSubFrames: true // <--- Allows preload to run inside iframes
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // 监听子框架(iframe)加载完成事件，在主进程中直接注入插件脚本和样式，绕过跨域限制
  win.webContents.on('did-frame-finish-load', async (_event, isMainFrame, frameProcessId, frameRoutingId) => {
    if (isMainFrame) return;

    const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
    if (!frame) return;

    const urlStr = frame.url;
    if (urlStr && urlStr.startsWith('miniapp://')) {
      try {
        const parsedUrl = new URL(urlStr);
        const appId = parsedUrl.hostname;
        
        // 由于 pluginService 在后面才实例化，为了避免提升(hoisting)问题，直接在这里引用全局变量
        const { css, js } = await globalPluginService.getInjectionsForApp(appId);
        
        if (css) {
          // 将 CSS 转换并作为 JS 注入
          const injectCssCode = `
            (function() {
              const style = document.createElement('style');
              style.textContent = \`${css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
              document.head.appendChild(style);
            })();
          `;
          await frame.executeJavaScript(injectCssCode);
        }
        
        if (js) {
          await frame.executeJavaScript(js);
        }
        
        console.log(`Successfully injected plugins into ${appId} from Main Process.`);
      } catch (err) {
        console.error(`Failed to inject plugins to frame: ${urlStr}`, err);
      }
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Initialize services
let globalMiniAppService: MiniAppService;
let globalPluginService: PluginService;

app.whenReady().then(() => {
  const explorerService = new ExplorerService();
  globalMiniAppService = new MiniAppService(explorerService);
  globalPluginService = new PluginService(explorerService);

  const LEGACY_LAYA2IDE_APP_ID = 'laya2-ide';
  const SCENE_KEY_PREFIX = 'scene:';

  const normalizeFsPath = (input: string) => input.replace(/\//g, path.sep);

  const parseScenePathFromKey = (key: string) => {
    if (!key || !key.startsWith(SCENE_KEY_PREFIX)) return null;
    const raw = key.slice(SCENE_KEY_PREFIX.length).trim();
    if (!raw) return null;
    return normalizeFsPath(raw);
  };

  const getLaya2IDEPrivateDir = () => {
    return path.join(app.getPath('userData'), 'miniapp-private', 'laya2IDE');
  };

  const buildScenePrivateFileName = (scenePath: string) => {
    const normalized = path.normalize(scenePath);
    const parsed = path.parse(normalized);
    const parts = parsed.dir.split(path.sep).filter(Boolean);
    const layaIndex = parts.findIndex((segment) => segment.toLowerCase() === 'laya');

    let relParts: string[];
    if (layaIndex > 0) {
      relParts = [...parts.slice(layaIndex - 1), parsed.name];
    } else {
      // Fallback: use the tail path segments if no `laya` directory can be found.
      const fallback = [...parts.slice(Math.max(0, parts.length - 4)), parsed.name];
      relParts = fallback.length ? fallback : [parsed.name || 'scene'];
    }

    const safeName = relParts
      .join('_')
      .replace(/[<>:"/\\|?*]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    return `${safeName || 'scene'}.json`;
  };

  const getScenePrivateFilePathByKey = (key: string) => {
    const scenePath = parseScenePathFromKey(key);
    if (!scenePath) return null;
    return path.join(getLaya2IDEPrivateDir(), buildScenePrivateFileName(scenePath));
  };

  const readScenePrivateStateByKey = async (key: string) => {
    const filePath = getScenePrivateFilePathByKey(key);
    if (!filePath) return null;

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const writeScenePrivateStateByKey = async (key: string, value: unknown) => {
    const filePath = getScenePrivateFilePathByKey(key);
    if (!filePath) return false;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
    return true;
  };

  const getMiniAppPrivateFilePath = (appId: string) => {
    return path.join(app.getPath('userData'), 'miniapp-private', `${appId}.json`);
  };

  const readMiniAppPrivateStore = async (appId: string): Promise<Record<string, unknown>> => {
    const filePath = getMiniAppPrivateFilePath(appId);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const writeMiniAppPrivateStore = async (appId: string, data: Record<string, unknown>) => {
    const filePath = getMiniAppPrivateFilePath(appId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  };

  // 注册自定义协议处理，用于解析形如 miniapp://[app-id]/[path] 的资源请求
  protocol.handle('miniapp', async (request) => {
    try {
      const url = new URL(request.url);
      const appId = url.hostname;
      // 兼容某些情况下的 pathname（如根目录带有斜杠）
      const fileRelPath = decodeURIComponent(url.pathname);
      
      const appDir = path.join(app.getPath('userData'), 'mini-apps', appId);
      const targetPath = path.join(appDir, fileRelPath || 'index.html');
      
      // 简单安全校验：防止路径穿越读取外部文件
      if (!targetPath.startsWith(appDir)) {
        return new Response('Access Denied', { status: 403 });
      }

      // 将本地绝对路径转发给 net.fetch 读取
      const response = await net.fetch(pathToFileURL(targetPath).toString());
      
      // 克隆响应以添加无缓存头 (避免小程序刷新时读取到旧的 bundle)
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (err) {
      console.error('Failed to handle miniapp protocol:', err);
      return new Response('File practically not found', { status: 404 });
    }
  });

  // 注册 asset 协议以读取任意本地文件 (用于工具类读取图片等)
  protocol.handle('asset', (request) => {
    try {
      const url = new URL(request.url);
      // 以 asset://host/ 为前缀的请求，pathname 包含了斜杠开头的文件路径
      const rawPath = decodeURIComponent(url.pathname);
      
      let targetPath = rawPath;
      // 修复 Windows 下的盘符解析，如 /D:/path -> D:/path
      if (targetPath.startsWith('/') && targetPath[2] === ':') {
        targetPath = targetPath.substring(1); 
      }
      
      return net.fetch(pathToFileURL(path.resolve(targetPath)).toString());
    } catch (err) {
      console.error('Failed to handle asset protocol:', err);
      return new Response('File not found', { status: 404 });
    }
  });

  // Register IPC handlers
  ipcMain.handle('mini-app:get-installed', () => {
    return globalMiniAppService.getInstalledApps();
  });
  
  ipcMain.handle('mini-app:import', () => {
    if (win) {
      return globalMiniAppService.importApp(win);
    }
    return { success: false, message: 'No window available' };
  });

  ipcMain.handle('mini-app:uninstall', (_, appId: string) => {
    return globalMiniAppService.uninstallApp(appId);
  });

  ipcMain.handle('mini-app:refresh', (_, appId: string) => {
    return globalMiniAppService.refreshApp(appId);
  });

  // Plugin IPC handlers
  ipcMain.handle('plugin:get-installed', () => {
    return globalPluginService.getInstalledPlugins();
  });

  ipcMain.handle('plugin:import', () => {
    if (win) {
      return globalPluginService.importPlugin(win);
    }
    return { success: false, message: 'No window available' };
  });

  ipcMain.handle('plugin:uninstall', (_, pluginId: string) => {
    return globalPluginService.uninstallPlugin(pluginId);
  });
  
  // 提供给渲染侧动态获取应当注入的脚本/CSS的接口
  ipcMain.handle('plugin:get-injections', (_, appId: string) => {
    return globalPluginService.getInjectionsForApp(appId);
  });

  // ========== Host API Handlers ==========
  ipcMain.handle('host:show-notification', (_, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
      return true;
    }
    return false;
  });

  ipcMain.handle('host:open-directory', async () => {
    if (!win) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle('host:read-dir', async (_, dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith('.'))
        .map((e) => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          isDirectory: e.isDirectory()
        }))
        .sort((a, b) => {
          if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
          return a.isDirectory ? -1 : 1;
        });
    } catch (err) {
      console.error('Failed to read dir:', err);
      return [];
    }
  });

  ipcMain.handle('host:copy-file', async (_, srcPath: string, destPath: string) => {
    try {
      await fs.copyFile(srcPath, destPath);
      return { success: true };
    } catch (err: unknown) {
      console.error('Failed to copy file:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('host:open-file-dialog', async () => {
    if (!win) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections']
    });
    if (canceled) return null;
    return filePaths;
  });

  ipcMain.handle('host:get-theme-color', () => {
    // 简单模拟，返回当前写死的暗色主题
    return 'dark';
  });

  ipcMain.handle('host:private-state:get', async (_, appId: string, key: string) => {
    try {
      // New strategy for Laya2IDE: one file per scene under miniapp-private/laya2IDE
      if (appId === LEGACY_LAYA2IDE_APP_ID && key?.startsWith(SCENE_KEY_PREFIX)) {
        const sceneState = await readScenePrivateStateByKey(key);
        if (sceneState !== null) {
          return sceneState;
        }
      }

      // Backward compatibility: legacy single-file store by appId
      const store = await readMiniAppPrivateStore(appId);
      return store[key] ?? null;
    } catch (err) {
      console.error('Failed to load private state:', err);
      return null;
    }
  });

  ipcMain.handle('host:private-state:set', async (_, appId: string, key: string, value: unknown) => {
    try {
      // New strategy for Laya2IDE: one file per scene under miniapp-private/laya2IDE
      if (appId === LEGACY_LAYA2IDE_APP_ID && key?.startsWith(SCENE_KEY_PREFIX)) {
        const written = await writeScenePrivateStateByKey(key, value);
        if (written) {
          return { success: true };
        }
      }

      // Fallback / legacy behavior
      const store = await readMiniAppPrivateStore(appId);
      store[key] = value;
      await writeMiniAppPrivateStore(appId, store);
      return { success: true };
    } catch (err: unknown) {
      console.error('Failed to save private state:', err);
      return { success: false, error: err instanceof Error ? err.message : 'unknown error' };
    }
  });

  createWindow();
})
