export function appPath(path: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (path === "/") {
    return basePath || "/";
  }
  return `${basePath}${path}`;
}
