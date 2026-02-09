export const COMMAND_PREFIX = {
  ACCEPT: "a",
  ALREADY_SWAPPED: "s",
};

export function serializeAccept(
  courseId: number,
  swapper1: number,
  swapper2: number
) {
  const id = Math.floor(Math.random() * 1000000).toString(16);
  const courseIdHex = courseId.toString(16);
  const swapper1Hex = swapper1.toString(16);
  const swapper2Hex = swapper2.toString(16);
  const data = `${COMMAND_PREFIX.ACCEPT}:${id}:${courseIdHex}:${swapper1Hex}:${swapper2Hex}`;
  return data;
}

export function serializeAlreadySwapped(
  courseId: number,
  swapper1: number,
  swapper2: number
) {
  const id = Math.floor(Math.random() * 1000000).toString(16);
  const courseIdHex = courseId.toString(16);
  const swapper1Hex = swapper1.toString(16);
  const swapper2Hex = swapper2.toString(16);
  const data = `${COMMAND_PREFIX.ALREADY_SWAPPED}:${id}:${courseIdHex}:${swapper1Hex}:${swapper2Hex}`;
  return data;
}

export function getAction(data: string) {
  const parts = data.split(":");
  if (parts.length < 2) return null;
  const [action, id] = parts;
  return { action, id };
}

export function deserializeAccept(data: string) {
  const parts = data.split(":");
  if (parts.length !== 5) return null;
  const [actionChar, id, courseIdStr, swapper1Str, swapper2Str] = parts;
  if (actionChar !== "a") return null;
  const courseId = parseInt(courseIdStr, 16);
  const swapper1 = parseInt(swapper1Str, 16);
  const swapper2 = parseInt(swapper2Str, 16);
  if (isNaN(courseId) || isNaN(swapper1) || isNaN(swapper2)) return null;
  return { id, courseId, swapper1, swapper2 };
}

export function deserializeAlreadySwapped(data: string) {
  const parts = data.split(":");
  if (parts.length !== 5) return null;
  const [actionChar, id, courseIdStr, swapper1Str, swapper2Str] = parts;
  if (actionChar !== "s") return null;
  const courseId = parseInt(courseIdStr, 16);
  const swapper1 = parseInt(swapper1Str, 16);
  const swapper2 = parseInt(swapper2Str, 16);
  if (isNaN(courseId) || isNaN(swapper1) || isNaN(swapper2)) return null;
  return { id, courseId, swapper1, swapper2 };
}
