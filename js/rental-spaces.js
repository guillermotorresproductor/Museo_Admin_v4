(function () {
  "use strict";

  const imageRoot = "images/renta-espacios";
  const imageSet = (slug, conceptual = false) => [
    { src: `${imageRoot}/${slug}/principal.jpg`, alt: conceptual ? "Representación conceptual del montaje" : `Vista principal de ${slug}` },
    { src: `${imageRoot}/${slug}/galeria-1.jpg`, alt: conceptual ? "Representación conceptual del montaje" : `Primera vista adicional de ${slug}` },
    { src: `${imageRoot}/${slug}/galeria-2.jpg`, alt: conceptual ? "Representación conceptual del montaje" : `Segunda vista adicional de ${slug}` }
  ];

  const generalTerms = {
    payment: [
      "El alquiler es prepagado.",
      "El pago se realiza después de aprobarse la solicitud.",
      "La reservación no queda confirmada hasta completarse los pagos, documentos y requisitos."
    ],
    insurance: [
      "Se requiere póliza de responsabilidad pública conforme a los requisitos del Municipio Autónomo de Guaynabo.",
      "La póliza debe presentarse y aprobarse antes de la actividad."
    ],
    cancellations: [
      "Con 30 días o más podrá autorizarse una devolución total.",
      "Con menos de 30 días, pero antes de los dos días previos, podrá retenerse hasta 50%.",
      "El día anterior no se devuelve el importe pagado.",
      "En emergencias o eventos fortuitos que imposibiliten la actividad podrá evaluarse un crédito para otra reservación dentro de un año."
    ],
    suppliers: [
      "Dos semanas antes del evento deben presentarse la lista de suplidores, su información de contacto, servicios, equipos y horarios de llegada, montaje y desmontaje."
    ],
    protection: [
      "No se permite pegar materiales en paredes, grapar, clavar, perforar ni pintar superficies.",
      "No se permite confeti, máquinas de humo no autorizadas, chispas frías ni efectos especiales no autorizados.",
      "No se permite arrastrar equipos o mobiliario. Todo equipo debe transportarse mediante dolly, hand truck o carrito con ruedas de goma."
    ],
    food: ["Todo catering, distribución o venta de alimentos y bebidas debe informarse y aprobarse previamente."],
    audiovisual: [
      "Los equipos del Museo serán operados exclusivamente por personal autorizado.",
      "Los servicios especializados no incluidos expresamente en el canon podrán conllevar costos adicionales."
    ],
    activities: [
      "Se permiten actividades cívicas, sociales, educativas, culturales, recreativas, artísticas, corporativas e institucionales.",
      "Se prohíben actividades de carácter político-partidista.",
      "Las demás solicitudes se evalúan individualmente conforme al Reglamento."
    ]
  };

  const publicSpaces = [
    {
      id: "salon-lito-pena", name: "Salón Lito Peña", description: "Espacio exclusivo, elegante y versátil para conferencias, galas, eventos corporativos, actividades culturales y eventos de formato mediano.",
      canon: 1000, priceSummary: "$1,000 por día", capacitySummary: "100 en sillas · 80 en mesas", schedule: "6:00 p. m. a 12:00 a. m.", duration: "Máximo de seis horas", deposit: "$500", area: "",
      setup: "Montaje coordinado con Administración.", breakdown: "Recogido de 12:00 a. m. a 1:00 a. m.",
      included: ["Sonido básico", "Iluminación básica"], excluded: ["Equipos y servicios audiovisuales especializados; tienen costo adicional."],
      requirements: ["Seguro de responsabilidad pública aprobado antes de la actividad."], restrictions: [], conditions: [], images: imageSet("salon-lito-pena", true)
    },
    {
      id: "anfiteatro-andy-montanez", name: "Anfiteatro Andy Montañez", description: "Espacio techado al aire libre para presentaciones artísticas, conciertos, conferencias, actividades culturales, educativas, corporativas e institucionales.",
      canon: 1000, priceSummary: "$1,000 por día", capacitySummary: "Hasta 200 personas", schedule: "8:00 a. m. a 12:00 a. m.", duration: "Un día de uso autorizado", deposit: "$500", area: "",
      setup: "Montaje coordinado con Administración.", breakdown: "Recogido de 12:00 a. m. a 1:00 a. m.",
      included: ["Dos camerinos con aire acondicionado", "Sonido básico", "Iluminación básica"], excluded: ["Equipos especializados y configuraciones de audio, video o luces; tienen costo adicional."],
      requirements: ["Seguro de responsabilidad pública aprobado antes de la actividad.", "La venta de comida o bebida requiere autorización previa y escrita."],
      restrictions: ["Nivel máximo de sonido: 60 dB, medido en el punto establecido por Administración."], conditions: ["No se devuelve el canon por lluvia o condiciones ordinarias de mal tiempo."], images: imageSet("anfiteatro-andy-montanez")
    },
    {
      id: "salon-multiuso", name: "Salón Multiuso", description: "Espacio funcional, cómodo y versátil para talleres, reuniones, conferencias, adiestramientos y actividades educativas de formato reducido.",
      canon: 300, hourlyRate: 40, minimumHours: 2, priceSummary: "$300 por día · $40 por hora", capacitySummary: "Hasta 60 personas", schedule: "8:00 a. m. a 10:00 p. m.", duration: "Hasta ocho horas consecutivas por canon diario", deposit: "Según evaluación", area: "",
      setup: "Coordinado con Administración.", breakdown: "Coordinado con Administración.", included: ["No incluye equipos."], excluded: ["Equipos adicionales sujetos a disponibilidad, aprobación y costo."],
      requirements: ["Reservación mínima de dos horas; costo mínimo de $80."], restrictions: [], conditions: [], images: imageSet("salon-multiuso")
    },
    {
      id: "terraza-de-la-musica", name: "La Terraza de la Música", regulatoryName: "Plazoleta", description: "Espacio exterior abierto y versátil, contiguo al Anfiteatro Andy Montañez, ideal para recepciones, exhibiciones, actividades culturales, encuentros comunitarios y eventos especiales al aire libre.",
      canon: 600, priceSummary: "$600 por doce horas", capacitySummary: "Hasta 200 personas", schedule: "Horario coordinado con Administración", duration: "Doce horas consecutivas", deposit: "Según evaluación", area: "Aproximadamente 1,158 pies cuadrados",
      setup: "Coordinado con Administración.", breakdown: "Coordinado con Administración.", included: ["No incluye equipos."], excluded: [], requirements: ["Horario específico sujeto a coordinación administrativa."], restrictions: [], conditions: [], images: imageSet("terraza-de-la-musica")
    },
    {
      id: "lobby", name: "El Lobby", regulatoryName: "Vestíbulo (Lobby)", description: "Elegante espacio interior ubicado en la entrada principal del Museo, ideal para recepciones, cócteles, exhibiciones, encuentros institucionales y actividades culturales de formato mediano.",
      canon: 600, priceSummary: "$600 por el periodo incluido", capacitySummary: "Hasta 80 personas", schedule: "6:00 p. m. a 10:00 p. m.", duration: "Cuatro horas", deposit: "Según evaluación", area: "Aproximadamente 1,300 pies cuadrados",
      setup: "Coordinado con Administración.", breakdown: "Coordinado con Administración.", included: ["No incluye equipos."], excluded: [], requirements: [], restrictions: [], conditions: [], images: imageSet("lobby")
    },
    {
      id: "cine-bienvenida", name: "Cine Bienvenida", description: "Espacio audiovisual inmersivo con pantalla panorámica de hasta 180 grados, diseñado para documentales, conferencias, talleres, estrenos, presentaciones educativas y experiencias multimedia.",
      canon: 600, priceSummary: "$600 por el periodo incluido", capacitySummary: "Hasta 25 personas", schedule: "6:00 p. m. a 10:00 p. m.", duration: "Cuatro horas", deposit: "Según evaluación", area: "",
      setup: "Configuración audiovisual por personal autorizado.", breakdown: "Coordinado con Administración.",
      included: ["Pantalla panorámica", "Sistema profesional de proyección", "Sistema profesional de sonido", "Aire acondicionado", "Butacas", "Configuración audiovisual", "Operación y asistencia técnica por personal autorizado"],
      excluded: [], requirements: ["Clientes y suplidores no pueden operar directamente los equipos."], restrictions: [], conditions: [], images: imageSet("cine-bienvenida")
    }
  ];

  const parking = {
    id: "estacionamiento", name: "Estacionamiento", public: false, description: "Espacio de acceso exclusivamente administrativo.", canon: 2500,
    priceSummary: "$2,500 por 24 horas", capacitySummary: "3,000–5,000 personas · aproximadamente 100 vehículos", schedule: "24 horas consecutivas", duration: "24 horas", deposit: "Determinada según el evento", area: "",
    setup: "Sujeto a distribución, estructuras y permisos.", breakdown: "Coordinado con Administración.", included: ["No incluye equipos."], excluded: [],
    requirements: ["La capacidad final depende de distribución, estructuras, permisos, seguridad, Bomberos y manejo de emergencias."], restrictions: ["Solo puede reservarse mediante Administración."], conditions: [], images: imageSet("estacionamiento")
  };

  const allSpaces = [...publicSpaces, parking];
  const byId = (id) => allSpaces.find((space) => space.id === id) || null;
  const money = (value) => Number(value || 0).toLocaleString("es-PR", { style: "currency", currency: "USD" });
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
  const imageMarkup = (image, className = "") => `<figure class="rental-image ${className}"><img src="${escape(image.src)}" alt="${escape(image.alt)}" loading="lazy"><figcaption>${escape(image.alt)}</figcaption><div class="rental-image-placeholder" aria-hidden="true">Foto pendiente</div></figure>`;
  const listMarkup = (items) => `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;

  window.RentalSpaces = { publicSpaces, parking, allSpaces, generalTerms, byId, money, escape, imageMarkup, listMarkup };
})();
