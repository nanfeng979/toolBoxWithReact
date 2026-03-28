import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore.ts';
import { SceneNode } from '../../types/scene';
import { GizmoRenderer, hitTestSceneNode, SceneRenderer } from '../../core/Renderer';

interface SceneCanvasProps {
  sceneData: SceneNode | null;
}

export function SceneCanvas({ sceneData }: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneCanvasRef = useRef<HTMLCanvasElement>(null);
  const gizmoCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRendererRef = useRef<SceneRenderer | null>(null);
  const gizmoRendererRef = useRef<GizmoRenderer | null>(null);
  const selectedHit = useSceneStore((state) => state.selectedHit);
  const setSelectedHit = useSceneStore((state) => state.setSelectedHit);
  const updateSelectedNodeProps = useSceneStore((state) => state.updateSelectedNodeProps);
  const privateNodeState = useSceneStore((state) => state.privateNodeState);
  const version = useSceneStore((state) => state.version);

  const [scale, setScale] = useState(1.0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isPanningRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const interactionModeRef = useRef<'none' | 'pan' | 'drag'>('none');
  const dragStartRef = useRef({ sceneX: 0, sceneY: 0, nodeX: 0, nodeY: 0 });
  const dragSessionRef = useRef<{ groupId: string | null }>({ groupId: null });
  const keyboardMoveSessionRef = useRef<{ groupId: string | null; lastAt: number }>({ groupId: null, lastAt: 0 });
  const privateStateByPath = useMemo(() => {
    const map: Record<
      string,
      {
        nodeVisible: boolean;
        nodeOpacity: number;
        referenceVisible: boolean;
        referenceOpacity: number;
        affectChildren: boolean;
      }
    > = {};
    Object.entries(privateNodeState.pathToId).forEach(([path, id]) => {
      const nodeState = privateNodeState.byId[id];
      if (!nodeState) return;
      map[path] = {
        nodeVisible: nodeState.nodeVisible,
        nodeOpacity: nodeState.nodeOpacity,
        referenceVisible: nodeState.referenceVisible,
        referenceOpacity: nodeState.referenceOpacity,
        affectChildren: nodeState.affectChildren
      };
    });
    return map;
  }, [privateNodeState]);

  useEffect(() => {
    if (sceneData && sceneData.type === 'Scene' && containerRef.current) {
      const p = sceneData.props || {};
      const container = containerRef.current;
      setOffset({
        x: (container.clientWidth - (p.width || 640)) / 2,
        y: (container.clientHeight - (p.height || 1136)) / 2
      });
    }
  }, [sceneData]);

  useEffect(() => {
    const sceneCanvas = sceneCanvasRef.current;
    const gizmoCanvas = gizmoCanvasRef.current;
    const container = containerRef.current;
    if (!sceneCanvas || !gizmoCanvas || !container) return;

    if (!sceneRendererRef.current) {
      sceneRendererRef.current = new SceneRenderer(sceneCanvas);
    }
    if (!gizmoRendererRef.current) {
      gizmoRendererRef.current = new GizmoRenderer(gizmoCanvas);
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    sceneRendererRef.current.resize(width, height);
    gizmoRendererRef.current.resize(width, height);

    const transform = {
      scale,
      offsetX: offset.x,
      offsetY: offset.y
    };

    sceneRendererRef.current.render(sceneData, transform, {
      byPath: privateStateByPath
    });
    gizmoRendererRef.current.render(selectedHit, transform);
  }, [sceneData, selectedHit, scale, offset, version, privateStateByPath]);

  useEffect(() => {
    const handleResize = () => setOffset((prev) => ({ ...prev }));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = gizmoCanvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
      setScale((oldScale) => {
        const newScale = Math.max(0.1, Math.min(5, oldScale + delta));
        setOffset((prev) => ({
          x: prev.x - (e.clientX - prev.x) * (newScale / oldScale - 1),
          y: prev.y - (e.clientY - prev.y) * (newScale / oldScale - 1)
        }));
        return newScale;
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      let dirX = 0;
      let dirY = 0;
      if (e.key === 'ArrowLeft') dirX = -1;
      else if (e.key === 'ArrowRight') dirX = 1;
      else if (e.key === 'ArrowUp') dirY = -1;
      else if (e.key === 'ArrowDown') dirY = 1;
      else return;

      if (!selectedHit?.node) return;
      e.preventDefault();

      const now = Date.now();
      const maxSessionGapMs = 300;
      const prevSession = keyboardMoveSessionRef.current;
      const keepSession = prevSession.groupId && now - prevSession.lastAt <= maxSessionGapMs;
      const groupId = keepSession ? prevSession.groupId! : `kb-move-${now}`;
      keyboardMoveSessionRef.current = { groupId, lastAt: now };

      // Zoomed out => larger step. Zoomed in => smaller step. Integer and minimum 1.
      const step = Math.max(1, Math.round(2 / Math.max(scale, 0.05)));
      const p = selectedHit.node.props || {};
      const nextX = Math.round(Number(p.x || 0) + dirX * step);
      const nextY = Math.round(Number(p.y || 0) + dirY * step);

      updateSelectedNodeProps({ x: nextX, y: nextY }, { groupId });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scale, selectedHit, updateSelectedNodeProps]);

  const stopPanning = () => {
    isPanningRef.current = false;
    activePointerIdRef.current = null;
    interactionModeRef.current = 'none';
    dragSessionRef.current.groupId = null;
    setIsPanning(false);
    setIsDragging(false);
  };

  const getScenePointFromClient = (clientX: number, clientY: number) => {
    const rect = gizmoCanvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      isPanningRef.current = true;
      activePointerIdRef.current = e.pointerId;
      interactionModeRef.current = 'pan';
      setIsPanning(true);
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    } else if (e.button === 0 && sceneData) {
      const scenePoint = getScenePointFromClient(e.clientX, e.clientY);
      if (!scenePoint) return;

      const hit = hitTestSceneNode(sceneData, 0, 0, scenePoint.x, scenePoint.y, privateStateByPath);
      setSelectedHit(hit);

      // Drag starts only when pressing down on an already-selected node.
      if (hit && selectedHit && hit.node === selectedHit.node) {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        activePointerIdRef.current = e.pointerId;
        interactionModeRef.current = 'drag';
        dragSessionRef.current.groupId = `drag-${Date.now()}`;
        setIsDragging(true);

        const p = hit.node.props || {};
        dragStartRef.current = {
          sceneX: scenePoint.x,
          sceneY: scenePoint.y,
          nodeX: Number(p.x || 0),
          nodeY: Number(p.y || 0)
        };
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    if (interactionModeRef.current === 'pan') {
      // Middle button bitmask: 4. If released during capture, stop panning.
      if ((e.buttons & 4) === 0) {
        stopPanning();
        return;
      }

      const deltaX = e.clientX - lastPointerRef.current.x;
      const deltaY = e.clientY - lastPointerRef.current.y;
      if (deltaX === 0 && deltaY === 0) return;

      setOffset((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (interactionModeRef.current === 'drag') {
      // Left button bitmask: 1. If released during capture, stop dragging.
      if ((e.buttons & 1) === 0) {
        stopPanning();
        return;
      }

      const scenePoint = getScenePointFromClient(e.clientX, e.clientY);
      if (!scenePoint) return;

      const deltaX = scenePoint.x - dragStartRef.current.sceneX;
      const deltaY = scenePoint.y - dragStartRef.current.sceneY;

      updateSelectedNodeProps({
        x: Math.round(dragStartRef.current.nodeX + deltaX),
        y: Math.round(dragStartRef.current.nodeY + deltaY)
      }, { groupId: dragSessionRef.current.groupId || undefined });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    if (interactionModeRef.current === 'pan' && (e.button === 1 || (e.buttons & 4) === 0)) {
      stopPanning();
      return;
    }

    if (interactionModeRef.current === 'drag' && (e.button === 0 || (e.buttons & 1) === 0)) {
      stopPanning();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      stopPanning();
    }
  };

  const handleAuxClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={sceneCanvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: isPanning ? 'grabbing' : 'default' }}
      />
      <canvas
        ref={gizmoCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onAuxClick={handleAuxClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isPanning || isDragging ? 'grabbing' : 'default',
          position: 'absolute',
          left: 0,
          top: 0,
          touchAction: 'none'
        }}
      />
    </div>
  );
}
