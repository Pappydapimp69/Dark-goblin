import type { Asset } from ".";

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("failed to rasterize svg asset"));
    img.src = uri;
  });
}

export async function rasterizeAll(assets: Asset[]): Promise<Map<string, HTMLCanvasElement>> {
  const textures = new Map<string, HTMLCanvasElement>();
  for (const asset of assets) {
    const img = await loadImage(asset.uri);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas unavailable");
    ctx.drawImage(img, 0, 0);
    textures.set(asset.key, canvas);
  }
  return textures;
}
