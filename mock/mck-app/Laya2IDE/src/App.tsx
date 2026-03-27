import React, { useEffect, useRef } from 'react';
import { SceneCanvas } from './components/Viewport/SceneCanvas';
import { HierarchyPlaceholder } from './components/Hierarchy/HierarchyPlaceholder';
import { InspectorPlaceholder } from './components/Inspector/InspectorPlaceholder';
import { preloadImages } from './utils/sceneUtils';
import { useSceneStore } from './store/sceneStore';

export function App() {
  const sceneData = useSceneStore((state) => state.sceneData);
  const errorMsg = useSceneStore((state) => state.errorMsg);
  const setSceneData = useSceneStore((state) => state.setSceneData);
  const setErrorMsg = useSceneStore((state) => state.setErrorMsg);
  const bumpVersion = useSceneStore((state) => state.bumpVersion);

  const scenePath = useRef('');

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
        const originalFilePath = payloadObj.filePath;
        const normPath = originalFilePath.replace(/\\/g, '/');
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
        <HierarchyPlaceholder />
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
        <InspectorPlaceholder />
      </aside>
    </div>
  );
}
