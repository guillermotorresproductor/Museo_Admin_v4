"use strict";

// Codificadores auxiliares para Safari. Las fotografías se procesan localmente:
// los CDN solo entregan los módulos de conversión, nunca reciben las imágenes.
// Dependencias fijadas a versiones concretas; no se cargan en navegadores que ya
// soportan la codificación nativa de WebP.
(() => {
  const WEBP_ENCODER_URL = "https://esm.sh/@jsquash/webp@1.5.0/encode.js";
  const WEBP_WASM_URL = "https://cdn.jsdelivr.net/npm/@jsquash/webp@1.5.0/codec/enc/";
  const HEIC_CONVERTER_URL = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";

  let webpEncoderPromise = null;
  let heicConverterPromise = null;

  async function getWebpEncoder() {
    if (!webpEncoderPromise) {
      webpEncoderPromise = (async () => {
        const module = await import(WEBP_ENCODER_URL);
        if (typeof module.default !== "function" || typeof module.init !== "function") {
          throw new Error("El codificador WebP no está disponible.");
        }
        await module.init(null, {
          locateFile: (file) => {
            if (!/^webp_enc(?:_simd)?\.wasm$/.test(file)) throw new Error("Archivo WebP WASM inesperado.");
            return WEBP_WASM_URL + file;
          }
        });
        return module.default;
      })().catch((error) => {
        webpEncoderPromise = null;
        throw error;
      });
    }
    return webpEncoderPromise;
  }

  async function encodeWebp(canvas, quality) {
    const encode = await getWebpEncoder();
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo leer la fotografía para convertirla.");
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height);
    const bytes = await encode(rgba, { quality: Math.round(quality * 100), method: 4 });
    return new Blob([bytes], { type: "image/webp" });
  }

  function getHeicConverter() {
    if (typeof window.heic2any === "function") return Promise.resolve(window.heic2any);
    if (!heicConverterPromise) {
      heicConverterPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = HEIC_CONVERTER_URL;
        script.async = true;
        script.onload = () => typeof window.heic2any === "function"
          ? resolve(window.heic2any)
          : reject(new Error("El conversor HEIC no se inicializó."));
        script.onerror = () => reject(new Error("No se pudo cargar el conversor HEIC."));
        document.head.appendChild(script);
      }).catch((error) => {
        heicConverterPromise = null;
        throw error;
      });
    }
    return heicConverterPromise;
  }

  async function convertHeic(file) {
    const convert = await getHeicConverter();
    const result = await convert({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const output = Array.isArray(result) ? result[0] : result;
    if (!(output instanceof Blob) || output.type !== "image/jpeg") {
      throw new Error("No fue posible convertir HEIC/HEIF a JPG.");
    }
    return output;
  }

  if (typeof window !== "undefined") {
    window.InventoryPhotoCodecs = Object.freeze({ encodeWebp, convertHeic });
  }
})();
