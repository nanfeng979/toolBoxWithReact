import { ipcMain, dialog, protocol, net, app } from 'electron';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export class ExplorerService {
  private currentWorkspacePath: string | null = null;
  private configPath: string;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.setupIpc();
    this.setupProtocol();
  }

  public async getValidPath(key: string): Promise<string | undefined> {
    try {
      if (existsSync(this.configPath)) {
        const data = await fs.readFile(this.configPath, 'utf-8');
        const config = JSON.parse(data);
        let targetPath = config[key];

        if (targetPath) {
          // 循环向上查找直到找到存在的路径
          while (targetPath && !existsSync(targetPath)) {
            const parent = path.dirname(targetPath);
            if (parent === targetPath) {
              targetPath = undefined;
              break;
            }
            targetPath = parent;
          }
          return targetPath;
        }
      }
    } catch (err) {
      console.error('Failed to read config:', err);
    }
    return undefined;
  }

  public async savePath(key: string, value: string) {
    try {
      let config: any = {};
      if (existsSync(this.configPath)) {
        const data = await fs.readFile(this.configPath, 'utf-8');
        config = JSON.parse(data);
      }
      config[key] = value;
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }

  private setupIpc() {
    ipcMain.handle('explorer:open-folder', async () => {
      const lastPath = await this.getValidPath('lastWorkspacePath');
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: lastPath
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const rootPath = result.filePaths[0];
      this.currentWorkspacePath = rootPath;
      await this.savePath('lastWorkspacePath', rootPath);
      const tree = await this.readDirectory(rootPath);
      return { path: rootPath, tree };
    });

    ipcMain.handle('explorer:read-file', async (_, filePath: string) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
      } catch (err) {
        console.error(`Error reading file ${filePath}:`, err);
        return null; // 或者抛出错误
      }
    });

    ipcMain.handle('explorer:write-file', async (_, { filePath, content }: { filePath: string, content: string }) => {
      try {
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
      } catch (err) {
        console.error(`Error writing file ${filePath}:`, err);
        return { success: false, message: (err as Error).message };
      }
    });
  }

  private setupProtocol() {
    protocol.handle('workspace-file', async (request) => {
      try {
        if (!this.currentWorkspacePath) {
          return new Response('No workspace open', { status: 400 });
        }

        let rawPath = request.url.replace(/^workspace-file:\/\//i, '');
        const decodedPath = decodeURIComponent(rawPath);
        
        let targetPath = decodedPath;
        // Fix up http dummy parsing issues if there was any leading slash 
        // e.g. workspace-file:///D:/folder/file.txt -> /D:/folder -> D:/folder
        if (targetPath.startsWith('/') && targetPath[2] === ':') {
          targetPath = targetPath.substring(1); 
        }
        
        // Fix up native fetch swallowing the colon on Windows 
        // e.g. workspace-file://c/Users -> targetPath starts with "c/Users"
        if (/^[a-zA-Z]\//.test(targetPath)) {
          targetPath = targetPath[0] + ':' + targetPath.substring(1);
        }

        const resolvedTarget = path.resolve(targetPath);
        const resolvedWorkspace = path.resolve(this.currentWorkspacePath);
        
        console.log('[workspace-file] mapped targetPath:', targetPath, ' -> resolvedTarget:', resolvedTarget, ' | resolvedWorkspace:', resolvedWorkspace);

        // Case-insensitive check to handle Windows drive letter discrepancies (e.g. C: vs c:)
        if (!resolvedTarget.toLowerCase().startsWith(resolvedWorkspace.toLowerCase())) {
          return new Response('Access Denied: Path Travelsal ' + resolvedTarget, { status: 403 });
        }

        return net.fetch(pathToFileURL(resolvedTarget).toString());
      } catch (err) {
        console.error('Failed to handle workspace-file protocol:', err);
        return new Response('File not found', { status: 404 });
      }
    });
  }

  private async readDirectory(dirPath: string): Promise<FileNode[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        // 忽略隐藏文件和 node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: true,
            children: await this.readDirectory(fullPath)
          });
        } else {
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false
          });
        }
      }

      // 排序：目录在前，按名称字母排序
      return nodes.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
      return [];
    }
  }
}
