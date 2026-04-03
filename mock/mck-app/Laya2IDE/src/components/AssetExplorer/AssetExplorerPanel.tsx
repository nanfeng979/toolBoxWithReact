import React from 'react';
import { AssetBreadcrumbArea } from './AssetBreadcrumbArea';
import { AssetEntryGrid } from './AssetEntryGrid';
import { AssetFunctionPanel } from './AssetFunctionPanel';
import { DEFAULT_PROJECT_PANE_WIDTH, EXTERNAL_WATCH_ID, PROJECT_WATCH_ID } from './assetExplorerConstants';
import { applyDirChanges, collectSkinFolders, sortEntries } from './assetExplorerEntryUtils';
import {
  basename,
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
    return (window as Window & { hostApi?: AssetExplorerHostApi }).hostApi;
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
            />
          </div>

          {hasExternalFolders && (
            <>
              <div
                onMouseDown={this.beginSplitDrag}
                style={{
                  width: 6,
                  cursor: 'col-resize',
                  background: 'rgba(255,255,255,0.04)',
                  borderLeft: '1px solid #333',
                  borderRight: '1px solid #333'
                }}
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
                    <AssetBreadcrumbArea
                      rootPath={externalRootPath}
                      currentPath={externalCurrentPath}
                      availableWidth={externalBreadcrumbWidth}
                      onClick={this.openExternalFolder}
                    />
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
                <AssetEntryGrid
                  entries={externalEntries}
                  loading={externalLoading}
                  emptyLabel="当前目录为空"
                  currentPath={externalCurrentPath}
                  rootPath={externalRootPath}
                  onOpenFolder={this.openExternalFolder}
                />
              </div>
            </>
          )}

          <AssetFunctionPanel ref={this.functionPanelRef} onAddExternalFolder={this.addExternalFolder} />
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
