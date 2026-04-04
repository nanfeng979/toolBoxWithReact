export interface SceneNode {
  type: string;
  props?: Record<string, any>;
  label?: string;
  searchKey?: string;
  compId?: number;
  nodeParent?: number;
  x?: number;
  isDirectory?: boolean;
  isAniNode?: boolean;
  hasChild?: boolean;
  child?: SceneNode[];
}

export interface HitResult {
  node: SceneNode;
  x: number;
  y: number;
  w: number;
  h: number;
  path: string;
}
