const INDENT = '    ';
const NEWLINE = '\r\n';
const INLINE_OBJECT_KEYS = new Set(['props']);
const FORCE_MULTILINE_EMPTY_ARRAY_KEYS = new Set(['nodes', 'child', 'animations']);

function stringifyInlineObject(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

function stringifyArray(value: unknown[], level: number, keyHint?: string): string {
  const forceMultilineEmpty = !!keyHint && FORCE_MULTILINE_EMPTY_ARRAY_KEYS.has(keyHint);
  const forceMultiline = !!keyHint && FORCE_MULTILINE_EMPTY_ARRAY_KEYS.has(keyHint);

  if (value.length === 0) {
    if (forceMultilineEmpty) {
      return `[${NEWLINE}${INDENT.repeat(level + 1)}]`;
    }
    return '[]';
  }

  if (forceMultiline) {
    const lines = value.map((item, index) => {
      const serializedItem = stringifyValue(item, level + 1);
      const suffix = index === value.length - 1 ? ']' : ',';
      return `${INDENT.repeat(level + 1)}${serializedItem}${suffix}`;
    });

    return `[${NEWLINE}${lines.join(NEWLINE)}`;
  }

  const lines = value.map((item) => `${INDENT.repeat(level + 1)}${stringifyValue(item, level + 1)}`);
  return `[${NEWLINE}${lines.join(`,${NEWLINE}`)}${NEWLINE}${INDENT.repeat(level)}]`;
}

function stringifyObject(value: Record<string, unknown>, level: number): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';

  const lines = entries.map(([key, itemValue]) => {
    const isInlineObject =
      INLINE_OBJECT_KEYS.has(key) &&
      typeof itemValue === 'object' &&
      itemValue !== null &&
      !Array.isArray(itemValue);

    const serializedValue = isInlineObject
      ? stringifyInlineObject(itemValue as Record<string, unknown>)
      : stringifyValue(itemValue, level + 1, key);

    return `${INDENT.repeat(level + 1)}${JSON.stringify(key)}:${serializedValue}`;
  });

  return `{${NEWLINE}${lines.join(`,${NEWLINE}`)}${NEWLINE}${INDENT.repeat(level)}}`;
}

function stringifyValue(value: unknown, level: number, keyHint?: string): string {
  if (Array.isArray(value)) {
    return stringifyArray(value, level, keyHint);
  }

  if (value && typeof value === 'object') {
    return stringifyObject(value as Record<string, unknown>, level);
  }

  return JSON.stringify(value);
}

export function formatSceneForSave(sceneData: unknown): string {
  return stringifyValue(sceneData, 0);
}
