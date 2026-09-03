"use strict";

(() => {
  const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
  const MAX_OUTPUT_BYTES = 500 * 1024;
  const MIN_WIDTH = 800;
  const MIN_HEIGHT = 600;
  const MAX_DIMENSION = 1600;
  const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]);
  const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|heic|heif|webp)$/i;

  function validateInventoryImageFile(file) {
    if (!file) throw new Error("Seleccione una fotografía.");
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error("La fotografía original no puede exceder 10 MB.");
    if (!ACCEPTED_TYPES.has(String(file.type || "").toLowerCase()) && !ACCEPTED_EXTENSIONS.test(file.name || "")) {
      throw new Error("Use una fotografía JPG, PNG, HEIC o WebP.");
    }
    return true;
  }

  async function decodeInventoryImage(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        // Algunos navegadores decodifican HEIC mediante <img>, aunque createImageBitmap no lo haga.
      }
    }
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Este navegador no pudo leer la fotografía. Para HEIC, use un navegador con soporte HEIC o conviértala a JPG."));
      };
      image.src = objectUrl;
    });
  }

  function canvasToWebp(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir la fotografía a WebP.")), "image/webp", quality);
    });
  }

  async function processInventoryImage(file) {
    validateInventoryImageFile(file);
    const image = await decodeInventoryImage(file);
    const originalWidth = image.width || image.naturalWidth;
    const originalHeight = image.height || image.naturalHeight;
    if (originalWidth < MIN_WIDTH || originalHeight < MIN_HEIGHT) {
      image.close?.();
      throw new Error("La fotografía debe tener una resolución mínima de 800×600 píxeles.");
    }

    const initialScale = Math.min(1, MAX_DIMENSION / Math.max(originalWidth, originalHeight));
    let width = Math.max(1, Math.round(originalWidth * initialScale));
    let height = Math.max(1, Math.round(originalHeight * initialScale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("El navegador no permite procesar esta fotografía.");

    let output;
    let quality = 0.82;
    do {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      quality = 0.82;
      do {
        output = await canvasToWebp(canvas, quality);
        quality = Math.max(0.35, quality - 0.07);
      } while (output.size > MAX_OUTPUT_BYTES && quality > 0.35);
      if (output.size > MAX_OUTPUT_BYTES) {
        width = Math.max(640, Math.round(width * 0.9));
        height = Math.max(480, Math.round(height * 0.9));
      }
    } while (output.size > MAX_OUTPUT_BYTES && width > 640 && height > 480);
    image.close?.();

    if (output.size > MAX_OUTPUT_BYTES) {
      throw new Error("No se pudo reducir la fotografía a 500 KB. Intente con una imagen menos compleja.");
    }
    return { blob: output, width, height, bytes: output.size, type: "image/webp" };
  }

  const api = Object.freeze({
    process: processInventoryImage,
    validateFile: validateInventoryImageFile,
    limits: Object.freeze({ MAX_ORIGINAL_BYTES, MAX_OUTPUT_BYTES, MIN_WIDTH, MIN_HEIGHT, MAX_DIMENSION })
  });
  if (typeof window !== "undefined") window.InventoryImage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
