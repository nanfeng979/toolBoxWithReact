import { app, BrowserWindow, ipcMain, protocol, net, webFrameMain, Notification, dialog } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
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
  globalMiniAppService = new MiniAppService();
  globalPluginService = new PluginService();
  new ExplorerService();

  // 注册自定义协议处理，用于解析形如 miniapp://[app-id]/[path] 的资源请求
  protocol.handle('miniapp', (request) => {
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
      return net.fetch(pathToFileURL(targetPath).toString());
    } catch (err) {
      console.error('Failed to handle miniapp protocol:', err);
      return new Response('File practically not found', { status: 404 });
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

  createWindow();
})
