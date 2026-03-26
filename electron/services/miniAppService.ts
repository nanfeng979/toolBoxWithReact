import { app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { ExplorerService } from './explorerService';

interface ReactMiniAppConfig {
  entry?: string;
  mountId?: string;
  title?: string;
}

export interface MiniAppManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  entry: string;
  framework?: 'html' | 'react';
  react?: ReactMiniAppConfig;
}

export class MiniAppService {
  private baseDir: string;
  private readonly reactBuildRelDir = '.toolsbox/react-runtime';
  private readonly hostRootDir: string;
  private explorerService: ExplorerService;

  constructor(explorerService: ExplorerService) {
    this.explorerService = explorerService;
    this.hostRootDir = process.env.APP_ROOT || path.resolve(__dirname, '..');
    // 将小程序存储在应用的用户数据目录下
    this.baseDir = path.join(app.getPath('userData'), 'mini-apps');
    this.ensureBaseDir();
  }

  private async ensureBaseDir() {
    try {
      await fs.access(this.baseDir);
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  /**
   * 扫描 mini-apps 目录，获取已安装的小程序列表
   */
  async getInstalledApps(): Promise<MiniAppManifest[]> {
    await this.ensureBaseDir();
    const apps: MiniAppManifest[] = [];
    
    try {
      const items = await fs.readdir(this.baseDir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const appDir = path.join(this.baseDir, item.name);
          const manifestPath = path.join(appDir, 'app.json');
          
          try {
            const manifestData = await fs.readFile(manifestPath, 'utf-8');
            const rawManifest: MiniAppManifest = JSON.parse(manifestData);
            const manifest = await this.resolveManifest(appDir, item.name, rawManifest);
            apps.push(manifest);
          } catch (err) {
            console.error(`Failed to parse app.json for ${item.name}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to read mini-apps directory:', err);
    }
    
    return apps;
  }

  private async resolveManifest(appDir: string, appId: string, manifest: MiniAppManifest): Promise<MiniAppManifest> {
    const normalizedManifest: MiniAppManifest = {
      ...manifest,
      id: appId,
      framework: manifest.framework || 'html'
    };

    if (normalizedManifest.framework === 'react') {
      const runtimeEntry = await this.prepareReactRuntime(appDir, normalizedManifest);
      normalizedManifest.entry = runtimeEntry;
    }

    return normalizedManifest;
  }

  private async prepareReactRuntime(appDir: string, manifest: MiniAppManifest): Promise<string> {
    const entry = manifest.react?.entry || manifest.entry;
    const entryPath = path.join(appDir, entry.replace(/^[/\\]+/, ''));
    const outDir = path.join(appDir, this.reactBuildRelDir);
    const outJsPath = path.join(outDir, 'bundle.js');
    const outHtmlPath = path.join(outDir, 'index.html');
    const hostNodeModules = path.join(this.hostRootDir, 'node_modules');

    await fs.access(entryPath);
    await fs.mkdir(outDir, { recursive: true });

    await build({
      absWorkingDir: this.hostRootDir,
      nodePaths: [hostNodeModules],
      entryPoints: [entryPath],
      bundle: true,
      platform: 'browser',
      format: 'iife',
      target: ['chrome120'],
      jsx: 'automatic',
      outfile: outJsPath,
      sourcemap: 'inline',
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });

    const mountId = manifest.react?.mountId || 'root';
    const title = manifest.react?.title || manifest.name;
    const htmlContent = [
      '<!doctype html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      `    <title>${title}</title>`,
      '  </head>',
      '  <body>',
      `    <div id="${mountId}"></div>`,
      '    <script src="./bundle.js"></script>',
      '  </body>',
      '</html>'
    ].join('\n');

    await fs.writeFile(outHtmlPath, htmlContent, 'utf-8');

    return this.reactBuildRelDir.split(path.sep).join('/').concat('/index.html');
  }

  /**
   * 提供一种机制选择外部文件夹导入为小程序
   */
  async importApp(browserWindow: Electron.BrowserWindow): Promise<{ success: boolean; message: string }> {
    await this.ensureBaseDir();
    const lastPath = await this.explorerService.getValidPath('lastMiniAppImportPath');
    const result = await dialog.showOpenDialog(browserWindow, {
      title: '选择小程序文件夹',
      properties: ['openDirectory'],
      defaultPath: lastPath
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '用户取消' };
    }

    const sourceDir = result.filePaths[0];
    await this.explorerService.savePath('lastMiniAppImportPath', sourceDir);
    const manifestPath = path.join(sourceDir, 'app.json');

    try {
      // 检查源文件夹是否合法
      await fs.access(manifestPath);
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestData);

      if (!manifest.id || !manifest.name) {
        throw new Error('app.json 缺少必要字段 (id, name)');
      }

      const targetDir = path.join(this.baseDir, manifest.id);
      
      // 检查是否已存在
      try {
        await fs.access(targetDir);
        return { success: false, message: `小程序ID [${manifest.id}] 已存在，请先卸载` };
      } catch {
        // Not exists, proceed
      }

      // 进行目录复制 (Node.js 16.7.0+)
      await fs.cp(sourceDir, targetDir, { recursive: true });

      return { success: true, message: `应用 ${manifest.name} 安装成功` };

    } catch (err) {
      return { success: false, message: `导入失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  /**
   * 卸载/删除小程序
   */
  async uninstallApp(appId: string): Promise<{ success: boolean; message: string }> {
    const targetDir = path.join(this.baseDir, appId);
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
      return { success: true, message: `小程序 [${appId}] 已卸载` };
    } catch (err) {
      return { success: false, message: `卸载失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
