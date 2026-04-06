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
      "thumbnail": "base64...",  // 可选，仅当 --thumbnails 参数时返回
      "children": [...]  // 仅group类型有
    }
  ]
}
"""

import sys
import json
import base64
from pathlib import Path
from io import BytesIO

# 强制使用UTF-8编码输出（Windows下必须）
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

# 命令行参数：是否包含缩略图
INCLUDE_THUMBNAILS = '--thumbnails' in sys.argv or '-t' in sys.argv
DEBUG_THUMBNAILS = '--debug-thumbnails' in sys.argv
THUMBNAIL_MAX_SIZE = 32  # 缩略图最大尺寸

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


def generate_thumbnail(layer, max_size=THUMBNAIL_MAX_SIZE):
    """生成图层缩略图的 base64 编码"""
    try:
        # 检查图层是否有实际像素内容
        if not hasattr(layer, 'has_pixels') or not layer.has_pixels():
            if DEBUG_THUMBNAILS:
                print(f"[DEBUG] '{layer.name}': no pixels", file=sys.stderr)
            return None
        
        # 使用 composite() 渲染图层内容为 PIL Image
        thumb = layer.composite()
        if thumb is None:
            if DEBUG_THUMBNAILS:
                print(f"[DEBUG] '{layer.name}': composite() returned None", file=sys.stderr)
            return None
        
        if DEBUG_THUMBNAILS:
            print(f"[DEBUG] '{layer.name}': composite() OK, size={thumb.size}", file=sys.stderr)
        
        # 调整大小
        w, h = thumb.size
        if w <= 0 or h <= 0:
            return None
        if w > max_size or h > max_size:
            ratio = min(max_size / w, max_size / h)
            new_w = max(1, int(w * ratio))
            new_h = max(1, int(h * ratio))
            # 使用 LANCZOS 重采样
            try:
                from PIL import Image
                thumb = thumb.resize((new_w, new_h), Image.Resampling.LANCZOS)
            except (ImportError, AttributeError):
                # 旧版本 Pillow
                thumb = thumb.resize((new_w, new_h), 1)
        
        # 转为 base64
        buffer = BytesIO()
        thumb.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    except Exception as e:
        if DEBUG_THUMBNAILS:
            print(f"[DEBUG] generate_thumbnail error for '{layer.name}': {e}", file=sys.stderr)
        return None


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
    
    # 生成缩略图（仅非组图层，且开启缩略图选项时）
    if INCLUDE_THUMBNAILS and layer_type != "group":
        thumb_base64 = generate_thumbnail(layer)
        if thumb_base64:
            result["thumbnail"] = thumb_base64
    
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
