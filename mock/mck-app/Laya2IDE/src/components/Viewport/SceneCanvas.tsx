import React, { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { HitResult, SceneNode } from '../../types/scene';
import { imageCache } from '../../utils/sceneUtils';

interface SceneCanvasProps {
  sceneData: SceneNode | null;
}

export function SceneCanvas({ sceneData }: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedHit = useSceneStore((state) => state.selectedHit);
  const setSelectedHit = useSceneStore((state) => state.setSelectedHit);
  const version = useSceneStore((state) => state.version);

  const [scale, setScale] = useState(1.0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== container.clientWidth) canvas.width = container.clientWidth;
    if (canvas.height !== container.clientHeight) canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw editor background grid in screen space.
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    if (!sceneData) return;

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    const drawNode = (node: SceneNode, px: number, py: number) => {
      const p = node.props || {};
      const x = px + (p.x || 0);
      const y = py + (p.y || 0);
      const w = p.width || 0;
      const h = p.height || 0;

      if (node.type === 'Scene') {
        ctx.fillStyle = p.sceneColor || '#000000';
        ctx.fillRect(x, y, p.width || 800, p.height || 600);
      } else if (node.type === 'Label') {
        const text = (p.text || '').replace(/\\n/g, '\n');
        const fontSize = p.fontSize || 20;
        ctx.font = fontSize + 'px sans-serif';
        ctx.fillStyle = p.color || '#ffffff';
        ctx.textBaseline = 'top';
        let ax = 0;
        if (p.align === 'center') {
          ctx.textAlign = 'center';
          ax = w / 2;
        } else if (p.align === 'right') {
          ctx.textAlign = 'right';
          ax = w;
        } else {
          ctx.textAlign = 'left';
        }

        const lines = text.split('\n');
        let sy = y;
        if (p.valign === 'middle') sy = y + (h - lines.length * fontSize * 1.2) / 2;
        else if (p.valign === 'bottom') sy = y + h - lines.length * fontSize * 1.2;

        lines.forEach((line, i) => ctx.fillText(line, x + ax, sy + i * fontSize * 1.2));
      } else if ((node.type === 'Image' || node.type === 'Sprite') && (p.skin || p.texture)) {
        const img = imageCache[p.skin || p.texture];
        if (img) ctx.drawImage(img, x, y, w || img.width, h || img.height);
      }

      if (node.child) {
        for (const c of node.child) drawNode(c, x, y);
      }
    };

    drawNode(sceneData, 0, 0);

    if (selectedHit) {
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 1.5 / scale;
      ctx.strokeRect(selectedHit.x, selectedHit.y, selectedHit.w, selectedHit.h);
    }

    ctx.restore();
  }, [sceneData, selectedHit, scale, offset, version]);

  useEffect(() => {
    const handleResize = () => setOffset((prev) => ({ ...prev }));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const hitTest = (node: SceneNode, px: number, py: number, targetX: number, targetY: number): HitResult | null => {
    const p = node.props || {};
    const x = px + (p.x || 0);
    const y = py + (p.y || 0);
    const w = p.width || 0;
    const h = p.height || 0;

    if (node.child) {
      for (let i = node.child.length - 1; i >= 0; i -= 1) {
        const hit = hitTest(node.child[i], x, y, targetX, targetY);
        if (hit) return hit;
      }
    }

    let actualW = w;
    let actualH = h;

    if ((node.type === 'Image' || node.type === 'Sprite') && (p.skin || p.texture)) {
      const img = imageCache[p.skin || p.texture];
      if (img) {
        actualW = w || img.width;
        actualH = h || img.height;
      }
    } else if (node.type === 'Label') {
      const fontSize = p.fontSize || 20;
      const lines = (p.text || '').replace(/\\n/g, '\n').split('\n');
      actualH = h || lines.length * fontSize * 1.2;
      actualW = w || Math.max(...lines.map((line) => line.length * fontSize * 0.6));
    } else if (node.type === 'Scene') {
      actualW = p.width || 800;
      actualH = p.height || 600;
    }

    if (actualW === 0 && actualH === 0) return null;
    if (targetX >= x && targetX <= x + actualW && targetY >= y && targetY <= y + actualH) {
      return { node, x, y, w: actualW, h: actualH };
    }
    return null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
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

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      isPanningRef.current = true;
      setIsPanning(true);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    } else if (e.button === 0 && sceneData) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = (e.clientX - rect.left - offset.x) / scale;
      const mouseY = (e.clientY - rect.top - offset.y) / scale;
      const hit = hitTest(sceneData, 0, 0, mouseX, mouseY);
      setSelectedHit(hit);
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        setOffset((prev) => ({
          x: prev.x + (e.clientX - lastMouseRef.current.x),
          y: prev.y + (e.clientY - lastMouseRef.current.y)
        }));
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        isPanningRef.current = false;
        setIsPanning(false);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        style={{ width: '100%', height: '100%', display: 'block', cursor: isPanning ? 'grabbing' : 'default' }}
      />
    </div>
  );
}
