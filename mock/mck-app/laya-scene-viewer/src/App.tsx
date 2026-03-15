import React, { useEffect, useState, useRef } from 'react';
import { CanvasViewport } from './components/CanvasViewport';
import { Inspector } from './components/Inspector';
import { preloadImages } from './utils/sceneUtils';
import { SceneNode, HitResult } from './types';

export function App() {
  const [sceneData, setSceneData] = useState<SceneNode | null>(null);
  const [selectedHit, setSelectedHit] = useState<HitResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  
  const originalFilePath = useRef('');
  const scenePath = useRef('');
  const isDirty = useRef(false);

  const setDirty = (dirty: boolean) => {
    if (isDirty.current === dirty) return;
    isDirty.current = dirty;
    window.parent.postMessage({ type: 'set-dirty', dirty: isDirty.current, tabId: getTabId() }, '*');
  };

  const getTabId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tabId');
  };

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
      setVersion(v => v + 1);

    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  useEffect(() => {
    loadScene();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty.current) {
          window.parent.postMessage({ 
            type: 'save-file', 
            filePath: originalFilePath.current, 
            content: JSON.stringify(sceneData, null, 4),
            tabId: getTabId()
          }, '*');
          setDirty(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sceneData]);

  const handlePropChange = async (key: string, value: any) => {
    if (!selectedHit || !sceneData) return;
    const node = selectedHit.node;
    node.props = node.props || {};
    node.props[key] = value;
    
    setDirty(true);
    setVersion(v => v + 1);
    setSceneData({ ...sceneData });

    if (key === 'skin' || key === 'texture') {
      await preloadImages(node, scenePath.current);
      setVersion(v => v + 1);
    }
  };

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1e1e1e',
      color: '#ccc',
      fontFamily: 'monospace',
      overflow: 'hidden'
    }}>
      {errorMsg && (
        <div style={{
          color: '#ff5555',
          padding: 20,
          position: 'absolute',
          top: 0, left: 0,
          background: 'rgba(0,0,0,0.8)',
          width: '100%',
          zIndex: 100
        }}>
          {errorMsg}
        </div>
      )}
      
      <CanvasViewport 
        sceneData={sceneData} 
        selectedHit={selectedHit} 
        onSelectNode={setSelectedHit} 
        version={version} 
      />
      
      <div style={{
        width: 300,
        backgroundColor: '#252526',
        borderLeft: '1px solid #333',
        overflowY: 'auto',
        padding: 15,
        boxSizing: 'border-box'
      }}>
        <Inspector selectedHit={selectedHit} onChangeProp={handlePropChange} />
      </div>
    </div>
  );
}
