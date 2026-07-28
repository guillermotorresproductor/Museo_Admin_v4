(function () {
  "use strict";
  const catalog = window.RentalSpaces;
  const root = document.querySelector("[data-rental-space-page]");
  if (!catalog || !root) return;
  const id = new URLSearchParams(window.location.search).get("id");
  const space = catalog.publicSpaces.find((item) => item.id === id);

  if (!space) {
    root.innerHTML = `<section class="card rental-not-found"><h2>Espacio no encontrado</h2><p>La ficha solicitada no está disponible.</p><a class="button secondary" href="renta-espacios.html#catalogo-espacios">Volver a espacios</a></section>`;
    return;
  }

  const section = (title, items) => items?.length ? `<details class="rental-accordion"><summary>${catalog.escape(title)}</summary>${catalog.listMarkup(items)}</details>` : "";
  root.innerHTML = `
    <article class="rental-detail-page">
      <header class="rental-detail-hero">
        <p class="page-kicker">Renta de espacios</p>
        <h2>${catalog.escape(space.name)}</h2>
        ${space.regulatoryName ? `<p class="rental-regulatory-name">Nombre reglamentario: ${catalog.escape(space.regulatoryName)}</p>` : ""}
        <p>${catalog.escape(space.description)}</p>
      </header>

      <section class="rental-gallery" aria-label="Galería de ${catalog.escape(space.name)}">
        <div class="rental-gallery-track" data-rental-gallery-track>${space.images.map((image) => catalog.imageMarkup(image, "rental-gallery-slide")).join("")}</div>
        <div class="rental-gallery-controls">
          <button type="button" data-gallery-previous aria-label="Fotografía anterior">‹</button>
          <div class="rental-gallery-indicators" aria-label="Posición en la galería">${space.images.map((_, index) => `<span${index === 0 ? ' class="is-active"' : ""}>${index + 1}</span>`).join("")}</div>
          <button type="button" data-gallery-next aria-label="Fotografía siguiente">›</button>
        </div>
      </section>

      <section class="rental-essential-grid" aria-label="Información esencial">
        <article><span>Precio</span><strong>${catalog.escape(space.priceSummary)}</strong></article>
        <article><span>Capacidad</span><strong>${catalog.escape(space.capacitySummary)}</strong></article>
        <article><span>Horario</span><strong>${catalog.escape(space.schedule)}</strong></article>
        <article><span>Duración incluida</span><strong>${catalog.escape(space.duration)}</strong></article>
        ${space.area ? `<article><span>Extensión</span><strong>${catalog.escape(space.area)}</strong></article>` : ""}
      </section>

      <section class="card rental-requirements">
        <h3>Requisitos esenciales</h3>
        ${catalog.listMarkup(space.requirements.length ? space.requirements : ["La solicitud está sujeta a evaluación y aprobación administrativa."])}
      </section>

      <section class="rental-detail-columns">
        <article class="card"><h3>Incluye</h3>${catalog.listMarkup(space.included)}</article>
        <article class="card"><h3>No incluye</h3>${catalog.listMarkup(space.excluded.length ? space.excluded : ["Cualquier servicio no indicado expresamente como incluido."])}</article>
      </section>

      <section class="rental-accordions" aria-label="Condiciones del espacio">
        ${section("Pago y fianza", [...catalog.generalTerms.payment, `Fianza: ${space.deposit}.`])}
        ${section("Seguro", catalog.generalTerms.insurance)}
        ${section("Montaje y desmontaje", [space.setup, space.breakdown])}
        ${section("Restricciones", [...catalog.generalTerms.protection, ...space.restrictions])}
        ${section("Cancelaciones", [...catalog.generalTerms.cancellations, ...space.conditions])}
        ${section("Suplidores", catalog.generalTerms.suppliers)}
        ${section("Alimentos y bebidas", catalog.generalTerms.food)}
        ${section("Audiovisuales", catalog.generalTerms.audiovisual)}
        ${section("Actividades permitidas", catalog.generalTerms.activities)}
      </section>

      <div class="rental-detail-actions">
        <a class="button submit-button" href="renta-espacios.html?space=${encodeURIComponent(space.id)}#solicitud-renta">Solicitar este espacio</a>
        <a class="button secondary" href="renta-espacios.html#catalogo-espacios">Volver a espacios</a>
      </div>
    </article>
  `;

  root.querySelectorAll(".rental-image img").forEach((image) => {
    const figure = image.closest(".rental-image");
    const reveal = () => figure?.classList.add("has-image");
    const fallback = () => figure?.classList.remove("has-image");
    image.addEventListener("load", reveal, { once: true });
    image.addEventListener("error", fallback, { once: true });
    if (image.complete) image.naturalWidth ? reveal() : fallback();
  });

  const track = root.querySelector("[data-rental-gallery-track]");
  const indicators = Array.from(root.querySelectorAll(".rental-gallery-indicators span"));
  const move = (direction) => track?.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
  root.querySelector("[data-gallery-previous]")?.addEventListener("click", () => move(-1));
  root.querySelector("[data-gallery-next]")?.addEventListener("click", () => move(1));
  track?.addEventListener("scroll", () => {
    const index = Math.max(0, Math.min(indicators.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
    indicators.forEach((indicator, itemIndex) => indicator.classList.toggle("is-active", itemIndex === index));
  }, { passive: true });
})();
