import type { Position } from "./contracts";

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function positionFromElementType(elementType: number): Position {
  switch (elementType) {
    case 1:
      return "GKP";
    case 2:
      return "DEF";
    case 3:
      return "MID";
    case 4:
      return "FWD";
    default:
      throw new Error(`Unsupported element type: ${elementType}`);
  }
}

export function percentile(sortedValues: number[], target: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  let lastIndex = -1;
  for (let index = 0; index < sortedValues.length; index += 1) {
    if (sortedValues[index] <= target) {
      lastIndex = index;
    }
  }
  if (lastIndex < 0) {
    return 0;
  }
  return (lastIndex / Math.max(1, sortedValues.length - 1)) * 100;
}
