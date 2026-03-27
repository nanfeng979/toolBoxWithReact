export interface SceneNode {
  type: string;
  props?: Record<string, any>;
  child?: SceneNode[];
}

export interface HitResult {
  node: SceneNode;
  x: number;
  y: number;
  w: number;
  h: number;
}
