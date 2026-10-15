// Elementos que flotan en el río y van de derecha a izquierda.
//
// Los camalotes (Eichhornia crassipes) se ven desde la playa como plantitas
// paradas sobre la línea del agua: una base de tallos inflados (sus
// flotadores), hojas redondas y a veces una espiga de flores lilas. Bajan
// sueltos o en matas. También pasa alguna rama, acostada en el agua.
//
// Se dibujan en perspectiva: los lejanos son más chicos que los cercanos.
//
// Para que el loop sea perfecto, cada elemento cruza la pantalla un número
// entero de veces por loop y reaparece por la derecha fuera de cuadro.
//
// Para agregar un elemento nuevo: sumá una función en FORMAS que reciba
// el generador aleatorio y devuelva { dibujar, parado }, y agregá su
// nombre con su probabilidad en TIPOS.

const TIPOS = [
  ['camalote', 0.55],
  ['mata', 0.35],
  ['rama', 0.1],
];

// Una planta de camalote. Unidades: alto de la planta ≈ 1, línea del agua en y = 0.
function planta(r) {
  const n = 4 + Math.floor(r() * 4);
  const hojas = [];
  for (let j = 0; j < n; j++) {
    const t = (j / (n - 1)) * 2 - 1;                    // -1 izquierda … 1 derecha
    const ang = t * 0.85 + (r() - 0.5) * 0.25;          // inclinación desde la vertical
    const largo = (0.32 + r() * 0.22) * (1 - 0.3 * Math.abs(t));
    const x0 = t * 0.18;
    hojas.push({
      x0, ang,
      x: x0 + Math.sin(ang) * largo,
      y: -0.12 - Math.cos(ang) * largo,
      rx: 0.22 + r() * 0.08,
      ry: 0.18 + r() * 0.05,
      orden: Math.abs(t) + r() * 0.2,
    });
  }
  hojas.sort((a, b) => b.orden - a.orden);              // las del centro quedan adelante
  const flor = r() < 0.35
    ? { x: (r() - 0.5) * 0.2, alto: 0.85 + r() * 0.2, n: 5 + Math.floor(r() * 3) }
    : null;

  return (g, col) => {
    // Sombra en la línea del agua
    relleno(g, col.sombra);
    g.ellipse(0, 0.02, 1.0, 0.14);
    // Tallos inflados
    trazo(g, col.base, 0.14);
    for (const h of hojas) g.line(h.x0, -0.08, lerp(h.x0, h.x, 0.8), lerp(-0.08, h.y, 0.8));
    relleno(g, col.base);
    g.ellipse(0, -0.1, 0.7, 0.28);
    // Hojas redondas
    relleno(g, col.hoja);
    for (const h of hojas) {
      g.push();
      g.translate(h.x, h.y);
      g.rotate(h.ang);
      g.ellipse(0, 0, h.rx * 2, h.ry * 2);
      g.pop();
    }
    // Espiga de flores lilas
    if (flor) {
      trazo(g, col.base, 0.04);
      g.line(flor.x, -0.1, flor.x, -flor.alto);
      relleno(g, col.flor);
      for (let k = 0; k < flor.n; k++) {
        g.ellipse(flor.x + ((k % 2) - 0.5) * 0.08, -flor.alto + k * 0.06, 0.1, 0.09);
      }
    }
  };
}

const FORMAS = {
  // Un camalote suelto
  camalote(r) {
    return { dibujar: planta(r), parado: true };
  },

  // Una matita de 2 a 4 camalotes juntos
  mata(r) {
    const n = 2 + Math.floor(r() * 3);
    const plantas = [];
    for (let j = 0; j < n; j++) {
      plantas.push({ x: (j - (n - 1) / 2) * 0.55 + (r() - 0.5) * 0.2, esc: 0.6 + r() * 0.45, dibujar: planta(r) });
    }
    plantas.sort((a, b) => a.esc - b.esc);
    return {
      parado: true,
      dibujar: (g, col) => {
        for (const p of plantas) {
          g.push();
          g.translate(p.x, 0);
          g.scale(p.esc);
          p.dibujar(g, col);
          g.pop();
        }
      },
    };
  },

  // Rama con algunas ramitas, acostada en el agua
  rama(r) {
    const pts = [];
    for (let s = 0; s <= 6; s++) pts.push([-1.6 + (s / 6) * 3.2, (r() - 0.5) * 0.16]);
    const ramitas = [];
    const n = 2 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) {
      const [x, y] = pts[1 + Math.floor(r() * 5)];
      const a = (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.5);
      const largo = 0.4 + r() * 0.5;
      ramitas.push([x, y, x + Math.cos(a) * largo, y + Math.sin(a) * largo]);
    }
    return {
      parado: false,
      dibujar: (g, col) => {
        trazo(g, col.rama, 0.1);
        g.beginShape();
        for (const [x, y] of pts) g.vertex(x, y);
        g.endShape();
        g.strokeWeight(0.05);
        for (const [x1, y1, x2, y2] of ramitas) g.line(x1, y1, x2, y2);
      },
    };
  },
};

let elementos = [];

function elegirTipo(r) {
  let x = r() * TIPOS.reduce((s, [, p]) => s + p, 0);
  for (const [tipo, p] of TIPOS) {
    if ((x -= p) <= 0) return tipo;
  }
  return TIPOS[0][0];
}

function generarElementos() {
  const r = mulberry32(CONFIG.elementos.semilla * 9973 + 1);
  elementos = [];
  for (let i = 0; i < CONFIG.elementos.cantidad; i++) {
    const forma = FORMAS[elegirTipo(r)](r);
    elementos.push({
      ...forma,
      u: r(),                                  // dónde arranca en el recorrido
      y: 0.08 + r() * 0.84,                    // 0 = lejos, 1 = orilla
      tam: 0.7 + r() * 0.6,
      cruces: r() < 0.75 ? 1 : 2,              // cruces cada 30 s
      olaCic: 1 + Math.floor(r() * 3), olaFase: r() * Math.PI * 2, olaAmp: 0.003 + r() * 0.006,
      rot0: forma.parado ? 0 : (r() - 0.5) * 0.8,
      giro: forma.parado ? 0.06 : 0.3,         // cuánto se mece
      girCic: 1 + Math.floor(r() * 2), girFase: r() * Math.PI * 2,
    });
  }
}

// Dibuja los elementos en la capa g (con fondo transparente).
// luz: cuánto ilumina el momento del día a cada canal (0 a 1).
function dibujarElementos(g, progreso, luz) {
  const E = CONFIG.elementos;
  const horizonte = CONFIG.escena.horizonte;
  const F = 1.2;                                   // la misma focal que el shader
  const tenir = (hex, k = 1) => hexARgb(hex).map((v, n) => 255 * v * luz[n] * k);
  const col = {
    hoja: tenir(E.color),
    base: tenir(E.color, 0.75),
    sombra: tenir(E.color, 0.3),
    flor: tenir(E.colorFlor),
    rama: tenir('#4a3622'),
  };

  g.clear();
  g.strokeCap(g.ROUND);
  g.strokeJoin(g.ROUND);
  // Primero los lejanos, así los cercanos quedan adelante
  const orden = [...elementos].sort((a, b) => a.y - b.y);
  for (const e of orden) {
    // Distancia al horizonte en pantalla, solo dentro de la parte visible del agua
    const arriba = Math.max(0, horizonte - 1);
    const dy = arriba + (horizonte - arriba) * (0.04 + 0.96 * e.y);
    const p = CONFIG.estilo.perspectiva;            // con poca perspectiva, todos parecidos
    const cerca = lerp(0.75, dy / horizonte, p);    // 1 en la orilla, ~0 en el horizonte
    const aplastado = lerp(0.5, dy / Math.hypot(dy, F), p);   // el agua se ve de costado
    const base = g.height * 0.035 * cerca * e.tam * E.tamano;
    const margen = base * 2.5;
    const vueltas = Math.max(1, Math.round(e.cruces * E.velocidad * CONFIG.duracion / 30));
    const x = g.width + margen - fract(e.u + vueltas * progreso) * (g.width + 2 * margen);
    const ola = Math.sin(Math.PI * 2 * e.olaCic * progreso + e.olaFase) * e.olaAmp * cerca;
    const y = g.height * (1 - horizonte + dy + ola);
    const rot = e.rot0 + e.giro * Math.sin(Math.PI * 2 * e.girCic * progreso + e.girFase);
    g.push();
    g.translate(x, y);
    if (e.parado) g.scale(base);                    // las plantas están paradas
    else g.scale(base, base * aplastado);           // las ramas, acostadas en el agua
    g.rotate(rot);
    e.dibujar(g, col);
    g.pop();
  }
}

function relleno(g, c) {
  g.fill(c);
  g.noStroke();
}

function trazo(g, c, grosor) {
  g.noFill();
  g.stroke(c);
  g.strokeWeight(grosor);
}

function fract(x) {
  return x - Math.floor(x);
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
