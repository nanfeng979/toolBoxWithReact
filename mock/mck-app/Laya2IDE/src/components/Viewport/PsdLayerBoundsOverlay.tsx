import React, { useRef, useEffect } from 'react';

interface PsdLayerBounds {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PsdLayerBoundsOverlayProps {
  bounds: PsdLayerBounds | null;
}

export function PsdLayerBoundsOverlay({ bounds }: PsdLayerBoundsOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置canvas大小
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!bounds || bounds.width <= 0) return;

    // 绘制边界框
    // 注意：这里假设 SceneCanvas 使用相同的缩放和偏移
    // 为了简化，我们使用固定缩放1.0和居中偏移
    const scale = 1.0;
    const offsetX = (canvas.width - bounds.width * scale) / 2 - bounds.left * scale;
    const offsetY = (canvas.height - bounds.height * scale) / 2 - bounds.top * scale;

    const x = bounds.left * scale + offsetX;
    const y = bounds.top * scale + offsetY;
    const w = bounds.width * scale;
    const h = bounds.height * scale;

    // 绘制蓝色边框
    ctx.strokeStyle = '#007acc';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);

    // 绘制角点手柄
    const handleSize = 6;
    ctx.fillStyle = '#007acc';
    
    // 四个角
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(x + w - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(x - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(x + w - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize);

    // 绘制图层名称
    ctx.fillStyle = '#007acc';
    ctx.font = 'bold 11px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    
    const textX = x;
    const textY = y - 4;
    
    // 背景
    const textWidth = ctx.measureText(bounds.name).width + 8;
    ctx.fillStyle = 'rgba(0, 122, 204, 0.9)';
    ctx.fillRect(textX, textY - 14, textWidth, 14);
    
    // 文字
    ctx.fillStyle = '#ffffff';
    ctx.fillText(bounds.name, textX + 4, textY - 2);

  }, [bounds]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!bounds) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
