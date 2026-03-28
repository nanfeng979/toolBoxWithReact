import React, { useEffect, useRef } from 'react';
import { SceneCanvas } from './components/Viewport/SceneCanvas';
import { HierarchyPanel } from './components/Hierarchy/HierarchyPanel';
import { InspectorPanel } from './components/Inspector/InspectorPanel';
import { preloadImages } from './utils/sceneUtils';
import { useSceneStore } from './store/sceneStore';

export function App() {
  const sceneData = useSceneStore((state) => state.sceneData);
  const errorMsg = useSceneStore((state) => state.errorMsg);
  const isDirty = useSceneStore((state) => state.isDirty);
  const setSceneData = useSceneStore((state) => state.setSceneData);
  const setErrorMsg = useSceneStore((state) => state.setErrorMsg);
  const markSaved = useSceneStore((state) => state.markSaved);
  const bumpVersion = useSceneStore((state) => state.bumpVersion);
  const undoLast = useSceneStore((state) => state.undoLast);
  const redoLast = useSceneStore((state) => state.redoLast);

  const originalFilePath = useRef('');
  const scenePath = useRef('');

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
        const normPath = originalFilePath.current.replace(/\\/g, '/');
        scenePath.current = normPath.match(/^[a-zA-Z]:\//) ? '/' + normPath : normPath;

        const response = await fetch('workspace-file://' + scenePath.current);
        if (!response.ok) throw new Error('File load failed');

        const data = await response.json();
        setSceneData(data);

        await preloadImages(data, scenePath.current);
        bumpVersion();
      } catch (err: any) {
        setErrorMsg(err.toString());
      }
    };

    loadScene();
  }, [bumpVersion, setErrorMsg, setSceneData]);

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
            content: JSON.stringify(sceneData, null, 4),
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
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: '#1e1e1e',
        color: '#d4d4d4',
        fontFamily: 'Consolas, monospace',
        overflow: 'hidden'
      }}
    >
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

      <aside
        style={{
          width: 240,
          borderRight: '1px solid #333',
          background: '#252526'
        }}
      >
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#c0c0c0', borderBottom: '1px solid #333' }}>
          HIERARCHY
        </div>
        <HierarchyPanel />
      </aside>

      <main style={{ flex: 1, position: 'relative' }}>
        <SceneCanvas sceneData={sceneData} />
      </main>

      <aside
        style={{
          width: 280,
          borderLeft: '1px solid #333',
          background: '#252526'
        }}
      >
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#c0c0c0', borderBottom: '1px solid #333' }}>
          INSPECTOR
        </div>
        <InspectorPanel />
      </aside>
    </div>
  );
}
