import React from 'react';
import { AssetBreadcrumbArea } from './AssetBreadcrumbArea';
import { AssetEntryGrid } from './AssetEntryGrid';
import { AssetFunctionPanel } from './AssetFunctionPanel';
import { DEFAULT_PROJECT_PANE_WIDTH, EXTERNAL_WATCH_ID, PROJECT_WATCH_ID } from './assetExplorerConstants';
import { applyDirChanges, collectSkinFolders, sortEntries } from './assetExplorerEntryUtils';
import {
  assetExplorerBreadcrumbWrapStyle,
  assetExplorerContentStyle,
  assetExplorerErrorStyle,
  assetExplorerExternalActionWrapStyle,
  assetExplorerExternalPaneStyle,
  assetExplorerExternalSelectStyle,
  assetExplorerHeaderLabelStyle,
  assetExplorerHeaderLeftStyle,
  assetExplorerHeaderStyle,
  assetExplorerProjectSelectStyle,
  assetExplorerRemoveButtonStyle,
  assetExplorerSplitStyle,
  assetExplorerTitleStyle,
  getAssetExplorerProjectPaneStyle,
  getAssetExplorerRootStyle,
  assetExplorerDropMaskStyle
} from './AssetExplorerPanel.styles';
import {
  basename,
  extname,
  findLayaAssetsFolder,
  getNormalizedWidth,
  getProjectRelativePath,
  isWithinRoot,
  joinPath,
  normalizeForCompare,
  normalizeSlashes,
  toProjectTemporaryFolderKey
} from './assetExplorerPathUtils';
import { readAssetExplorerLayoutPreference, saveAssetExplorerLayoutPreference } from './assetExplorerStorage';
import {
  AssetExplorerHostApi,
  AssetExplorerPanelProps,
  AssetExplorerPanelState,
  DirWatchPayload,
  FolderOption,
  WatchResult
} from './AssetExplorerTypes';

export class AssetExplorerPanel extends React.PureComponent<AssetExplorerPanelProps, AssetExplorerPanelState> {
  private projectHeaderRef = React.createRef<HTMLDivElement>();
  private externalHeaderRef = React.createRef<HTMLDivElement>();
  private functionPanelRef = React.createRef<HTMLDivElement>();
  private rootRef = React.createRef<HTMLElement>();
  private dragSplitRef: { startX: number; startWidth: number } | null = null;
  private offDirectoryChanged: (() => void) | null = null;
  private projectWatchPath = '';
  private externalWatchPath = '';
  private dropDepth = 0;

  state: AssetExplorerPanelState = {
    projectFolderOptions: [],
    projectTemporaryFolderOptions: [],
    selectedProjectFolderKey: '',
    projectRootPath: '',
    projectCurrentPath: '',
    projectEntries: [],
    projectLoading: false,
    projectPaneWidth: 0,
    selectedProjectFilePath: '',
    assetCacheToken: 0,
    externalFolders: [],
    selectedExternalFolderKey: '',
    externalRootPath: '',
    externalCurrentPath: '',
    externalEntries: [],
    externalLoading: false,
    selectedExternalFilePath: '',
    batchReplaceEnabled: false,
    batchReplaceLabel: '批量替换同名图片',
    lastError: '',
    isDragActive: false
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

    if (
      prevState.projectEntries !== this.state.projectEntries ||
      prevState.externalEntries !== this.state.externalEntries
    ) {
      void this.evaluateBatchReplaceStatus();
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
        projectEntries: applyDirChanges(prev.projectEntries, changes),
        assetCacheToken: prev.assetCacheToken + 1
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
        externalEntries: applyDirChanges(prev.externalEntries, changes),
        assetCacheToken: prev.assetCacheToken + 1
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
    return (window as Window & { hostApi?: AssetExplorerHostApi }).hostApi;
  }

  reloadProjectEntries = () => {
    void this.loadProjectEntries();
  };

  reloadExternalEntries = () => {
    void this.loadExternalEntries();
  };

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
    return sortEntries(entries);
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
      this.reloadProjectEntries
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
        projectCurrentPath: selectedOption.path,
        selectedProjectFilePath: ''
      },
      this.reloadProjectEntries
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
        externalCurrentPath: selectedFolder.path,
        selectedExternalFilePath: ''
      },
      this.reloadExternalEntries
    );
  };

  addExternalFolder = async () => {
    const hostApi = this.getHostApi();
    if (!hostApi?.openDirectoryDialog) return;

    const picked = await hostApi.openDirectoryDialog();
    if (!picked) return;

    this.addExternalFolderFromPath(picked);
  };

  addExternalFolderFromPath = (picked: string) => {
    const key = normalizeSlashes(picked);
    const exists = this.state.externalFolders.some((f) => f.key === key);
    if (exists) {
      this.setState(
        {
          selectedExternalFolderKey: key,
          externalRootPath: picked,
          externalCurrentPath: picked,
          selectedExternalFilePath: ''
        },
        this.reloadExternalEntries
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
        externalCurrentPath: picked,
        selectedExternalFilePath: ''
      }),
      this.reloadExternalEntries
    );
  };

  hasFileDrag = (event: React.DragEvent<HTMLElement>) => {
    const dt = event.dataTransfer;
    if (!dt) return false;
    if (dt.items && dt.items.length) {
      return Array.from(dt.items).some((item) => item.kind === 'file');
    }
    return dt.files && dt.files.length > 0;
  };

  handleDragEnter = (event: React.DragEvent<HTMLElement>) => {
    if (!this.hasFileDrag(event)) return;
    event.preventDefault();
    this.dropDepth += 1;
    if (!this.state.isDragActive) {
      this.setState({ isDragActive: true });
    }
  };

  handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (!this.hasFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  handleDragLeave = (event: React.DragEvent<HTMLElement>) => {
    if (!this.hasFileDrag(event)) return;
    event.preventDefault();
    this.dropDepth = Math.max(0, this.dropDepth - 1);
    if (this.dropDepth === 0 && this.state.isDragActive) {
      this.setState({ isDragActive: false });
    }
  };

  handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    if (!this.hasFileDrag(event)) return;
    event.preventDefault();
    this.dropDepth = 0;
    if (this.state.isDragActive) {
      this.setState({ isDragActive: false });
    }

    const dt = event.dataTransfer;
    if (!dt) return;

    const pickedPaths = new Set<string>();

    if (dt.items && dt.items.length) {
      for (const item of Array.from(dt.items)) {
        if (item.kind !== 'file') continue;
        const entry = (item as any).webkitGetAsEntry?.();
        if (entry && !entry.isDirectory) continue;
        const file = item.getAsFile() as (File & { path?: string }) | null;
        const filePath = file?.path;
        if (filePath) pickedPaths.add(filePath);
      }
    }

    if (pickedPaths.size === 0 && dt.files && dt.files.length) {
      for (const file of Array.from(dt.files) as Array<File & { path?: string }>) {
        if (file.path) pickedPaths.add(file.path);
      }
    }

    if (!pickedPaths.size) return;

    pickedPaths.forEach((path) => this.addExternalFolderFromPath(path));
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
        externalEntries: [],
        selectedExternalFilePath: ''
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
          selectedProjectFolderKey: (baseHit || tempHit)!.key,
          selectedProjectFilePath: ''
        },
        this.reloadProjectEntries
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
          projectCurrentPath: targetPath,
          selectedProjectFilePath: ''
        };
      },
      this.reloadProjectEntries
    );
  };

  onProjectBreadcrumbClick = (path: string) => {
    this.openProjectFolder(path);
  };

  openExternalFolder = (targetPath: string) => {
    if (!isWithinRoot(targetPath, this.state.externalRootPath)) return;
    this.setState({ externalCurrentPath: targetPath, selectedExternalFilePath: '' }, this.reloadExternalEntries);
  };

  selectProjectFile = (path: string) => {
    this.setState({ selectedProjectFilePath: path });
  };

  clearProjectSelection = () => {
    if (!this.state.selectedProjectFilePath) return;
    this.setState({ selectedProjectFilePath: '' });
  };

  selectExternalFile = (path: string) => {
    this.setState({ selectedExternalFilePath: path });
  };

  clearExternalSelection = () => {
    if (!this.state.selectedExternalFilePath) return;
    this.setState({ selectedExternalFilePath: '' });
  };

  applyNewFile = async () => {
    const { selectedProjectFilePath, selectedExternalFilePath } = this.state;
    if (!selectedProjectFilePath || !selectedExternalFilePath) return;

    const hostApi = this.getHostApi();
    if (!hostApi?.copyFile) {
      this.setState({ lastError: 'Host API copyFile is not available.' });
      return;
    }

    this.setState({ lastError: '' });
    const result = await hostApi.copyFile(selectedExternalFilePath, selectedProjectFilePath);
    if (!result?.success) {
      this.setState({ lastError: result?.error || 'Copy failed.' });
      return;
    }

    this.setState((prev) => ({
      selectedProjectFilePath: '',
      selectedExternalFilePath: '',
      assetCacheToken: prev.assetCacheToken + 1
    }));
    void this.loadProjectEntries();
  };

  applyBatchReplace = async () => {
    const { projectEntries, externalEntries, projectCurrentPath, externalCurrentPath } = this.state;
    if (!projectCurrentPath || !externalCurrentPath) return;

    const hostApi = this.getHostApi();
    if (!hostApi?.copyFile) {
      this.setState({ lastError: 'Host API copyFile is not available.' });
      return;
    }

    const rightMap = new Map<string, string>();
    externalEntries.forEach((entry) => {
      if (entry.isDirectory) return;
      if (!this.isSupportedImage(entry.name)) return;
      rightMap.set(entry.name.toLowerCase(), entry.path);
    });

    const matches = projectEntries.filter(
      (entry) => !entry.isDirectory && this.isSupportedImage(entry.name) && rightMap.has(entry.name.toLowerCase())
    );
    if (!matches.length) {
      this.setState({ lastError: 'No matching files to replace.' });
      return;
    }

    this.setState({ lastError: '' });
    let failedCount = 0;
    for (const entry of matches) {
      const srcPath = rightMap.get(entry.name.toLowerCase());
      if (!srcPath) continue;
      const result = await hostApi.copyFile(srcPath, entry.path);
      if (!result?.success) {
        failedCount += 1;
      }
    }

    this.setState((prev) => ({
      selectedProjectFilePath: '',
      selectedExternalFilePath: '',
      assetCacheToken: prev.assetCacheToken + 1,
      lastError: failedCount ? `Replaced with ${failedCount} failures.` : ''
    }));
    void this.loadProjectEntries();
  };

  isSupportedImage = (name: string) => {
    const ext = extname(name);
    return ext === '.png' || ext === '.jpg' || ext === '.jpeg';
  };

  evaluateBatchReplaceStatus = async () => {
    const { projectEntries, externalEntries } = this.state;
    const hostApi = this.getHostApi();
    if (!hostApi?.getFileInfo) {
      this.setState({ batchReplaceEnabled: false, batchReplaceLabel: '批量替换同名图片' });
      return;
    }

    const rightMap = new Map<string, string>();
    externalEntries.forEach((entry) => {
      if (entry.isDirectory) return;
      if (!this.isSupportedImage(entry.name)) return;
      rightMap.set(entry.name.toLowerCase(), entry.path);
    });

    const pairs = projectEntries
      .filter((entry) => !entry.isDirectory && this.isSupportedImage(entry.name))
      .map((entry) => {
        const right = rightMap.get(entry.name.toLowerCase());
        if (!right) return null;
        return { left: entry.path, right };
      })
      .filter(Boolean) as Array<{ left: string; right: string }>;

    if (!pairs.length) {
      this.setState({ batchReplaceEnabled: false, batchReplaceLabel: '批量替换同名图片' });
      return;
    }

    this.setState({ batchReplaceEnabled: false, batchReplaceLabel: '对比图片信息中...' });
    let allSame = true;
    for (const pair of pairs) {
      const [leftInfo, rightInfo] = await Promise.all([
        hostApi.getFileInfo(pair.left),
        hostApi.getFileInfo(pair.right)
      ]);

      if (!leftInfo?.success || !rightInfo?.success) {
        allSame = false;
        break;
      }

      const same =
        leftInfo.size === rightInfo.size &&
        leftInfo.md5 === rightInfo.md5 &&
        leftInfo.width === rightInfo.width &&
        leftInfo.height === rightInfo.height;
      if (!same) {
        allSame = false;
        break;
      }
    }

    this.setState({ batchReplaceEnabled: !allSame, batchReplaceLabel: '批量替换同名图片' });
  };

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
      lastError,
      isDragActive,
      selectedProjectFilePath,
      selectedExternalFilePath,
      assetCacheToken,
      batchReplaceEnabled,
      batchReplaceLabel
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
        onDragEnter={this.handleDragEnter}
        onDragOver={this.handleDragOver}
        onDragLeave={this.handleDragLeave}
        onDrop={this.handleDrop}
        style={getAssetExplorerRootStyle(height, minHeight)}
      >
        {isDragActive && (
          <div style={assetExplorerDropMaskStyle} />
        )}
        <div style={assetExplorerTitleStyle}>
          ASSET EXPLORER
        </div>

        <div style={assetExplorerContentStyle}>
          <div style={getAssetExplorerProjectPaneStyle(hasExternalFolders, projectPaneWidth)}>
            <div
              ref={this.projectHeaderRef}
              style={assetExplorerHeaderStyle}
            >
              <div style={assetExplorerHeaderLeftStyle}>
                <span style={assetExplorerHeaderLabelStyle}>工程资源</span>
                <select
                  value={selectedProjectFolderKey}
                  onChange={this.onProjectFolderChange}
                  style={assetExplorerProjectSelectStyle}
                >
                  {projectSelectOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={assetExplorerBreadcrumbWrapStyle}>
                <AssetBreadcrumbArea
                  rootPath={projectRootPath}
                  currentPath={projectCurrentPath}
                  availableWidth={projectBreadcrumbWidth}
                  onClick={this.onProjectBreadcrumbClick}
                />
              </div>
            </div>
            <AssetEntryGrid
              entries={projectEntries}
              loading={projectLoading}
              emptyLabel="当前目录为空"
              currentPath={projectCurrentPath}
              rootPath={projectRootPath}
              onOpenFolder={this.openProjectFolder}
              selectedFilePath={selectedProjectFilePath}
              onSelectFile={this.selectProjectFile}
              onClearSelection={this.clearProjectSelection}
              assetCacheToken={assetCacheToken}
            />
          </div>

          {hasExternalFolders && (
            <>
              <div onMouseDown={this.beginSplitDrag} style={assetExplorerSplitStyle} />
              <div style={assetExplorerExternalPaneStyle}>
                <div
                  ref={this.externalHeaderRef}
                  style={assetExplorerHeaderStyle}
                >
                  <div style={assetExplorerHeaderLeftStyle}>
                    <span style={assetExplorerHeaderLabelStyle}>外部资源</span>
                    <select
                      value={selectedExternalFolderKey}
                      onChange={this.onExternalFolderChange}
                      style={assetExplorerExternalSelectStyle}
                    >
                      {externalFolders.map((folder) => (
                        <option key={folder.key} value={folder.key}>
                          {folder.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={assetExplorerBreadcrumbWrapStyle}>
                    <AssetBreadcrumbArea
                      rootPath={externalRootPath}
                      currentPath={externalCurrentPath}
                      availableWidth={externalBreadcrumbWidth}
                      onClick={this.openExternalFolder}
                    />
                  </div>
                  <div style={assetExplorerExternalActionWrapStyle}>
                    <button
                      type="button"
                      onClick={this.removeSelectedExternalFolder}
                      style={assetExplorerRemoveButtonStyle}
                    >
                      移除
                    </button>
                  </div>
                </div>
                <AssetEntryGrid
                  entries={externalEntries}
                  loading={externalLoading}
                  emptyLabel="当前目录为空"
                  currentPath={externalCurrentPath}
                  rootPath={externalRootPath}
                  onOpenFolder={this.openExternalFolder}
                  selectedFilePath={selectedExternalFilePath}
                  onSelectFile={this.selectExternalFile}
                  onClearSelection={this.clearExternalSelection}
                  assetCacheToken={assetCacheToken}
                />
              </div>
            </>
          )}

          <AssetFunctionPanel
            ref={this.functionPanelRef}
            onAddExternalFolder={this.addExternalFolder}
            onApplyNewFile={this.applyNewFile}
            canApplyNewFile={Boolean(selectedProjectFilePath && selectedExternalFilePath)}
            onApplyBatchReplace={this.applyBatchReplace}
            canApplyBatchReplace={batchReplaceEnabled}
            batchReplaceLabel={batchReplaceLabel}
          />
        </div>

        {lastError && (
          <div style={assetExplorerErrorStyle}>
            {lastError}
          </div>
        )}
      </section>
    );
  }
}
