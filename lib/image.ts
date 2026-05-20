type CompressedImage = {
  base64: string;
  mimeType: string;
};

/**
 * 在浏览器端把用户选/拍的图片等比缩放（长边 ≤ maxEdge）并压成 JPEG，
 * 返回不含 data URL 前缀的纯 base64，配合 /api/ai/ocr 的 imageBase64 字段使用。
 * 仅在客户端组件中调用。
 */
export async function fileToCompressedBase64(
  file: File,
  maxEdge = 1280,
  quality = 0.8,
): Promise<CompressedImage> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法处理图片。");
  }
  ctx.drawImage(image, 0, 0, width, height);

  const compressed = canvas.toDataURL("image/jpeg", quality);
  return {
    base64: compressed.replace(/^data:[^;]+;base64,/, ""),
    mimeType: "image/jpeg",
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片解析失败。"));
    image.src = src;
  });
}
