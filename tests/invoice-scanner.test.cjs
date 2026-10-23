"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
let lastCanvas;
let releasedBitmaps = 0;

function canvasMock() {
  const canvas = {
    width: 0, height: 0,
    getContext() {
      return {
        fillStyle: "", fillRect() {}, drawImage() {},
        getImageData() {
          return { data: new Uint8ClampedArray([200, 80, 10, 255, 245, 245, 245, 255]) };
        },
        putImageData() {}
      };
    },
    toBlob(callback, type) {
      callback(new Blob([jpegBytes], { type }));
    }
  };
  lastCanvas = canvas;
  return canvas;
}
const sandbox = {
  window: {},
  document: { createElement: () => canvasMock() },
  Blob, File,
  createImageBitmap: async () => ({
    width: 5000, height: 4000,
    close() { releasedBitmaps++; }
  })
};
vm.createContext(sandbox);
const source = fs.readFileSync(path.join(__dirname, "../js/invoice-scan.js"), "utf8");
vm.runInContext(source, sandbox, { filename: "invoice-scan.js" });
const scan = sandbox.window.InvoiceScanner;

test("clasifica imágenes y PDF", () => {
  assert.equal(scan.kind(new File([jpegBytes], "foto.webp", { type: "image/webp" })), "image");
  assert.equal(scan.kind(new File(["%PDF"], "factura.pdf", { type: "application/pdf" })), "pdf");
  assert.equal(scan.kind(new File(["abc"], "notas.txt", { type: "text/plain" })), "");
});

test("el blanco y negro elimina color y puede producir negro puro", () => {
  const image = { data: new Uint8ClampedArray([60, 120, 230, 255]) };
  scan.applyMonochrome(image, "scan");
  assert.equal(image.data[0], image.data[1]);
  assert.equal(image.data[1], image.data[2]);
  assert.equal(image.data[3], 255);
  const stark = { data: new Uint8ClampedArray([10, 10, 10, 255, 250, 250, 250, 255]) };
  scan.applyMonochrome(stark, "high");
  assert.deepEqual(Array.from(stark.data), [0, 0, 0, 255, 255, 255, 255, 255]);
});

test("PDF se conserva intacto, sin eliminar páginas", async () => {
  const pdf = new File(["%PDF-test"], "ejemplo.pdf", { type: "application/pdf" });
  const ready = await scan.prepare(pdf);
  assert.equal(ready.file, pdf);
  assert.equal(ready.kind, "pdf");
  assert.equal(ready.processedSize, pdf.size);
});

test("fotografía de cámara se redimensiona y guarda en JPEG ligero", async () => {
  const image = new File([jpegBytes], "Factura móvil.png", { type: "image/png" });
  const ready = await scan.prepare(image);
  assert.equal(ready.kind, "image");
  assert.equal(ready.file.type, "image/jpeg");
  assert.equal(ready.file.name, "Factura móvil-escaneada.jpg");
  assert.equal(ready.file.size, jpegBytes.length);
  assert.ok(ready.width <= 2200 && ready.height <= 2200);
  assert.ok(ready.width * ready.height <= 4800000);
  assert.equal(lastCanvas.width, 0);
  assert.equal(lastCanvas.height, 0);
  assert.ok(releasedBitmaps > 0);
});

test("rechaza archivos vacíos, de tipo inválido y PDF excesivos", () => {
  assert.throws(() => scan.validateSource(new File([], "empty.jpg", { type: "image/jpeg" })));
  assert.throws(() => scan.validateSource(new File(["x"], "bad.txt", { type: "text/plain" })));
  const huge = new File([new Uint8Array(15 * 1024 * 1024 + 1)], "huge.pdf", { type: "application/pdf" });
  assert.throws(() => scan.validateSource(huge), /15 MiB/);
});
