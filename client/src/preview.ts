export function isPreviewPath(path: string) {
  return path === "/demo" || path.startsWith("/demo/");
}
export const previewMode =
  typeof window !== "undefined" && isPreviewPath(window.location.pathname);
