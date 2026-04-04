import { SceneNode } from '../../types/scene';

export interface AssetExplorerPanelProps {
  height: number;
  minHeight: number;
  sceneFilePath: string;
  sceneData: SceneNode | null;
}

export interface HostApiEntryItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface DirWatchChange {
  op: 'add' | 'remove' | 'update';
  path: string;
  entry?: HostApiEntryItem;
}

export interface DirWatchPayload {
  watchId: string;
  dirPath: string;
  mode: 'delta' | 'reset';
  changes?: DirWatchChange[];
  entries?: HostApiEntryItem[];
}

export interface WatchResult {
  success: boolean;
  error?: string;
}

export interface FolderOption {
  key: string;
  label: string;
  path: string;
}

export interface AssetExplorerPanelState {
  projectFolderOptions: FolderOption[];
  projectTemporaryFolderOptions: FolderOption[];
  selectedProjectFolderKey: string;
  projectRootPath: string;
  projectCurrentPath: string;
  projectEntries: HostApiEntryItem[];
  projectLoading: boolean;
  projectPaneWidth: number;
  externalFolders: FolderOption[];
  selectedExternalFolderKey: string;
  externalRootPath: string;
  externalCurrentPath: string;
  externalEntries: HostApiEntryItem[];
  externalLoading: boolean;
  lastError: string;
  isDragActive: boolean;
}

export interface BreadcrumbItem {
  label: string;
  path: string;
}

export interface AssetExplorerHostApi {
  openDirectoryDialog?: () => Promise<string | null>;
  readDirectoryFiles?: (dirPath: string) => Promise<HostApiEntryItem[]>;
  watchDirectory?: (watchId: string, dirPath: string) => Promise<WatchResult>;
  unwatchDirectory?: (watchId: string) => Promise<WatchResult>;
  onDirectoryChanged?: (listener: (payload: unknown) => void) => () => void;
}
