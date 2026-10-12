"use strict";

(() => {
  const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
  const MAX_OUTPUT_BYTES = 500 * 1024;
  const MIN_WIDTH = 800;
  const MIN_HEIGHT = 600;
  const MAX_DIMENSION = 1600;
  const MIN_LONG_EDGE = 640;
  const MIN_QUALITY = 0.35;
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

  function qualityLadder() {
    const qualities = [];
    let quality = 82;
    do {
      qualities.push(quality / 100);
      if (quality === 35) break;
      quality = Math.max(35, quality - 7);
    } while (qualities.length < 12);
    return qualities;
  }

  function sizeLadder(originalWidth, originalHeight) {
    const sizes = [];
    const longEdge = Math.max(originalWidth, originalHeight);
    let width = originalWidth;
    let height = originalHeight;
    if (longEdge > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / longEdge;
      width = Math.max(1, Math.round(originalWidth * scale));
      height = Math.max(1, Math.round(originalHeight * scale));
    }
    for (let guard = 0; guard < 12; guard += 1) {
      sizes.push({ width, height });
      if (Math.max(width, height) <= MIN_LONG_EDGE) break;
      const nextWidth = Math.max(1, Math.round(width * 0.9));
      const nextHeight = Math.max(1, Math.round(height * 0.9));
      if (Math.max(nextWidth, nextHeight) < MIN_LONG_EDGE) break;
      if (nextWidth === width && nextHeight === height) break;
      width = nextWidth;
      height = nextHeight;
    }
    return sizes;
  }

  function searchPlan(originalWidth, originalHeight) {
    return { sizes: sizeLadder(originalWidth, originalHeight), qualities: qualityLadder() };
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

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir la fotografía a WebP.")), type, quality);
    });
  }

  async function assertAuthenticWebp(blob) {
    const mime = String(blob.type || "").toLowerCase();
    if (mime !== "image/webp") {
      throw new Error("Este navegador no generó una imagen WebP. Actualícelo e intente de nuevo. La fotografía no se subió.");
    }
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const riff = header.length >= 12 && header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
    const webp = header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
    if (!riff || !webp) {
      throw new Error("La imagen procesada no tiene una firma WebP válida. No se subió el archivo.");
    }
  }

  async function processInventoryImage(file) {
    validateInventoryImageFile(file);
    const image = await decodeInventoryImage(file);
    try {
      const originalWidth = image.width || image.naturalWidth;
      const originalHeight = image.height || image.naturalHeight;
      if (originalWidth < MIN_WIDTH || originalHeight < MIN_HEIGHT) {
        throw new Error("La fotografía debe tener una resolución mínima de 800×600 píxeles.");
      }
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("El navegador no permite procesar esta fotografía.");

      const plan = searchPlan(originalWidth, originalHeight);
      for (const size of plan.sizes) {
        canvas.width = size.width;
        canvas.height = size.height;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size.width, size.height);
        context.drawImage(image, 0, 0, size.width, size.height);
        for (const quality of plan.qualities) {
          const output = await canvasToBlob(canvas, "image/webp", quality);
          await assertAuthenticWebp(output);
          if (output.size <= MAX_OUTPUT_BYTES) {
            return { blob: output, width: size.width, height: size.height, bytes: output.size, type: "image/webp" };
          }
        }
      }
      throw new Error("No se pudo reducir la fotografía a 500 KB. Intente con una imagen menos compleja.");
    } finally {
      image.close?.();
    }
  }

  const api = Object.freeze({
    process: processInventoryImage,
    validateFile: validateInventoryImageFile,
    searchPlan,
    limits: Object.freeze({
      MAX_ORIGINAL_BYTES,
      MAX_OUTPUT_BYTES,
      MIN_WIDTH,
      MIN_HEIGHT,
      MAX_DIMENSION,
      MIN_LONG_EDGE,
      MIN_QUALITY
    })
  });
  if (typeof window !== "undefined") window.InventoryImage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
