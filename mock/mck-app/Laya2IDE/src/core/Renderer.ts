import { HitResult, SceneNode } from '../types/scene';
import { imageCache } from '../utils/sceneUtils';

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface PrivateRenderState {
  nodeVisible: boolean;
  nodeOpacity: number;
  referenceVisible: boolean;
  referenceOpacity: number;
  affectChildren: boolean;
}

export interface ReferenceLayerOptions {
  byPath?: Record<string, PrivateRenderState>;
}

interface NodeBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_PRIVATE_RENDER_STATE: PrivateRenderState = {
  nodeVisible: true,
  nodeOpacity: 1,
  referenceVisible: true,
  referenceOpacity: 1,
  affectChildren: false
};

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  measureCtx = canvas.getContext('2d');
  return measureCtx;
}

function measureLabelText(text: string, fontSize: number): { width: number; height: number; lineSpacing: number } {
  const lines = text.replace(/\\n/g, '\n').split('\n');
  const ctx = getMeasureContext();
  const lineSpacing = fontSize * 1.2;

  if (!ctx) {
    return {
      width: Math.max(...lines.map((line) => line.length * fontSize * 0.6), 0),
      height: (lines.length - 1) * lineSpacing + fontSize,
      lineSpacing
    };
  }

  ctx.font = `${fontSize}px sans-serif`;
  let maxWidth = 0;
  let maxLineHeight = 0;

  for (const line of lines) {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, metrics.width);
    const lineHeight = (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0);
    maxLineHeight = Math.max(maxLineHeight, lineHeight || fontSize);
  }

  return {
    width: maxWidth,
    height: (lines.length - 1) * lineSpacing + maxLineHeight,
    lineSpacing
  };
}

function isPrivateControlledNode(node: SceneNode) {
  return node.type === 'Label' || node.type === 'Image' || node.type === 'Sprite';
}

function isReferenceControlledNode(node: SceneNode) {
  return node.type === 'Scene' || node.type === 'View' || node.type === 'Dialog';
}

function getSceneBgImage(node: SceneNode) {
  const props = node.props || {};
  const sceneBgKey = typeof props.sceneBg === 'string' ? props.sceneBg : '';
  return sceneBgKey ? imageCache[sceneBgKey] : undefined;
}

function composePrivateRenderState(parentState: PrivateRenderState, localState: PrivateRenderState): PrivateRenderState {
  return {
    nodeVisible: parentState.nodeVisible && localState.nodeVisible,
    nodeOpacity: parentState.nodeOpacity * localState.nodeOpacity,
    referenceVisible: parentState.referenceVisible && localState.referenceVisible,
    referenceOpacity: parentState.referenceOpacity * localState.referenceOpacity,
    affectChildren: localState.affectChildren
  };
}

function resolveNodeBounds(node: SceneNode, px: number, py: number): NodeBounds {
  const p = node.props || {};
  const x = px + (p.x || 0);
  const y = py + (p.y || 0);
  const w = p.width || 0;
  const h = p.height || 0;

  let actualW = w;
  let actualH = h;
  let actualX = x;
  let actualY = y;

  if ((node.type === 'Image' || node.type === 'Sprite') && (p.skin || p.texture)) {
    const img = imageCache[p.skin || p.texture];
    if (img) {
      actualW = w || img.width;
      actualH = h || img.height;
    }
  } else if (node.type === 'Label') {
    const fontSize = p.fontSize || 20;
    const metrics = measureLabelText(p.text || '', fontSize);
    actualH = h || metrics.height;
    actualW = w || metrics.width;

    if (!w) {
      if (p.align === 'center') actualX = x - actualW / 2;
      else if (p.align === 'right') actualX = x - actualW;
    }
  } else if (node.type === 'Scene' || node.type === 'View' || node.type === 'Dialog') {
    actualW = p.width || (node.type === 'Scene' ? 800 : 0);
    actualH = p.height || (node.type === 'Scene' ? 600 : 0);
  }

  return { x: actualX, y: actualY, w: actualW, h: actualH };
}

interface BringToFrontState {
  path: string | null;
  deferred: null | {
    node: SceneNode;
    px: number;
    py: number;
    path: string;
    inheritedPrivateState: PrivateRenderState;
  };
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

  render(
    sceneData: SceneNode | null,
    transform: ViewTransform,
    referenceLayer?: ReferenceLayerOptions,
    bringToFrontPath?: string | null
  ) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);
    this.drawCanvasBase(width, height);
    this.drawEditorGrid(width, height);

    if (!sceneData) return;

    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);
    const bringToFront: BringToFrontState = {
      path: bringToFrontPath ?? null,
      deferred: null
    };
    this.drawNode(sceneData, 0, 0, '0', referenceLayer, DEFAULT_PRIVATE_RENDER_STATE, bringToFront);
    if (bringToFront.deferred) {
      this.drawNode(
        bringToFront.deferred.node,
        bringToFront.deferred.px,
        bringToFront.deferred.py,
        bringToFront.deferred.path,
        referenceLayer,
        bringToFront.deferred.inheritedPrivateState,
        { path: null, deferred: null }
      );
    }
    ctx.restore();
  }

  private drawCanvasBase(width: number, height: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, width, height);
  }

  private drawEditorGrid(width: number, height: number) {
    const ctx = this.ctx;
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

  private drawNode(
    node: SceneNode,
    px: number,
    py: number,
    path: string,
    referenceLayer: ReferenceLayerOptions | undefined,
    inheritedPrivateState: PrivateRenderState,
    bringToFront: BringToFrontState
  ) {
    const ctx = this.ctx;
    const p = node.props || {};
    const x = px + (p.x || 0);
    const y = py + (p.y || 0);
    const w = p.width || 0;
    const h = p.height || 0;
    const localPrivateState = referenceLayer?.byPath?.[path] ?? DEFAULT_PRIVATE_RENDER_STATE;
    const effectivePrivateState = composePrivateRenderState(inheritedPrivateState, localPrivateState);
    const childInheritedState = effectivePrivateState.affectChildren ? effectivePrivateState : DEFAULT_PRIVATE_RENDER_STATE;

    if (bringToFront.path && bringToFront.path === path) {
      bringToFront.deferred = {
        node,
        px,
        py,
        path,
        inheritedPrivateState
      };
      return;
    }

    if (effectivePrivateState.nodeVisible) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, Math.max(0, effectivePrivateState.nodeOpacity));

      if (node.type === 'Scene' || node.type === 'View' || node.type === 'Dialog') {
        const drawW = p.width || (node.type === 'Scene' ? 800 : 0);
        const drawH = p.height || (node.type === 'Scene' ? 600 : 0);
        ctx.fillStyle = p.sceneColor || '#000000';
        ctx.fillRect(x, y, drawW, drawH);
      } else if (node.type === 'Label') {
        const text = (p.text || '').replace(/\\n/g, '\n');
        const fontSize = p.fontSize || 20;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = p.color || '#000000';
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

        lines.forEach((line: string, index: number) => {
          ctx.fillText(line, x + alignOffsetX, startY + index * fontSize * 1.2);
        });
      } else if ((node.type === 'Image' || node.type === 'Sprite') && (p.skin || p.texture)) {
        const skin = p.skin || p.texture;
        const img = imageCache[skin];
        if (img) {
          ctx.drawImage(img, x, y, w || img.width, h || img.height);
        }
      }

      ctx.restore();
    }

    if (isReferenceControlledNode(node) && effectivePrivateState.referenceVisible) {
      const bgImage = getSceneBgImage(node);
      if (bgImage) {
        ctx.save();
        ctx.globalAlpha *= Math.min(1, Math.max(0, effectivePrivateState.referenceOpacity));
        ctx.drawImage(bgImage, x, y);
        ctx.restore();
      }
    }

    if (!node.child) return;

    node.child.forEach((child, index) => {
      this.drawNode(child, x, y, `${path}.${index}`, referenceLayer, childInheritedState, bringToFront);
    });
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
  targetY: number,
  privateByPath?: Record<string, PrivateRenderState>,
  path: string = '0'
): HitResult | null {
  return hitTestSceneNodeInternal(node, px, py, targetX, targetY, privateByPath, path, DEFAULT_PRIVATE_RENDER_STATE);
}

function hitTestSceneNodeInternal(
  node: SceneNode,
  px: number,
  py: number,
  targetX: number,
  targetY: number,
  privateByPath: Record<string, PrivateRenderState> | undefined,
  path: string,
  inheritedPrivateState: PrivateRenderState
): HitResult | null {
  const p = node.props || {};
  const x = px + (p.x || 0);
  const y = py + (p.y || 0);
  const localPrivateState = privateByPath?.[path] ?? DEFAULT_PRIVATE_RENDER_STATE;
  const effectivePrivateState = composePrivateRenderState(inheritedPrivateState, localPrivateState);
  const childInheritedState = effectivePrivateState.affectChildren ? effectivePrivateState : DEFAULT_PRIVATE_RENDER_STATE;

  if (node.child) {
    for (let i = node.child.length - 1; i >= 0; i -= 1) {
      const hit = hitTestSceneNodeInternal(node.child[i], x, y, targetX, targetY, privateByPath, `${path}.${i}`, childInheritedState);
      if (hit) return hit;
    }
  }

  if (!effectivePrivateState.nodeVisible) return null;

  const bounds = resolveNodeBounds(node, px, py);
  if (bounds.w === 0 && bounds.h === 0) return null;

  if (targetX >= bounds.x && targetX <= bounds.x + bounds.w && targetY >= bounds.y && targetY <= bounds.y + bounds.h) {
    return { node, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h, path };
  }

  return null;
}

export function hitTestSceneNodeAll(
  node: SceneNode,
  px: number,
  py: number,
  targetX: number,
  targetY: number,
  privateByPath?: Record<string, PrivateRenderState>,
  path: string = '0'
): HitResult[] {
  const hits: HitResult[] = [];
  hitTestSceneNodeAllInternal(node, px, py, targetX, targetY, privateByPath, path, DEFAULT_PRIVATE_RENDER_STATE, hits);
  return hits;
}

function hitTestSceneNodeAllInternal(
  node: SceneNode,
  px: number,
  py: number,
  targetX: number,
  targetY: number,
  privateByPath: Record<string, PrivateRenderState> | undefined,
  path: string,
  inheritedPrivateState: PrivateRenderState,
  hits: HitResult[]
) {
  const p = node.props || {};
  const x = px + (p.x || 0);
  const y = py + (p.y || 0);
  const localPrivateState = privateByPath?.[path] ?? DEFAULT_PRIVATE_RENDER_STATE;
  const effectivePrivateState = composePrivateRenderState(inheritedPrivateState, localPrivateState);
  const childInheritedState = effectivePrivateState.affectChildren ? effectivePrivateState : DEFAULT_PRIVATE_RENDER_STATE;

  if (node.child) {
    for (let i = node.child.length - 1; i >= 0; i -= 1) {
      hitTestSceneNodeAllInternal(node.child[i], x, y, targetX, targetY, privateByPath, `${path}.${i}`, childInheritedState, hits);
    }
  }

  if (!effectivePrivateState.nodeVisible) return;

  const bounds = resolveNodeBounds(node, px, py);
  if (bounds.w === 0 && bounds.h === 0) return;

  if (targetX >= bounds.x && targetX <= bounds.x + bounds.w && targetY >= bounds.y && targetY <= bounds.y + bounds.h) {
    hits.push({ node, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h, path });
  }
}

export function resolveHitByNode(
  root: SceneNode,
  targetNode: SceneNode,
  px: number = 0,
  py: number = 0,
  path: string = '0'
): HitResult | null {
  const p = root.props || {};
  const x = px + (p.x || 0);
  const y = py + (p.y || 0);
  const bounds = resolveNodeBounds(root, px, py);

  if (root === targetNode) {
    return {
      node: root,
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      path
    };
  }

  if (!root.child) return null;

  for (let i = 0; i < root.child.length; i += 1) {
    const child = root.child[i];
    if (!child) continue;
    const result = resolveHitByNode(child, targetNode, x, y, `${path}.${i}`);
    if (result) return result;
  }

  return null;
}
