import { ipcMain, dialog, protocol, net } from 'electron';
import fs from 'node:fs/promises';
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

  constructor() {
    this.setupIpc();
    this.setupProtocol();
  }

  private setupIpc() {
    ipcMain.handle('explorer:open-folder', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const rootPath = result.filePaths[0];
      this.currentWorkspacePath = rootPath;
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
  }

  private setupProtocol() {
    protocol.handle('workspace-file', async (request) => {
      try {
        if (!this.currentWorkspacePath) {
          return new Response('No workspace open', { status: 400 });
        }

        const rawPath = request.url.replace(/^workspace-file:\/\//, '');
        // handle search params / query / hash if they exist
        const relativeUrlPath = new URL(`http://dummy/${rawPath}`);
        const cleanRelPath = decodeURIComponent(relativeUrlPath.pathname);
        // remove leading slash
        const relPath = cleanRelPath.startsWith('/') ? cleanRelPath.substring(1) : cleanRelPath;

        const targetPath = path.join(this.currentWorkspacePath, relPath);
        
        // Security Check: Absolute verification to block ../ traversal
        const resolvedTarget = path.resolve(targetPath);
        const resolvedWorkspace = path.resolve(this.currentWorkspacePath);
        
        if (!resolvedTarget.startsWith(resolvedWorkspace)) {
          return new Response('Access Denied: Path Travelsal', { status: 403 });
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
