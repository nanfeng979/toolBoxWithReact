import { HitResult, SceneNode } from '../types/scene';
import { imageCache } from '../utils/sceneUtils';

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export class SceneRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2d context for scene renderer');
    }

    this.canvas = canvas;
    this.ctx = ctx;
  }

  resize(width: number, height: number) {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  render(sceneData: SceneNode | null, transform: ViewTransform) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    this.drawEditorGrid(width, height);

    if (!sceneData) return;

    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);
    this.drawNode(sceneData, 0, 0);
    ctx.restore();
  }

  private drawEditorGrid(width: number, height: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    const gridSize = 24;

    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private drawNode(node: SceneNode, px: number, py: number) {
    const ctx = this.ctx;
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

      let alignOffsetX = 0;
      if (p.align === 'center') {
        ctx.textAlign = 'center';
        alignOffsetX = w / 2;
      } else if (p.align === 'right') {
        ctx.textAlign = 'right';
        alignOffsetX = w;
      } else {
        ctx.textAlign = 'left';
      }

      const lines = text.split('\n');
      let startY = y;
      if (p.valign === 'middle') startY = y + (h - lines.length * fontSize * 1.2) / 2;
      else if (p.valign === 'bottom') startY = y + h - lines.length * fontSize * 1.2;

      lines.forEach((line: string, i: number) => {
        ctx.fillText(line, x + alignOffsetX, startY + i * fontSize * 1.2);
      });
    } else if ((node.type === 'Image' || node.type === 'Sprite') && (p.skin || p.texture)) {
      const skin = p.skin || p.texture;
      const img = imageCache[skin];
      if (img) {
        ctx.drawImage(img, x, y, w || img.width, h || img.height);
      }
    }

    if (!node.child) return;

    for (const child of node.child) {
      this.drawNode(child, x, y);
    }
  }
}

export class GizmoRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2d context for gizmo renderer');
    }

    this.canvas = canvas;
    this.ctx = ctx;
  }

  resize(width: number, height: number) {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  render(selectedHit: HitResult | null, transform: ViewTransform) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!selectedHit) return;

    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);

    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 1.5 / transform.scale;
    ctx.strokeRect(selectedHit.x, selectedHit.y, selectedHit.w, selectedHit.h);

    ctx.restore();
  }
}

export function hitTestSceneNode(
  node: SceneNode,
  px: number,
  py: number,
  targetX: number,
  targetY: number
): HitResult | null {
  const p = node.props || {};
  const x = px + (p.x || 0);
  const y = py + (p.y || 0);
  const w = p.width || 0;
  const h = p.height || 0;

  if (node.child) {
    for (let i = node.child.length - 1; i >= 0; i -= 1) {
      const hit = hitTestSceneNode(node.child[i], x, y, targetX, targetY);
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
    actualW = w || Math.max(...lines.map((line: string) => line.length * fontSize * 0.6));
  } else if (node.type === 'Scene') {
    actualW = p.width || 800;
    actualH = p.height || 600;
  }

  if (actualW === 0 && actualH === 0) return null;

  if (targetX >= x && targetX <= x + actualW && targetY >= y && targetY <= y + actualH) {
    return { node, x, y, w: actualW, h: actualH };
  }

  return null;
}

export function resolveHitByNode(
  root: SceneNode,
  targetNode: SceneNode,
  px: number = 0,
  py: number = 0
): HitResult | null {
  const p = root.props || {};
  const x = px + (p.x || 0);
  const y = py + (p.y || 0);
  const w = p.width || 0;
  const h = p.height || 0;

  let actualW = w;
  let actualH = h;

  if ((root.type === 'Image' || root.type === 'Sprite') && (p.skin || p.texture)) {
    const img = imageCache[p.skin || p.texture];
    if (img) {
      actualW = w || img.width;
      actualH = h || img.height;
    }
  } else if (root.type === 'Label') {
    const fontSize = p.fontSize || 20;
    const lines = (p.text || '').replace(/\\n/g, '\n').split('\n');
    actualH = h || lines.length * fontSize * 1.2;
    actualW = w || Math.max(...lines.map((line: string) => line.length * fontSize * 0.6));
  } else if (root.type === 'Scene') {
    actualW = p.width || 800;
    actualH = p.height || 600;
  }

  if (root === targetNode) {
    return {
      node: root,
      x,
      y,
      w: actualW,
      h: actualH
    };
  }

  if (!root.child) return null;

  for (const child of root.child) {
    const result = resolveHitByNode(child, targetNode, x, y);
    if (result) return result;
  }

  return null;
}
