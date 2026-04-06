#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSD Parser - 解析PSD文件并返回图层层级结构
基于 psd-tools 库

输出格式 (JSON):
{
  "success": true,
  "width": 1920,
  "height": 1080,
  "layers": [
    {
      "name": "Layer Name",
      "type": "group" | "pixel" | "text" | "shape" | "smart",
      "visible": true,
      "opacity": 255,
      "left": 0,
      "top": 0,
      "right": 100,
      "bottom": 100,
      "width": 100,
      "height": 100,
      "children": [...]  // 仅group类型有
    }
  ]
}
"""

import sys
import json
from pathlib import Path

# 强制使用UTF-8编码输出（Windows下必须）
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

try:
    from psd_tools import PSDImage
    from psd_tools.api.layers import Group, PixelLayer, ShapeLayer, SmartObjectLayer
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "psd-tools not installed. Run: pip install psd-tools"
    }))
    sys.exit(1)


def get_layer_type(layer):
    """获取图层类型"""
    if isinstance(layer, Group):
        return "group"
    elif isinstance(layer, ShapeLayer):
        return "shape"
    elif isinstance(layer, SmartObjectLayer):
        return "smart"
    elif hasattr(layer, 'text') and hasattr(layer, 'resource_dict'):
        # TypeLayer (psd-tools 1.9+)
        return "text"
    else:
        return "pixel"


def parse_layer(layer):
    """递归解析图层"""
    layer_type = get_layer_type(layer)
    
    result = {
        "name": layer.name or "(unnamed)",
        "type": layer_type,
        "visible": layer.visible,
        "opacity": layer.opacity,
    }
    
    # 获取边界框（以左上角为原点的坐标系）
    # psd-tools 返回的 bbox 是 (left, top, right, bottom)
    bbox = layer.bbox
    
    if bbox != (0, 0, 0, 0):
        left, top, right, bottom = bbox
        result["left"] = left
        result["top"] = top
        result["right"] = right
        result["bottom"] = bottom
        result["width"] = right - left
        result["height"] = bottom - top
    else:
        result["left"] = 0
        result["top"] = 0
        result["right"] = 0
        result["bottom"] = 0
        result["width"] = 0
        result["height"] = 0
    
    # 如果是组图层，递归解析子图层
    if layer_type == "group":
        children = []
        if hasattr(layer, '__iter__'):
            for child in layer:
                children.append(parse_layer(child))
        result["children"] = children
        result["is_open"] = getattr(layer, 'is_open', True)  # 组是否展开
    
    return result


def parse_psd(file_path):
    """解析PSD文件"""
    try:
        psd = PSDImage.open(file_path)
        
        layers = []
        for layer in psd:
            layers.append(parse_layer(layer))
        
        return {
            "success": True,
            "width": psd.width,
            "height": psd.height,
            "layers": layers,
            "colorMode": str(psd.color_mode) if hasattr(psd, 'color_mode') else "unknown",
            "depth": psd.depth if hasattr(psd, 'depth') else 8,
            "channels": psd.channels if hasattr(psd, 'channels') else 4
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python parse_psd.py <psd_file_path>"
        }))
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    if not Path(file_path).exists():
        print(json.dumps({
            "success": False,
            "error": f"File not found: {file_path}"
        }))
        sys.exit(1)
    
    result = parse_psd(file_path)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
