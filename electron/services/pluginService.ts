import { app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  // 目标小程序 ID 列表。如果是 '*' 则为对所有应用生效
  targetApps: string[] | '*';
  // 注入的内容配置
  inject: {
    css?: string[];
    js?: string[];
  };
}

export class PluginService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(app.getPath('userData'), 'plugins');
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
   * 扫描 plugins 目录获取系统目前所有的本地插件
   */
  async getInstalledPlugins(): Promise<PluginManifest[]> {
    await this.ensureBaseDir();
    const plugins: PluginManifest[] = [];
    
    try {
      const items = await fs.readdir(this.baseDir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const pluginDir = path.join(this.baseDir, item.name);
          const manifestPath = path.join(pluginDir, 'plugin.json');
          
          try {
            const manifestData = await fs.readFile(manifestPath, 'utf-8');
            const manifest: PluginManifest = JSON.parse(manifestData);
            
            // 确保以文件夹名称作为ID基准，如果未填自动补充
            manifest.id = item.name;
            plugins.push(manifest);
          } catch (err) {
            console.error(`Failed to parse plugin.json for ${item.name}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to read plugins directory:', err);
    }
    
    return plugins;
  }

  /**
   * 获取为特定小程序准备的注入内容。
   * 该方法会将所需的 js 原始代码以 string 返回，便于后续注入到 iframe/webview 中。
   */
  async getInjectionsForApp(appId: string): Promise<{ css: string, js: string }> {
    const allPlugins = await this.getInstalledPlugins();
    
    let combinedCss = '';
    let combinedJs = '';

    for (const plugin of allPlugins) {
      const matches = plugin.targetApps === '*' || plugin.targetApps.includes(appId);
      if (!matches) continue;

      const pluginDir = path.join(this.baseDir, plugin.id);

      // 读取并合并 JS 脚本
      if (plugin.inject && Array.isArray(plugin.inject.js)) {
        for (const jsFile of plugin.inject.js) {
          try {
            const filePath = path.join(pluginDir, jsFile);
            const content = await fs.readFile(filePath, 'utf-8');
            // 对每个插件的 JS 包裹一个 IIFE 避免污染全局变量
            combinedJs += `\n/* Plugin: ${plugin.name} */\n(() => { \n${content}\n })();\n`;
          } catch (e) {
            console.error(`Plugin ${plugin.id} failed to read inject JS: ${jsFile}`, e);
          }
        }
      }

      // 读取并合并 CSS
      if (plugin.inject && Array.isArray(plugin.inject.css)) {
        for (const cssFile of plugin.inject.css) {
          try {
            const filePath = path.join(pluginDir, cssFile);
            const content = await fs.readFile(filePath, 'utf-8');
            combinedCss += `\n/* Plugin: ${plugin.name} */\n${content}\n`;
          } catch (e) {
            console.error(`Plugin ${plugin.id} failed to read inject CSS: ${cssFile}`, e);
          }
        }
      }
    }

    return { css: combinedCss, js: combinedJs };
  }

  /**
   * 导入外部插件文件夹
   */
  async importPlugin(browserWindow: Electron.BrowserWindow): Promise<{ success: boolean; message: string }> {
    await this.ensureBaseDir();
    const result = await dialog.showOpenDialog(browserWindow, {
      title: '选择插件文件夹',
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '用户取消' };
    }

    const sourceDir = result.filePaths[0];
    const manifestPath = path.join(sourceDir, 'plugin.json');

    try {
      await fs.access(manifestPath);
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestData);

      if (!manifest.id || !manifest.name) {
        throw new Error('plugin.json 缺少必要字段 (id, name)');
      }

      const targetDir = path.join(this.baseDir, manifest.id);
      
      try {
        await fs.access(targetDir);
        return { success: false, message: `插件ID [${manifest.id}] 已存在，请先卸载` };
      } catch {}

      // Node.js 16.7.0+ 提供的递归拷贝
      await fs.cp(sourceDir, targetDir, { recursive: true });
      return { success: true, message: `插件 ${manifest.name} 安装成功` };

    } catch (err) {
      return { success: false, message: `导入插件失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  async uninstallPlugin(pluginId: string): Promise<{ success: boolean; message: string }> {
    const targetDir = path.join(this.baseDir, pluginId);
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
      return { success: true, message: `插件 [${pluginId}] 已卸载` };
    } catch (err) {
      return { success: false, message: `卸载插件失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
