"use strict";

// El escaneo se realiza en el navegador: ningún servicio externo recibe la factura.
// El resultado final siempre es JPEG, compatible con el ingreso actual de facturas.
(function () {
  const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
  const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
  const TARGET_BYTES = 1200 * 1024;
  const MAX_SIDE = 2200;
  const MAX_PIXELS = 4800000;
  const PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
  const PHOTO_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

  function extension(file) {
    const name = String(file?.name || "");
    return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  }

  function kind(file) {
    const ext = extension(file);
    const mime = String(file?.type || "").toLowerCase().split(";")[0].trim();
    if (mime === "application/pdf" || ext === "pdf") return "pdf";
    if (PHOTO_MIMES.has(mime) || PHOTO_EXTENSIONS.has(ext)) return "image";
    return "";
  }

  function validateSource(file) {
    if (!file || !file.size) throw new Error("Seleccione una factura con contenido.");
    const type = kind(file);
    if (!type) throw new Error("Seleccione un PDF o una fotografía JPG, PNG, WebP o HEIC.");
    if (file.size > (type === "pdf" ? MAX_UPLOAD_BYTES : MAX_SOURCE_BYTES)) {
      throw new Error(type === "pdf"
        ? "El PDF supera 15 MiB. Seleccione una versión más liviana."
        : "La fotografía supera 50 MiB.");
    }
    return type;
  }

  async function openPicture(blob) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
        return {
          width: bitmap.width, height: bitmap.height,
          draw(context, width, height) { context.drawImage(bitmap, 0, 0, width, height); },
          close() { bitmap.close(); }
        };
      } catch {
        // Compatibilidad con Safari y navegadores que no aceptan imageOrientation.
        try {
          const bitmap = await createImageBitmap(blob);
          return {
            width: bitmap.width, height: bitmap.height,
            draw(context, width, height) { context.drawImage(bitmap, 0, 0, width, height); },
            close() { bitmap.close(); }
          };
        } catch { /* Continuar con HTMLImageElement. */ }
      }
    }
    const url = URL.createObjectURL(blob);
    try {
      const picture = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("No se pudo abrir la fotografía."));
        image.src = url;
      });
      return {
        width: picture.naturalWidth, height: picture.naturalHeight,
        draw(context, width, height) { context.drawImage(picture, 0, 0, width, height); },
        close() { picture.src = ""; URL.revokeObjectURL(url); }
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  async function decode(file) {
    try {
      return await openPicture(file);
    } catch (error) {
      if (!["heic", "heif"].includes(extension(file)) && !/heic|heif/.test(file.type || "")) throw error;
      if (typeof window.InventoryPhotoCodecs?.convertHeic !== "function") {
        throw new Error("Este dispositivo no puede abrir HEIC. Use la cámara para tomar un JPG.");
      }
      const jpeg = await window.InventoryPhotoCodecs.convertHeic(file);
      return openPicture(jpeg);
    }
  }

  function applyMonochrome(data, mode) {
    const pixels = data.data;
    const highContrast = mode === "high";
    for (let i = 0; i < pixels.length; i += 4) {
      // Fondo blanco, texto oscuro; evita transformar números legibles en manchas negras.
      const level = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
      const contrasted = Math.max(0, Math.min(255, Math.round((level - 32) * 1.46)));
      const gray = highContrast ? (contrasted < 171 ? 0 : 255) : contrasted;
      pixels[i] = gray;
      pixels[i + 1] = gray;
      pixels[i + 2] = gray;
      pixels[i + 3] = 255;
    }
    return data;
  }

  function jpegBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob || blob.type !== "image/jpeg") {
          reject(new Error("Este navegador no pudo comprimir la imagen en JPG."));
          return;
        }
        resolve(blob);
      }, "image/jpeg", quality);
    });
  }

  function scannedName(file) {
    const stem = String(file.name || "Factura")
      .replace(/\.[^.]*$/, "")
      .normalize("NFC")
      .replace(/[/\\\x00-\x1f\x7f]/g, "-")
      .trim()
      .slice(0, 160) || "Factura";
    return stem + "-escaneada.jpg";
  }

  async function prepare(file, mode = "scan") {
    const type = validateSource(file);
    if (type === "pdf") {
      // No rasterizar PDFs: se conservarían peor sus páginas, firmas y texto seleccionable.
      return { file, source: file, kind: "pdf", originalSize: file.size, processedSize: file.size };
    }
    if (mode !== "scan" && mode !== "high") throw new Error("Modo de escaneo desconocido.");
    const picture = await decode(file);
    const canvas = document.createElement("canvas");
    try {
      if (!picture.width || !picture.height) throw new Error("La fotografía no tiene dimensiones válidas.");
      const scale = Math.min(1, MAX_SIDE / Math.max(picture.width, picture.height),
        Math.sqrt(MAX_PIXELS / (picture.width * picture.height)));
      canvas.width = Math.max(1, Math.round(picture.width * scale));
      canvas.height = Math.max(1, Math.round(picture.height * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("El navegador no permite procesar esta fotografía.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      picture.draw(context, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      context.putImageData(applyMonochrome(imageData, mode), 0, 0);
      let compressed = null;
      for (const quality of [0.84, 0.74, 0.62, 0.50]) {
        compressed = await jpegBlob(canvas, quality);
        if (compressed.size <= TARGET_BYTES) break;
      }
      if (!compressed || compressed.size > MAX_UPLOAD_BYTES) {
        throw new Error("El escaneo sigue siendo demasiado grande. Intente una foto más cercana.");
      }
      const name = scannedName(file);
      const converted = new File([compressed], name, { type: "image/jpeg", lastModified: Date.now() });
      return {
        file: converted, source: file, kind: "image", mode,
        originalSize: file.size, processedSize: converted.size,
        width: canvas.width, height: canvas.height
      };
    } finally {
      picture.close();
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  window.InvoiceScanner = Object.freeze({ prepare, kind, validateSource, applyMonochrome });
})();
