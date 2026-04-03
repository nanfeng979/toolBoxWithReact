import React from 'react';
import { SceneNode } from '../../types/scene';

interface AssetExplorerPanelProps {
  height: number;
  minHeight: number;
  sceneFilePath: string;
  sceneData: SceneNode | null;
}

interface HostApiEntryItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface DirWatchChange {
  op: 'add' | 'remove' | 'update';
  path: string;
  entry?: HostApiEntryItem;
}

interface DirWatchPayload {
  watchId: string;
  dirPath: string;
  mode: 'delta' | 'reset';
  changes?: DirWatchChange[];
  entries?: HostApiEntryItem[];
}

interface WatchResult {
  success: boolean;
  error?: string;
}

interface FolderOption {
  key: string;
  label: string;
  path: string;
}

interface AssetExplorerPanelState {
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
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const ASSET_EXPLORER_LAYOUT_STORAGE_KEY = 'laya2ide.asset-explorer.layout.v1';
const DEFAULT_PROJECT_PANE_WIDTH = 0;
const PROJECT_WATCH_ID = 'asset-explorer-project';
const EXTERNAL_WATCH_ID = 'asset-explorer-external';

function normalizeSlashes(input: string) {
  return input.replace(/\\/g, '/');
}

function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/g, '');
}

function joinPath(base: string, next: string) {
  const normalizedBase = trimTrailingSlash(normalizeSlashes(base));
  const normalizedNext = next.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedNext}`;
}

function dirname(input: string) {
  const normalized = trimTrailingSlash(normalizeSlashes(input));
  const idx = normalized.lastIndexOf('/');
  if (idx < 0) return '';
  if (idx === 0) return '/';
  return normalized.slice(0, idx);
}

function basename(input: string) {
  const normalized = trimTrailingSlash(normalizeSlashes(input));
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function extname(fileName: string) {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return '';
  return fileName.slice(idx).toLowerCase();
}

function stripExt(fileName: string) {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return fileName;
  return fileName.slice(0, idx);
}

function normalizeForCompare(input: string) {
  return normalizeSlashes(input).toLowerCase();
}

function isWithinRoot(targetPath: string, rootPath: string) {
  const target = normalizeForCompare(trimTrailingSlash(targetPath));
  const root = normalizeForCompare(trimTrailingSlash(rootPath));
  return target === root || target.startsWith(`${root}/`);
}

function canGoParent(currentPath: string, rootPath: string) {
  if (!currentPath || !rootPath) return false;
  return normalizeForCompare(trimTrailingSlash(currentPath)) !== normalizeForCompare(trimTrailingSlash(rootPath));
}

function toAssetUrl(absPath: string) {
  const normalized = normalizeSlashes(absPath).replace(/^\/+/, '');
  return `asset://local/${encodeURI(normalized)}`;
}

function findLayaAssetsFolder(sceneFilePath: string) {
  if (!sceneFilePath) return '';
  const normalized = normalizeSlashes(sceneFilePath);
  const parts = normalized.split('/').filter((p) => p.length > 0);

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i].toLowerCase() === 'laya') {
      const prefix = parts.slice(0, i + 1).join('/');
      const hasDrive = /^[a-zA-Z]:$/.test(parts[0]);
      const root = hasDrive ? prefix : `/${prefix}`;
      return `${root}/assets`;
    }
  }

  return '';
}

function toProjectTemporaryFolderKey(path: string) {
  return `tmp:${normalizeSlashes(path)}`;
}

function getProjectRelativePath(rootPath: string, targetPath: string) {
  const root = trimTrailingSlash(normalizeSlashes(rootPath));
  const target = trimTrailingSlash(normalizeSlashes(targetPath));
  if (!root || !target) return '';
  if (normalizeForCompare(root) === normalizeForCompare(target)) return '';
  const prefix = `${root}/`;
  if (!normalizeForCompare(target).startsWith(normalizeForCompare(prefix))) return '';
  return target.slice(prefix.length);
}

function buildBreadcrumbItems(rootPath: string, currentPath: string) {
  if (!rootPath || !currentPath || !isWithinRoot(currentPath, rootPath)) return [] as Array<{ label: string; path: string }>;

  const items: Array<{ label: string; path: string }> = [{ label: 'assets', path: rootPath }];
  const relative = getProjectRelativePath(rootPath, currentPath);
  if (!relative) return items;

  const segments = relative.split('/').filter(Boolean);
  let walkPath = rootPath;
  for (const seg of segments) {
    walkPath = joinPath(walkPath, seg);
    items.push({ label: seg, path: walkPath });
  }
  return items;
}

function estimateBreadcrumbWidth(label: string) {
  return Math.max(44, label.length * 8 + 22);
}

function getVisibleBreadcrumbItems(items: Array<{ label: string; path: string }>, availableWidth: number) {
  if (!items.length) return [] as Array<{ label: string; path: string }>;

  const gapWidth = 6;
  const ellipsisWidth = 24;
  let totalWidth = 0;
  const widths = items.map((item) => estimateBreadcrumbWidth(item.label));

  for (let i = 0; i < widths.length; i += 1) {
    totalWidth += widths[i];
    if (i > 0) totalWidth += gapWidth;
  }

  if (totalWidth <= availableWidth) return items;

  let startIndex = 0;
  let usedWidth = ellipsisWidth;

  for (let i = widths.length - 1; i >= 0; i -= 1) {
    const nextWidth = widths[i] + (usedWidth > ellipsisWidth ? gapWidth : 0);
    if (usedWidth + nextWidth > availableWidth) break;
    usedWidth += nextWidth;
    startIndex = i;
  }

  return items.slice(startIndex);
}

function renderBreadcrumbButtons(items: Array<{ label: string; path: string }>, onClick: (path: string) => void) {
  if (!items.length) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && <span style={{ color: '#66707c' }}>/</span>}
          <button
            type="button"
            onClick={() => onClick(item.path)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9cb2ce',
              padding: 0,
              cursor: 'pointer',
              fontSize: 11,
              flex: '0 0 auto'
            }}
            title={item.path}
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function getNormalizedWidth(value: number, minWidth: number, maxWidth: number) {
  if (!Number.isFinite(value) || value <= 0) return minWidth;
  return Math.max(minWidth, Math.min(maxWidth, value));
}

function sortEntries(entries: HostApiEntryItem[]) {
  return [...entries].sort((a, b) => {
    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
    return a.isDirectory ? -1 : 1;
  });
}

function applyDirChanges(entries: HostApiEntryItem[], changes: DirWatchChange[]) {
  const map = new Map<string, HostApiEntryItem>();
  entries.forEach((entry) => {
    map.set(normalizeForCompare(entry.path), entry);
  });

  changes.forEach((change) => {
    const key = normalizeForCompare(change.path);
    if (change.op === 'remove') {
      map.delete(key);
      return;
    }

    if (change.entry) {
      map.set(normalizeForCompare(change.entry.path), change.entry);
    }
  });

  return sortEntries([...map.values()]);
}

function readAssetExplorerLayoutPreference() {
  try {
    const raw = localStorage.getItem(ASSET_EXPLORER_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { projectPaneWidth?: unknown };
    return typeof parsed.projectPaneWidth === 'number' ? parsed.projectPaneWidth : null;
  } catch {
    return null;
  }
}

function saveAssetExplorerLayoutPreference(projectPaneWidth: number) {
  try {
    localStorage.setItem(
      ASSET_EXPLORER_LAYOUT_STORAGE_KEY,
      JSON.stringify({ projectPaneWidth })
    );
  } catch {
    // Ignore storage failures.
  }
}

function collectSkinFolders(sceneNode: SceneNode | null) {
  const folders = new Set<string>();
  const visit = (node: SceneNode | null) => {
    if (!node) return;
    const props = node.props || {};
    const isImageLike = node.type === 'Image' || node.type === 'Sprite';
    const skin = isImageLike && typeof props.skin === 'string' ? props.skin.trim() : '';
    if (skin) {
      const folder = dirname(skin);
      if (folder && folder !== '.' && folder !== '/') {
        folders.add(folder.replace(/^\/+/, ''));
      }
    }

    if (Array.isArray(node.child)) {
      node.child.forEach((child) => visit(child));
    }
  };

  visit(sceneNode);
  return [...folders].sort((a, b) => a.localeCompare(b));
}

export class AssetExplorerPanel extends React.PureComponent<AssetExplorerPanelProps, AssetExplorerPanelState> {
  private projectHeaderRef = React.createRef<HTMLDivElement>();
  private externalHeaderRef = React.createRef<HTMLDivElement>();
  private functionPanelRef = React.createRef<HTMLDivElement>();
  private rootRef = React.createRef<HTMLElement>();
  private dragSplitRef: { startX: number; startWidth: number } | null = null;
  private offDirectoryChanged: (() => void) | null = null;
  private projectWatchPath = '';
  private externalWatchPath = '';

  state: AssetExplorerPanelState = {
    projectFolderOptions: [],
    projectTemporaryFolderOptions: [],
    selectedProjectFolderKey: '',
    projectRootPath: '',
    projectCurrentPath: '',
    projectEntries: [],
    projectLoading: false,
    projectPaneWidth: 0,
    externalFolders: [],
    selectedExternalFolderKey: '',
    externalRootPath: '',
    externalCurrentPath: '',
    externalEntries: [],
    externalLoading: false,
    lastError: ''
  };

  async componentDidMount() {
    const hostApi = this.getHostApi();
    if (hostApi?.onDirectoryChanged) {
      this.offDirectoryChanged = hostApi.onDirectoryChanged(this.handleDirectoryChanged);
    }

    const persistedWidth = readAssetExplorerLayoutPreference();
    if (typeof persistedWidth === 'number') {
      this.setState({ projectPaneWidth: persistedWidth });
    }
    await this.reloadProjectFolders();
    this.applyDefaultPaneWidth();
    window.addEventListener('resize', this.handleWindowResize);
    window.addEventListener('mousemove', this.handleSplitMouseMove);
    window.addEventListener('mouseup', this.handleSplitMouseUp);

    void this.syncProjectWatch();
    void this.syncExternalWatch();
  }

  async componentDidUpdate(prevProps: AssetExplorerPanelProps, prevState: AssetExplorerPanelState) {
    if (prevProps.sceneFilePath !== this.props.sceneFilePath || prevProps.sceneData !== this.props.sceneData) {
      await this.reloadProjectFolders();
    }

    this.ensurePaneWidthBounds();

    if (prevState.projectCurrentPath !== this.state.projectCurrentPath) {
      void this.syncProjectWatch();
    }

    if (
      prevState.externalCurrentPath !== this.state.externalCurrentPath ||
      prevState.externalFolders.length !== this.state.externalFolders.length
    ) {
      void this.syncExternalWatch();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('mousemove', this.handleSplitMouseMove);
    window.removeEventListener('mouseup', this.handleSplitMouseUp);

    if (this.offDirectoryChanged) {
      this.offDirectoryChanged();
      this.offDirectoryChanged = null;
    }

    const hostApi = this.getHostApi();
    if (hostApi?.unwatchDirectory) {
      void hostApi.unwatchDirectory(PROJECT_WATCH_ID);
      void hostApi.unwatchDirectory(EXTERNAL_WATCH_ID);
    }
  }

  handleDirectoryChanged = (payload: unknown) => {
    if (!payload || typeof payload !== 'object') return;
    const event = payload as DirWatchPayload;
    if (!event.watchId || !event.mode) return;

    if (event.watchId === PROJECT_WATCH_ID) {
      if (event.mode === 'reset') {
        this.setState({ projectEntries: sortEntries(event.entries || []) });
        void this.loadProjectEntries();
        return;
      }

      const changes = event.changes || [];
      if (!changes.length) return;
      this.setState((prev) => ({
        projectEntries: applyDirChanges(prev.projectEntries, changes)
      }));
      return;
    }

    if (event.watchId === EXTERNAL_WATCH_ID) {
      if (event.mode === 'reset') {
        this.setState({ externalEntries: sortEntries(event.entries || []) });
        void this.loadExternalEntries();
        return;
      }

      const changes = event.changes || [];
      if (!changes.length) return;
      this.setState((prev) => ({
        externalEntries: applyDirChanges(prev.externalEntries, changes)
      }));
    }
  };

  async syncProjectWatch() {
    const hostApi = this.getHostApi();
    if (!hostApi?.watchDirectory || !hostApi.unwatchDirectory) return;

    const targetPath = this.state.projectCurrentPath;
    if (!targetPath) {
      if (this.projectWatchPath) {
        await hostApi.unwatchDirectory(PROJECT_WATCH_ID);
        this.projectWatchPath = '';
      }
      return;
    }

    if (this.projectWatchPath === targetPath) return;

    if (this.projectWatchPath) {
      await hostApi.unwatchDirectory(PROJECT_WATCH_ID);
    }

    const res = await hostApi.watchDirectory(PROJECT_WATCH_ID, targetPath);
    if ((res as WatchResult).success) {
      this.projectWatchPath = targetPath;
    }
  }

  async syncExternalWatch() {
    const hostApi = this.getHostApi();
    if (!hostApi?.watchDirectory || !hostApi.unwatchDirectory) return;

    const targetPath = this.state.externalCurrentPath;
    const hasExternal = this.state.externalFolders.length > 0;
    if (!hasExternal || !targetPath) {
      if (this.externalWatchPath) {
        await hostApi.unwatchDirectory(EXTERNAL_WATCH_ID);
        this.externalWatchPath = '';
      }
      return;
    }

    if (this.externalWatchPath === targetPath) return;

    if (this.externalWatchPath) {
      await hostApi.unwatchDirectory(EXTERNAL_WATCH_ID);
    }

    const res = await hostApi.watchDirectory(EXTERNAL_WATCH_ID, targetPath);
    if ((res as WatchResult).success) {
      this.externalWatchPath = targetPath;
    }
  }

  handleWindowResize = () => {
    this.ensurePaneWidthBounds();
  };

  handleSplitMouseMove = (e: MouseEvent) => {
    if (!this.dragSplitRef) return;
    const rootWidth = this.rootRef.current?.clientWidth || 0;
    if (!rootWidth) return;

    const minLeft = 220;
    const minRight = 260;
    const functionPanelWidth = this.getFunctionPanelWidth();
    const dividerWidth = 1;
    const maxLeft = Math.max(minLeft, rootWidth - minRight - functionPanelWidth - dividerWidth);
    const next = getNormalizedWidth(this.dragSplitRef.startWidth + (e.clientX - this.dragSplitRef.startX), minLeft, maxLeft);
    this.setState({ projectPaneWidth: next });
  };

  handleSplitMouseUp = () => {
    if (this.state.projectPaneWidth > 0) {
      saveAssetExplorerLayoutPreference(this.state.projectPaneWidth);
    }
    this.dragSplitRef = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  ensurePaneWidthBounds() {
    const rootWidth = this.rootRef.current?.clientWidth || 0;
    if (!rootWidth || !this.state.externalFolders.length) return;

    const minLeft = 220;
    const minRight = 260;
    const functionPanelWidth = this.getFunctionPanelWidth();
    const dividerWidth = 1;
    const maxLeft = Math.max(minLeft, rootWidth - minRight - functionPanelWidth - dividerWidth);
    const nextWidth = getNormalizedWidth(this.state.projectPaneWidth || Math.round(rootWidth * 0.56), minLeft, maxLeft);
    if (nextWidth !== this.state.projectPaneWidth) {
      this.setState({ projectPaneWidth: nextWidth });
    }
  }

  applyDefaultPaneWidth() {
    const rootWidth = this.rootRef.current?.clientWidth || 0;
    if (!rootWidth) return;
    const functionPanelWidth = this.getFunctionPanelWidth();
    const nextWidth = getNormalizedWidth(Math.round(rootWidth * 0.56), 220, Math.max(220, rootWidth - 260 - functionPanelWidth - 1));
    if (!this.state.projectPaneWidth || this.state.projectPaneWidth === DEFAULT_PROJECT_PANE_WIDTH) {
      this.setState({ projectPaneWidth: nextWidth });
    }
  }

  getFunctionPanelWidth() {
    return Math.max(136, this.functionPanelRef.current?.clientWidth || 0);
  }

  getHostApi() {
    return (window as Window & {
      hostApi?: {
        openDirectoryDialog?: () => Promise<string | null>;
        readDirectoryFiles?: (dirPath: string) => Promise<HostApiEntryItem[]>;
        watchDirectory?: (watchId: string, dirPath: string) => Promise<WatchResult>;
        unwatchDirectory?: (watchId: string) => Promise<WatchResult>;
        onDirectoryChanged?: (listener: (payload: unknown) => void) => () => void;
      };
    }).hostApi as
      | {
          openDirectoryDialog?: () => Promise<string | null>;
          readDirectoryFiles?: (dirPath: string) => Promise<HostApiEntryItem[]>;
          watchDirectory?: (watchId: string, dirPath: string) => Promise<WatchResult>;
          unwatchDirectory?: (watchId: string) => Promise<WatchResult>;
          onDirectoryChanged?: (listener: (payload: unknown) => void) => () => void;
        }
      | undefined;
  }

  buildProjectFolderOptions() {
    const assetsRoot = findLayaAssetsFolder(this.props.sceneFilePath);
    if (!assetsRoot) return [] as FolderOption[];

    const options: FolderOption[] = [
      {
        key: assetsRoot,
        label: 'assets',
        path: assetsRoot
      }
    ];

    const skinFolders = collectSkinFolders(this.props.sceneData);
    for (const skinFolder of skinFolders) {
      options.push({
        key: skinFolder,
        label: `assets/${skinFolder}`,
        path: joinPath(assetsRoot, skinFolder)
      });
    }

    return options;
  }

  async readEntries(folderPath: string) {
    const hostApi = this.getHostApi();
    if (!hostApi?.readDirectoryFiles) return [];

    const entries = await hostApi.readDirectoryFiles(folderPath);
    return [...entries].sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
  }

  async reloadProjectFolders() {
    const options = this.buildProjectFolderOptions();
    if (!options.length) {
      this.setState({
        projectFolderOptions: [],
        projectTemporaryFolderOptions: [],
        selectedProjectFolderKey: '',
        projectRootPath: '',
        projectCurrentPath: '',
        projectEntries: [],
        projectLoading: false
      });
      return;
    }

    const keepSelected = options.find((o) => o.key === this.state.selectedProjectFolderKey);
    const nextSelected = keepSelected ? keepSelected.key : options[0].key;
    const selectedOption = options.find((o) => o.key === nextSelected) || options[0];

    this.setState(
      {
        projectFolderOptions: options,
        projectTemporaryFolderOptions: [],
        selectedProjectFolderKey: nextSelected,
        projectRootPath: selectedOption.path,
        projectCurrentPath: selectedOption.path
      },
      () => {
        void this.loadProjectEntries();
      }
    );
  }

  async loadProjectEntries() {
    const currentPath = this.state.projectCurrentPath;
    if (!currentPath) {
      this.setState({ projectEntries: [] });
      return;
    }

    this.setState({ projectLoading: true, lastError: '' });
    try {
      const entries = await this.readEntries(currentPath);
      this.setState({ projectEntries: entries, projectLoading: false });
    } catch (err) {
      this.setState({
        projectEntries: [],
        projectLoading: false,
        lastError: err instanceof Error ? err.message : String(err)
      });
    }
  }

  async loadExternalEntries() {
    const currentPath = this.state.externalCurrentPath;
    if (!currentPath) {
      this.setState({ externalEntries: [] });
      return;
    }

    this.setState({ externalLoading: true, lastError: '' });
    try {
      const entries = await this.readEntries(currentPath);
      this.setState({ externalEntries: entries, externalLoading: false });
    } catch (err) {
      this.setState({
        externalEntries: [],
        externalLoading: false,
        lastError: err instanceof Error ? err.message : String(err)
      });
    }
  }

  onProjectFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    const allOptions = [...this.state.projectFolderOptions, ...this.state.projectTemporaryFolderOptions];
    const selectedOption = allOptions.find((o) => o.key === key);
    if (!selectedOption) return;

    this.setState(
      {
        selectedProjectFolderKey: key,
        projectCurrentPath: selectedOption.path
      },
      () => {
        void this.loadProjectEntries();
      }
    );
  };

  onExternalFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    const selectedFolder = this.state.externalFolders.find((o) => o.key === key);
    if (!selectedFolder) return;

    this.setState(
      {
        selectedExternalFolderKey: key,
        externalRootPath: selectedFolder.path,
        externalCurrentPath: selectedFolder.path
      },
      () => {
        void this.loadExternalEntries();
      }
    );
  };

  addExternalFolder = async () => {
    const hostApi = this.getHostApi();
    if (!hostApi?.openDirectoryDialog) return;

    const picked = await hostApi.openDirectoryDialog();
    if (!picked) return;

    const key = normalizeSlashes(picked);
    const exists = this.state.externalFolders.some((f) => f.key === key);
    if (exists) {
      this.setState(
        {
          selectedExternalFolderKey: key,
          externalRootPath: picked,
          externalCurrentPath: picked
        },
        () => {
          void this.loadExternalEntries();
        }
      );
      return;
    }

    const folder: FolderOption = {
      key,
      path: picked,
      label: basename(picked)
    };

    this.setState(
      (prev) => ({
        externalFolders: [...prev.externalFolders, folder],
        selectedExternalFolderKey: key,
        externalRootPath: picked,
        externalCurrentPath: picked
      }),
      () => {
        void this.loadExternalEntries();
      }
    );
  };

  removeSelectedExternalFolder = () => {
    const current = this.state.selectedExternalFolderKey;
    if (!current) return;

    const rest = this.state.externalFolders.filter((f) => f.key !== current);
    this.setState(
      {
        externalFolders: rest,
        selectedExternalFolderKey: rest[0]?.key || '',
        externalRootPath: rest[0]?.path || '',
        externalCurrentPath: rest[0]?.path || '',
        externalEntries: []
      },
      () => {
        if (rest.length) {
          void this.loadExternalEntries();
        }
      }
    );
  };

  openProjectFolder = (targetPath: string) => {
    if (!isWithinRoot(targetPath, this.state.projectRootPath)) return;

    const baseHit = this.state.projectFolderOptions.find((o) => normalizeForCompare(o.path) === normalizeForCompare(targetPath));
    const tempHit = this.state.projectTemporaryFolderOptions.find((o) => normalizeForCompare(o.path) === normalizeForCompare(targetPath));

    if (baseHit || tempHit) {
      this.setState(
        {
          projectCurrentPath: targetPath,
          selectedProjectFolderKey: (baseHit || tempHit)!.key
        },
        () => {
          void this.loadProjectEntries();
        }
      );
      return;
    }

    const relative = getProjectRelativePath(this.state.projectRootPath, targetPath);
    const tempOption: FolderOption = {
      key: toProjectTemporaryFolderKey(targetPath),
      path: targetPath,
      label: relative ? `assets/${relative}*` : 'assets*'
    };

    this.setState(
      (prev) => {
        const exists = prev.projectTemporaryFolderOptions.some(
          (item) => normalizeForCompare(item.path) === normalizeForCompare(targetPath)
        );
        return {
          projectTemporaryFolderOptions: exists ? prev.projectTemporaryFolderOptions : [...prev.projectTemporaryFolderOptions, tempOption],
          selectedProjectFolderKey: tempOption.key,
          projectCurrentPath: targetPath
        };
      },
      () => {
        void this.loadProjectEntries();
      }
    );
  };

  onProjectBreadcrumbClick = (path: string) => {
    this.openProjectFolder(path);
  };

  openExternalFolder = (targetPath: string) => {
    if (!isWithinRoot(targetPath, this.state.externalRootPath)) return;
    this.setState({ externalCurrentPath: targetPath }, () => {
      void this.loadExternalEntries();
    });
  };

  renderEntryGrid(
    entries: HostApiEntryItem[],
    loading: boolean,
    emptyLabel: string,
    currentPath: string,
    rootPath: string,
    onOpenFolder: (path: string) => void
  ) {
    if (loading) {
      return <div style={{ padding: 12, color: '#8d8d8d', fontSize: 12 }}>加载中...</div>;
    }

    const canBack = canGoParent(currentPath, rootPath);
    const displayEntries: Array<HostApiEntryItem | { name: '..'; path: string; isDirectory: true; isParent: true }> = [];
    if (canBack) {
      displayEntries.push({ name: '..', path: dirname(currentPath), isDirectory: true, isParent: true });
    }
    displayEntries.push(...entries);

    if (!displayEntries.length) {
      return <div style={{ padding: 12, color: '#8d8d8d', fontSize: 12 }}>{emptyLabel}</div>;
    }

    return (
      <div
        style={{
          padding: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 104px)',
          gridAutoRows: '124px',
          justifyContent: 'start',
          alignContent: 'start',
          alignItems: 'start',
          gap: 10,
          overflow: 'auto',
          minHeight: 0,
          flex: 1
        }}
      >
        {displayEntries.map((item) => {
          const isParentEntry = (item as { isParent?: boolean }).isParent === true;
          const extension = item.isDirectory ? 'folder' : extname(item.name);
          const isImageFile = !item.isDirectory && IMAGE_EXTENSIONS.has(extension);
          return (
            <div
              key={`${item.path}:${item.name}`}
              onDoubleClick={() => {
                if (item.isDirectory) {
                  onOpenFolder(item.path);
                }
              }}
              style={{
                border: '1px solid #3a3d43',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.02)',
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                cursor: item.isDirectory ? 'pointer' : 'default',
                alignSelf: 'start'
              }}
              title={item.path}
            >
              <div
                style={{
                  height: 68,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#1a1b1f',
                  border: '1px solid #2f3238',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}
              >
                {isImageFile ? (
                  <img
                    src={toAssetUrl(item.path)}
                    alt={item.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 26, color: item.isDirectory ? '#d7b76d' : '#90a8c8', lineHeight: 1 }}>
                    {item.isDirectory ? '📁' : '📄'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#c9c9c9', lineHeight: 1.2 }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isParentEntry ? '..' : stripExt(item.name)}
                </div>
                <div style={{ color: '#8d8d8d' }}>{isParentEntry ? 'parent' : extension || '(no ext)'}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  beginSplitDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!this.state.externalFolders.length) return;
    e.preventDefault();
    this.dragSplitRef = {
      startX: e.clientX,
      startWidth: this.state.projectPaneWidth || Math.round((this.rootRef.current?.clientWidth || 0) * 0.56)
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  renderBreadcrumbArea(
    rootPath: string,
    currentPath: string,
    availableWidth: number,
    onClick: (path: string) => void
  ) {
    const items = buildBreadcrumbItems(rootPath, currentPath);
    const visible = getVisibleBreadcrumbItems(items, availableWidth);
    return renderBreadcrumbButtons(visible, onClick);
  }

  renderFunctionPanel() {
    return (
      <div
        ref={this.functionPanelRef}
        style={{
          flex: '0 0 auto',
          width: 'max-content',
          minWidth: 136,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #333',
          background: 'rgba(31,32,35,0.96)'
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            fontSize: 12,
            color: '#c0c0c0',
            borderBottom: '1px solid #333',
            letterSpacing: 0.4
          }}
        >
          功能区
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
          <button
            type="button"
            onClick={this.addExternalFolder}
            style={{
              background: '#2b2d33',
              border: '1px solid #3b3d44',
              color: '#d0d0d0',
              borderRadius: 4,
              fontSize: 12,
              padding: '4px 10px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            导入外部文件夹
          </button>
        </div>
      </div>
    );
  }

  render() {
    const { height, minHeight } = this.props;
    const {
      projectFolderOptions,
      projectTemporaryFolderOptions,
      selectedProjectFolderKey,
      projectRootPath,
      projectCurrentPath,
      projectEntries,
      projectLoading,
      externalFolders,
      selectedExternalFolderKey,
      externalRootPath,
      externalCurrentPath,
      externalEntries,
      externalLoading,
      lastError
    } = this.state;

    const hasExternalFolders = externalFolders.length > 0;
    const projectSelectOptions = [...projectFolderOptions, ...projectTemporaryFolderOptions];
    const projectBreadcrumbWidth = Math.max(0, (this.projectHeaderRef.current?.clientWidth || 0) - 340);
    const externalBreadcrumbWidth = Math.max(0, (this.externalHeaderRef.current?.clientWidth || 0) - 250);
    const functionPanelWidth = this.getFunctionPanelWidth();
    const projectPaneWidth = hasExternalFolders
      ? getNormalizedWidth(
          this.state.projectPaneWidth,
          220,
          Math.max(220, (this.rootRef.current?.clientWidth || 0) - 260 - functionPanelWidth - 1)
        )
      : 0;

    return (
      <section
        ref={this.rootRef}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height,
          minHeight,
          background: 'linear-gradient(180deg, rgba(32,33,36,0.96) 0%, rgba(24,25,27,0.96) 100%)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            fontSize: 12,
            color: '#c0c0c0',
            borderBottom: '1px solid #333',
            letterSpacing: 0.4
          }}
        >
          ASSET EXPLORER
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div
            style={hasExternalFolders
              ? { width: projectPaneWidth, minWidth: 0, display: 'flex', flexDirection: 'column' }
              : { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}
          >
            <div
              ref={this.projectHeaderRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderBottom: '1px solid #333'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '0 0 auto' }}>
                <span style={{ fontSize: 12, color: '#b6b6b6', flex: '0 0 auto' }}>工程资源</span>
                <select
                  value={selectedProjectFolderKey}
                  onChange={this.onProjectFolderChange}
                  style={{
                    background: '#1f2023',
                    border: '1px solid #3b3d44',
                    color: '#d0d0d0',
                    borderRadius: 4,
                    fontSize: 12,
                    padding: '4px 6px',
                    minWidth: 180
                  }}
                >
                  {projectSelectOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                {this.renderBreadcrumbArea(projectRootPath, projectCurrentPath, projectBreadcrumbWidth, this.onProjectBreadcrumbClick)}
              </div>
            </div>
            {this.renderEntryGrid(
              projectEntries,
              projectLoading,
              '当前目录为空',
              projectCurrentPath,
              projectRootPath,
              this.openProjectFolder
            )}
          </div>

          {hasExternalFolders && (
            <>
              <div
                onMouseDown={this.beginSplitDrag}
                style={{ width: 6, cursor: 'col-resize', background: 'rgba(255,255,255,0.04)', borderLeft: '1px solid #333', borderRight: '1px solid #333' }}
              />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div
                  ref={this.externalHeaderRef}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderBottom: '1px solid #333'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '0 0 auto' }}>
                    <span style={{ fontSize: 12, color: '#b6b6b6', flex: '0 0 auto' }}>外部资源</span>
                    <select
                      value={selectedExternalFolderKey}
                      onChange={this.onExternalFolderChange}
                      style={{
                        background: '#1f2023',
                        border: '1px solid #3b3d44',
                        color: '#d0d0d0',
                        borderRadius: 4,
                        fontSize: 12,
                        padding: '4px 6px',
                        minWidth: 140
                      }}
                    >
                      {externalFolders.map((folder) => (
                        <option key={folder.key} value={folder.key}>
                          {folder.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                    {this.renderBreadcrumbArea(externalRootPath, externalCurrentPath, externalBreadcrumbWidth, this.openExternalFolder)}
                  </div>
                  <div style={{ flex: '0 0 auto' }}>
                    <button
                      type="button"
                      onClick={this.removeSelectedExternalFolder}
                      style={{
                        background: '#2b2d33',
                        border: '1px solid #3b3d44',
                        color: '#c8c8c8',
                        borderRadius: 4,
                        fontSize: 12,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        flex: '0 0 auto'
                      }}
                    >
                      移除
                    </button>
                  </div>
                </div>
                {this.renderEntryGrid(
                  externalEntries,
                  externalLoading,
                  '当前目录为空',
                  externalCurrentPath,
                  externalRootPath,
                  this.openExternalFolder
                )}
              </div>
            </>
          )}

          {this.renderFunctionPanel()}
        </div>

        {lastError && (
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid #333',
              background: 'rgba(0,0,0,0.15)',
              fontSize: 11,
              color: '#ff8f8f'
            }}
          >
            {lastError}
          </div>
        )}
      </section>
    );
  }
}
