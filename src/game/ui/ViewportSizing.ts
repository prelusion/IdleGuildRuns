export function computeSquareSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const reservedBelow = Math.min(260, Math.floor(vh * 0.32));
  const availableH = Math.max(240, vh - reservedBelow);

  const size = Math.floor(Math.min(vw, availableH, 920));
  return Math.max(240, size);
}