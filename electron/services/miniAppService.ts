import { app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface MiniAppManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  entry: string;
}

export class MiniAppService {
  private baseDir: string;

  constructor() {
    // 将小程序存储在应用的用户数据目录下
    this.baseDir = path.join(app.getPath('userData'), 'mini-apps');
    this.ensureBaseDir().then(() => this.copyBuiltinApps());
  }

  private async copyBuiltinApps() {
    try {
      // In dev, the root is the project root. In prod, it's the app root.
      const rootPath = process.env.APP_ROOT || path.join(__dirname, '..');
      const builtinDir = path.join(rootPath, 'builtin-apps');
      
      const exists = await fs.access(builtinDir).then(() => true).catch(() => false);
      if (!exists) return;

      const items = await fs.readdir(builtinDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const srcPath = path.join(builtinDir, item.name);
          const destPath = path.join(this.baseDir, item.name);
          
          await fs.cp(srcPath, destPath, { recursive: true, force: true });
          console.log(`Copied builtin app: ${item.name} to ${destPath}`);
        }
      }
    } catch (e) {
      console.error('Failed to copy builtin apps:', e);
    }
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
            const manifest: MiniAppManifest = JSON.parse(manifestData);
            
            // 补充 id 和路径校验
            manifest.id = item.name;
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

  /**
   * 提供一种机制选择外部文件夹导入为小程序
   */
  async importApp(browserWindow: Electron.BrowserWindow): Promise<{ success: boolean; message: string }> {
    await this.ensureBaseDir();
    const result = await dialog.showOpenDialog(browserWindow, {
      title: '选择小程序文件夹',
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '用户取消' };
    }

    const sourceDir = result.filePaths[0];
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
