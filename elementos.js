// Elementos que flotan en el río y van de derecha a izquierda.
// Se dibujan en perspectiva: los lejanos, cerca del horizonte, son chicos
// y aplastados; los cercanos, más grandes.
//
// Para que el loop sea perfecto, cada elemento cruza la pantalla un número
// entero de veces por loop y reaparece por la derecha fuera de cuadro.
//
// Para agregar un elemento nuevo: sumá una función en FORMAS que reciba
// el generador aleatorio y devuelva una función de dibujo, y agregá su
// nombre con su probabilidad en TIPOS.

const TIPOS = [
  ['camalote', 0.5],
  ['hoja', 0.3],
  ['rama', 0.2],
];

const FORMAS = {
  // Camalote: roseta de hojas redondas con raíces colgando
  camalote(r) {
    const n = 5 + Math.floor(r() * 5);
    const hojas = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + (r() - 0.5) * 0.6;
      const dist = 0.3 + r() * 0.25;
      hojas.push({ x: Math.cos(a) * dist, y: Math.sin(a) * dist, rx: 0.45 + r() * 0.2, ry: 0.3 + r() * 0.12, a });
    }
    const raices = [];
    const nr = 3 + Math.floor(r() * 4);
    for (let j = 0; j < nr; j++) {
      const a = (r() - 0.5) * 1.6;   // hacia atrás (derecha), la corriente las arrastra
      const largo = 1.1 + r() * 0.9;
      const pts = [];
      for (let s = 0; s <= 6; s++) {
        const t = s / 6;
        const ondula = Math.sin(t * 6 + j) * 0.08 * t;
        pts.push([Math.cos(a) * largo * t - Math.sin(a) * ondula, Math.sin(a) * largo * t + Math.cos(a) * ondula]);
      }
      raices.push(pts);
    }
    return (g, c) => {
      trazo(g, c, 0.05);
      for (const pts of raices) {
        g.beginShape();
        for (const [x, y] of pts) g.curveVertex(x, y);
        g.endShape();
      }
      relleno(g, c);
      for (const h of hojas) {
        g.push();
        g.translate(h.x, h.y);
        g.rotate(h.a);
        g.ellipse(0, 0, h.rx * 2, h.ry * 2);
        g.pop();
      }
      g.ellipse(0, 0, 0.6, 0.6);
    };
  },

  // Hoja suelta, alargada, con su cabito
  hoja(r) {
    const w = 0.3 + r() * 0.15;
    const curva = (r() - 0.5) * 0.3;
    return (g, c) => {
      relleno(g, c);
      g.beginShape();
      g.vertex(-1, 0);
      g.bezierVertex(-0.5, -w * 1.6 + curva, 0.5, -w * 1.2 + curva, 1, curva);
      g.bezierVertex(0.5, w * 1.2 + curva, -0.5, w * 1.6 + curva, -1, 0);
      g.endShape(g.CLOSE);
      trazo(g, c, 0.06);
      g.line(-1, 0, -1.4, 0.06);
    };
  },

  // Rama con algunas ramitas
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
    return (g, c) => {
      trazo(g, c, 0.1);
      g.beginShape();
      for (const [x, y] of pts) g.vertex(x, y);
      g.endShape();
      g.strokeWeight(0.05);
      for (const [x1, y1, x2, y2] of ramitas) g.line(x1, y1, x2, y2);
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
    const tipo = elegirTipo(r);
    elementos.push({
      dibujar: FORMAS[tipo](r),
      u: r(),                                  // dónde arranca en el recorrido
      y: 0.08 + r() * 0.84,                    // 0 = horizonte, 1 = orilla
      tam: 0.6 + r() * 0.8,
      cruces: r() < 0.75 ? 1 : 2,              // cruces cada 30 s
      olaCic: 1 + Math.floor(r() * 3), olaFase: r() * Math.PI * 2, olaAmp: 0.005 + r() * 0.015,
      rot0: tipo === 'camalote' ? (r() - 0.5) * 1.2 : (r() - 0.5) * 0.8,
      girCic: 1 + Math.floor(r() * 2), girFase: r() * Math.PI * 2,
    });
  }
}

// Dibuja los elementos en la capa g (con fondo transparente)
function dibujarElementos(g, progreso, color) {
  const E = CONFIG.elementos;
  const horizonte = CONFIG.escena.horizonte;
  const F = 1.2;                                   // la misma focal que el shader
  g.clear();
  g.strokeCap(g.ROUND);
  g.strokeJoin(g.ROUND);
  // Primero los lejanos, así los cercanos quedan adelante
  const orden = [...elementos].sort((a, b) => a.y - b.y);
  for (const e of orden) {
    // Distancia al horizonte en pantalla, solo dentro de la parte visible del agua
    const arriba = Math.max(0, horizonte - 1);
    const dy = arriba + (horizonte - arriba) * (0.04 + 0.96 * e.y);
    const cerca = dy / horizonte;                   // 1 en la orilla, ~0 en el horizonte
    const aplastado = dy / Math.hypot(dy, F);       // el agua se ve de costado
    const base = g.height * 0.08 * cerca * e.tam * E.tamano;
    const margen = base * 2.5;
    const vueltas = Math.max(1, Math.round(e.cruces * E.velocidad * CONFIG.duracion / 30));
    const x = g.width + margen - fract(e.u + vueltas * progreso) * (g.width + 2 * margen);
    const ola = Math.sin(Math.PI * 2 * e.olaCic * progreso + e.olaFase) * e.olaAmp * cerca;
    const y = g.height * (1 - horizonte + dy + ola);
    const rot = e.rot0 + 0.3 * Math.sin(Math.PI * 2 * e.girCic * progreso + e.girFase);
    g.push();
    g.translate(x, y);
    g.scale(base, base * aplastado);
    g.rotate(rot);
    e.dibujar(g, color);
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
