export interface HostApi {
  showNotification(title: string, body: string): Promise<boolean>;
  openFileDialog(): Promise<string[] | null>;
  openDirectoryDialog(): Promise<string | null>;
  readDirectoryFiles(dirPath: string): Promise<{name: string, path: string}[]>;
  copyFile(srcPath: string, destPath: string): Promise<{success: boolean, error?: string}>;
  getThemeColor(): Promise<string>;
}

declare global {
  interface Window {
    hostApi?: HostApi;
  }
}
