// Ajustes iniciales de la obra.
// Podés editarlos acá a mano, o moverlos en el panel (tecla G),
// apretar "Copiar ajustes" y pegar el resultado reemplazando este archivo.

const CONFIG = {
  // Segundos que dura el loop completo (noche → noche). Para la obra: 360.
  duracion: 30,

  escena: {
    horizonte: 0.62,     // altura del horizonte en pantalla (0 abajo, 1 arriba)
    islas: 1.0,          // altura de las islas de enfrente (0 = sin islas)
    reflejo: 0.5,        // ancho del camino de luz del sol y la luna sobre el agua
    orilla: 0.8,         // cuánto se ve el fondo con cáusticas cerca de la playa
  },

  agua: {
    agitacion: 1.0,      // qué tan movida está la superficie
    velocidad: 1.0,      // qué tan rápido suben y bajan las olas (0 = quietas)
    corriente: 0,        // 0 = las olas suben y bajan en su lugar, 1 = avanzan hacia la orilla
    escala: 1.0,         // tamaño de las olas (más = olas más chicas)
    rumbo: 90,           // grados: 90 = crestas paralelas al horizonte
    apertura: 50,        // grados: cuánto se abren las olas alrededor del rumbo
    nitidez: 1.25,       // contraste de las cáusticas de la orilla
    dispersion: 0.02,    // separación de colores en las cáusticas (como un prisma)
    turbidez: 0.3,       // barro del Paraná: cuánto se ve el fondo y el contraste de la luz
    exposicion: 1.0,
    rafagas: 0.35,       // el viento: agita y calma el agua a lo largo del loop
    rafagasPorLoop: 3,
    vineta: 0.25,        // oscurece los bordes
    semilla: 7,          // otra semilla = otro dibujo de olas
  },

  // 0 a 1. Después lo va a alimentar el sensor de gente.
  gente: 0,

  elementos: {
    mostrar: true,
    cantidad: 7,
    tamano: 1.0,
    velocidad: 1.0,      // cruces de pantalla cada 30 s
    desenfoque: 1,       // px
    opacidad: 0.9,
    color: '#3a3f22',    // color a pleno sol; se oscurece con la luz del momento
    semilla: 3,
  },

  // Momentos del día. "pos" es el lugar en el loop (0 a 1); entre ellos se mezcla.
  // El sol sale en 0.25 y se pone en 0.75; la luna, al revés.
  momentos: [
    { nombre: 'noche',     pos: 0.00, cielo: '#04060c', horizonte: '#121624', islas: '#030404', agua: '#0a0806', luz: '#9fb2cc', intensidad: 0.50, agitacion: 0.45 },
    { nombre: 'amanecer',  pos: 0.25, cielo: '#34446a', horizonte: '#f0a06a', islas: '#16130f', agua: '#3a2414', luz: '#ffb27a', intensidad: 1.00, agitacion: 0.60 },
    { nombre: 'mediodía',  pos: 0.50, cielo: '#6a9cd0', horizonte: '#d4e0e6', islas: '#2a3622', agua: '#6b4a2b', luz: '#fff3dd', intensidad: 1.00, agitacion: 1.00 },
    { nombre: 'atardecer', pos: 0.75, cielo: '#2c3764', horizonte: '#ff8a4c', islas: '#1a120c', agua: '#3d2212', luz: '#ff8c42', intensidad: 1.00, agitacion: 0.75 },
  ],
};
