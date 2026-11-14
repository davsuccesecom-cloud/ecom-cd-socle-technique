/**
 * Compresse et redimensionne côté client un logo importé pour garantir
 * un rendu net sur smartphone tout en restant largement sous la limite Firestore (1 Mo).
 */
export async function optimizeBrandLogoFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Format non pris en charge. Veuillez sélectionner une image PNG, JPG, WebP ou SVG.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image trop volumineuse (max 5 Mo). Sélectionnez un fichier plus léger.");
  }

  if (file.type === "image/svg+xml" && file.size <= 150 * 1024) {
    return readAsDataUrl(file);
  }

  const rawDataUrl = await readAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const renderResized = (size: number, mime: string, quality: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return rawDataUrl;

    ctx.clearRect(0, 0, size, size);
    const scale = Math.min(size / img.width, size / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const x = Math.round((size - w) / 2);
    const y = Math.round((size - h) / 2);
    ctx.drawImage(img, x, y, w, h);
    return canvas.toDataURL(mime, quality);
  };

  // WebP préserve la transparence tout en réduisant drastiquement la taille
  let candidate = renderResized(384, "image/webp", 0.88);
  if (!candidate.startsWith("data:image/webp")) {
    candidate = renderResized(256, "image/png", 0.9);
  }
  if (candidate.length > 180_000) {
    candidate = renderResized(256, "image/webp", 0.78);
  }
  if (candidate.length > 220_000) {
    candidate = renderResized(192, "image/jpeg", 0.8);
  }

  return candidate;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire le fichier image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image invalide ou corrompue."));
    img.src = src;
  });
}
