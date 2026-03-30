import { SceneNode } from '../../types/scene';

export interface CreateComponentContext {
  compId: number;
  parentCompId: number;
  depth: number;
}

export type ComponentCreator = (context: CreateComponentContext) => SceneNode;
