import { SceneNode } from '../../types/scene';
import { CreateComponentContext } from './types';

function getHierarchyXByDepth(depth: number) {
  return Math.max(0, depth) * 15;
}

export function createBoxUIComponent(context: CreateComponentContext): SceneNode {
  const hasChild = false;

  return {
    x: getHierarchyXByDepth(context.depth),
    type: 'Box',
    searchKey: 'Box',
    props: {},
    nodeParent: context.parentCompId,
    label: 'Box',
    isDirectory: hasChild,
    isAniNode: true,
    hasChild,
    compId: context.compId,
    child: []
  };
}
