import { SceneNode } from '../../types/scene';
import { CreateComponentContext } from './types';

function getHierarchyXByDepth(depth: number) {
  return Math.max(0, depth) * 15;
}

export function createLabelUIComponent(context: CreateComponentContext): SceneNode {
  const hasChild = false;

  return {
    x: getHierarchyXByDepth(context.depth),
    type: 'Label',
    searchKey: 'Label',
    props: { text: 'label', fontSize: 48 },
    nodeParent: context.parentCompId,
    label: 'Label',
    isDirectory: hasChild,
    isAniNode: true,
    hasChild,
    compId: context.compId,
    child: []
  };
}
