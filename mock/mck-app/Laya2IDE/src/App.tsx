import React, { useEffect, useRef } from 'react';
import { SceneCanvas } from './components/Viewport/SceneCanvas';
import { HierarchyPanel } from './components/Hierarchy/HierarchyPanel';
import { InspectorPanel } from './components/Inspector/InspectorPanel';
import { AssetExplorerPanel } from './components/AssetExplorer/AssetExplorerPanel';
import { formatSceneForSave } from './utils/sceneFormatter';
import { preloadImages } from './utils/sceneUtils';
import { useSceneStore } from './store/sceneStore';
import { SceneNode } from './types/scene';

const LAYOUT_STORAGE_KEY = 'laya2ide.layout.v1';
const LEFT_MIN_WIDTH = 180;
const RIGHT_MIN_WIDTH = 220;
const CENTER_MIN_WIDTH = 320;
const BOTTOM_MIN_HEIGHT = 180;
const TOP_MIN_HEIGHT = 220;
const RESIZER_SIZE = 4;

type DragMode = 'left' | 'right' | 'bottom' | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readLayoutPreference() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { leftWidth?: unknown; rightWidth?: unknown; bottomHeight?: unknown };
    const leftWidth = typeof parsed.leftWidth === 'number' ? parsed.leftWidth : null;
    const rightWidth = typeof parsed.rightWidth === 'number' ? parsed.rightWidth : null;
    const bottomHeight = typeof parsed.bottomHeight === 'number' ? parsed.bottomHeight : null;
    if (leftWidth === null || rightWidth === null || bottomHeight === null) return null;
    return { leftWidth, rightWidth, bottomHeight };
  } catch {
    return null;
  }
}

export function App() {
  const sceneData = useSceneStore((state) => state.sceneData);
  const errorMsg = useSceneStore((state) => state.errorMsg);
  const isDirty = useSceneStore((state) => state.isDirty);
  const privateNodeState = useSceneStore((state) => state.privateNodeState);
  const setSceneData = useSceneStore((state) => state.setSceneData);
  const setErrorMsg = useSceneStore((state) => state.setErrorMsg);
  const initializePrivateNodeState = useSceneStore((state) => state.initializePrivateNodeState);
  const markSaved = useSceneStore((state) => state.markSaved);
  const bumpVersion = useSceneStore((state) => state.bumpVersion);
  const undoLast = useSceneStore((state) => state.undoLast);
  const redoLast = useSceneStore((state) => state.redoLast);

  const originalFilePath = useRef('');
  const scenePath = useRef('');
  const privateStateKey = useRef('');
  const privateStateLoaded = useRef(false);
  const rootLayoutRef = useRef<HTMLDivElement | null>(null);
  const topLayoutRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startLeft: number;
    startRight: number;
    startBottom: number;
  } | null>(null);

  const layoutPrefRef = useRef(readLayoutPreference());
  const [leftPaneWidth, setLeftPaneWidth] = React.useState(layoutPrefRef.current?.leftWidth ?? 240);
  const [rightPaneWidth, setRightPaneWidth] = React.useState(layoutPrefRef.current?.rightWidth ?? 280);
  const [bottomPaneHeight, setBottomPaneHeight] = React.useState(layoutPrefRef.current?.bottomHeight ?? 300);
  const [sceneFilePath, setSceneFilePath] = React.useState('');

  const getTabId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tabId');
  };

  useEffect(() => {
    const loadScene = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const rawPayload = urlParams.get('payload');
      if (!rawPayload) {
        setErrorMsg('No payload provided');
        return;
      }

      try {
        const payloadObj = JSON.parse(decodeURIComponent(rawPayload));
        originalFilePath.current = payloadObj.filePath;
        setSceneFilePath(payloadObj.filePath);
        const normPath = originalFilePath.current.replace(/\\/g, '/');
        scenePath.current = normPath.match(/^[a-zA-Z]:\//) ? '/' + normPath : normPath;

        const response = await fetch('workspace-file://' + scenePath.current);
        if (!response.ok) throw new Error('File load failed');

        const data = await response.json();
        setSceneData(data);

        const hostApi = (window as any).hostApi;
        const appId = window.location.hostname || 'unknown-app';
        privateStateKey.current = `scene:${originalFilePath.current}`;
        let persistedPrivateState: any = null;

        if (hostApi?.getPrivateState) {
          const saved = await hostApi.getPrivateState(appId, privateStateKey.current);
          if (saved && typeof saved === 'object' && saved.byId && saved.pathToId) {
            persistedPrivateState = saved;
          }
        }

        initializePrivateNodeState(data, persistedPrivateState);
        privateStateLoaded.current = true;

        await preloadImages(data, scenePath.current);
        bumpVersion();
      } catch (err: any) {
        setErrorMsg(err.toString());
      }
    };

    loadScene();
  }, [bumpVersion, initializePrivateNodeState, setErrorMsg, setSceneData]);

  useEffect(() => {
    if (!privateStateLoaded.current || !privateStateKey.current) return;

    const hostApi = (window as any).hostApi;
    if (!hostApi?.setPrivateState) return;

    const appId = window.location.hostname || 'unknown-app';
    hostApi.setPrivateState(appId, privateStateKey.current, privateNodeState);
  }, [privateNodeState]);

  useEffect(() => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        leftWidth: leftPaneWidth,
        rightWidth: rightPaneWidth,
        bottomHeight: bottomPaneHeight
      })
    );
  }, [bottomPaneHeight, leftPaneWidth, rightPaneWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      if (dragState.mode === 'left') {
        const topWidth = topLayoutRef.current?.clientWidth || 0;
        if (topWidth <= 0) return;
        const maxLeft = Math.max(LEFT_MIN_WIDTH, topWidth - dragState.startRight - CENTER_MIN_WIDTH - RESIZER_SIZE * 2);
        const next = clamp(dragState.startLeft + (e.clientX - dragState.startX), LEFT_MIN_WIDTH, maxLeft);
        setLeftPaneWidth(next);
        return;
      }

      if (dragState.mode === 'right') {
        const topWidth = topLayoutRef.current?.clientWidth || 0;
        if (topWidth <= 0) return;
        const maxRight = Math.max(RIGHT_MIN_WIDTH, topWidth - dragState.startLeft - CENTER_MIN_WIDTH - RESIZER_SIZE * 2);
        const next = clamp(dragState.startRight - (e.clientX - dragState.startX), RIGHT_MIN_WIDTH, maxRight);
        setRightPaneWidth(next);
        return;
      }

      if (dragState.mode === 'bottom') {
        const rootHeight = rootLayoutRef.current?.clientHeight || 0;
        if (rootHeight <= 0) return;
        const maxBottom = Math.max(BOTTOM_MIN_HEIGHT, rootHeight - TOP_MIN_HEIGHT - RESIZER_SIZE);
        const next = clamp(dragState.startBottom - (e.clientY - dragState.startY), BOTTOM_MIN_HEIGHT, maxBottom);
        setBottomPaneHeight(next);
      }
    };

    const onMouseUp = () => {
      dragStateRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const beginResize = (mode: Exclude<DragMode, null>) => (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragStateRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: leftPaneWidth,
      startRight: rightPaneWidth,
      startBottom: bottomPaneHeight
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = mode === 'bottom' ? 'row-resize' : 'col-resize';
  };

  useEffect(() => {
    window.parent.postMessage({ type: 'set-dirty', dirty: isDirty, tabId: getTabId() }, '*');
  }, [isDirty]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Keep native undo in input fields.
        if (isEditableTarget(e.target)) return;

        // Cmd/Ctrl+Shift+Z => redo
        if (e.shiftKey) {
          e.preventDefault();
          redoLast();
          return;
        }

        e.preventDefault();
        undoLast();
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        redoLast();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!isDirty || !sceneData || !originalFilePath.current) return;

        window.parent.postMessage(
          {
            type: 'save-file',
            filePath: originalFilePath.current,
            content: formatSceneForSave(sceneData),
            tabId: getTabId()
          },
          '*'
        );

        markSaved();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDirty, sceneData, markSaved, redoLast, undoLast]);

  return (
    <div
      ref={rootLayoutRef}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        background: '#1e1e1e',
        color: '#d4d4d4',
        fontFamily: 'Consolas, monospace',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0
        }}
      >
        <SceneCanvas sceneData={sceneData} />
      </div>

      {errorMsg && (
        <div
          style={{
            color: '#ff5555',
            padding: 20,
            position: 'absolute',
            top: 0,
            left: 0,
            background: 'rgba(0,0,0,0.8)',
            width: '100%',
            zIndex: 100
          }}
        >
          {errorMsg}
        </div>
      )}

      <section
        ref={topLayoutRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `calc(100% - ${bottomPaneHeight + RESIZER_SIZE}px)`,
          display: 'flex',
          minHeight: TOP_MIN_HEIGHT,
          pointerEvents: 'none',
          zIndex: 2
        }}
      >
        <aside
          style={{
            width: leftPaneWidth,
            borderRight: '1px solid #333',
            background: 'rgba(37, 37, 38, 0.96)',
            backdropFilter: 'blur(2px)',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto'
          }}
        >
          <div style={{ padding: '10px 12px', fontSize: 12, color: '#c0c0c0', borderBottom: '1px solid #333' }}>
            HIERARCHY
          </div>
          <div style={{ minHeight: 0, flex: 1 }}>
            <HierarchyPanel />
          </div>
        </aside>

        <div
          onMouseDown={beginResize('left')}
          style={{
            width: RESIZER_SIZE,
            cursor: 'col-resize',
            background: '#2c2c2c',
            borderLeft: '1px solid #242424',
            borderRight: '1px solid #242424',
            pointerEvents: 'auto'
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }} />

        <div
          onMouseDown={beginResize('right')}
          style={{
            width: RESIZER_SIZE,
            cursor: 'col-resize',
            background: '#2c2c2c',
            borderLeft: '1px solid #242424',
            borderRight: '1px solid #242424',
            pointerEvents: 'auto'
          }}
        />

        <aside
          style={{
            width: rightPaneWidth,
            borderLeft: '1px solid #333',
            background: 'rgba(37, 37, 38, 0.96)',
            backdropFilter: 'blur(2px)',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto'
          }}
        >
          <div style={{ padding: '10px 12px', fontSize: 12, color: '#c0c0c0', borderBottom: '1px solid #333' }}>
            INSPECTOR
          </div>
          <div style={{ minHeight: 0, flex: 1 }}>
            <InspectorPanel />
          </div>
        </aside>
      </section>

      <div
        onMouseDown={beginResize('bottom')}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `calc(100% - ${bottomPaneHeight + RESIZER_SIZE}px)`,
          height: RESIZER_SIZE,
          cursor: 'row-resize',
          background: '#2c2c2c',
          borderTop: '1px solid #242424',
          borderBottom: '1px solid #242424',
          zIndex: 2
        }}
      />

      <AssetExplorerPanel
        height={bottomPaneHeight}
        minHeight={BOTTOM_MIN_HEIGHT}
        sceneFilePath={sceneFilePath}
        sceneData={sceneData as SceneNode | null}
      />
    </div>
  );
}
