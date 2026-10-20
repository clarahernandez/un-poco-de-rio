// un poco de río — el Paraná visto desde la playa
//
// Teclas:  G panel · F pantalla completa · espacio pausa
// URL:     index.html?t=0.5&pausa&panel=0  (arranca en ese momento del loop)
//          index.html?domo                  (versión planetario: fisheye 2048 × 2048)

let agua, sombras, shaderAgua, panel;
let ondas;
// reloj: segundos dentro del loop. El día entero dura CONFIG.duracion y en
// el momento CONFIG.negroEn (cuando se termina de poner la luna) se
// intercala el negro total, de CONFIG.negro segundos.
// progreso: en qué momento del día estamos (0 a 1), sale del reloj.
const estado = { reloj: 0, progreso: 0, pausa: false, momento: '' };

const DOMO = new URLSearchParams(location.search).has('domo');
const DOMO_PX = 2048;   // diámetro que pide el planetario

function setup() {
  pixelDensity(1);
  if (DOMO) {
    // Tamaño fijo: en pantalla se achica para entrar, pero se dibuja a 2048
    createCanvas(DOMO_PX, DOMO_PX);
    document.body.classList.add('domo');
  } else {
    createCanvas(windowWidth, windowHeight);
  }
  agua = createGraphics(width, height, WEBGL);
  agua.noStroke();
  shaderAgua = agua.createShader(VERT, FRAG);
  sombras = createGraphics(width, height);

  const params = new URLSearchParams(location.search);
  if (params.has('t')) irAlMomento(fract(parseFloat(params.get('t')) || 0));
  if (params.has('pausa')) estado.pausa = true;

  generarOndas();
  generarElementos();
  crearPanel();
  if (params.get('panel') === '0') togglePanel();
}

function draw() {
  const total = duracionLoop();
  if (!estado.pausa) {
    const dt = Math.min(deltaTime, 100) / 1000;
    estado.reloj = (estado.reloj + dt) % total;
  }
  estado.reloj = Math.min(estado.reloj, total);
  const p = (estado.progreso = progresoDe(estado.reloj));
  const m = momentoActual(p);
  estado.momento = m.nombre;

  const A = CONFIG.agua;
  const rafaga = 1 + A.rafagas * Math.sin(TWO_PI * A.rafagasPorLoop * p);
  const agitacion = (DOMO ? CONFIG.domo.agitacion : m.agitacion) * A.agitacion * rafaga;

  dibujarAgua(p, m, agitacion);
  image(agua, 0, 0);
  if (!DOMO) dibujarCamalotes(p, m);   // en el domo van solo las cáusticas
  oscuridad();
}

function dibujarCamalotes(p, m) {
  const E = CONFIG.elementos;
  if (E.mostrar && elementos.length) {
    // Los camalotes toman la luz del momento: de día se ven, de noche son siluetas
    const luz = m.luz.map((v) => Math.min(1, 0.15 + v * m.intensidad * (0.3 + 0.7 * m.solVis)));
    dibujarElementos(sombras, p, luz);
    push();
    drawingContext.filter = E.desenfoque > 0 ? `blur(${E.desenfoque}px)` : 'none';
    tint(255, E.opacidad * 255);
    image(sombras, 0, 0);
    drawingContext.filter = 'none';
    pop();
  }
}

// ---------- Tiempo ----------

function duracionLoop() {
  return CONFIG.negro + CONFIG.duracion;
}

// Segundo del reloj en que empieza el negro
function inicioNegro() {
  return CONFIG.negroEn * CONFIG.duracion;
}

// Momento del día (0 a 1) para un segundo del reloj: durante el negro se queda quieto
function progresoDe(r) {
  const b = inicioNegro(), N = CONFIG.negro;
  if (r < b) return r / CONFIG.duracion;
  if (r < b + N) return CONFIG.negroEn;
  return Math.min((r - N) / CONFIG.duracion, 0.99999);
}

// Saltar a un momento del día (0 a 1) desde la URL o el panel
function irAlMomento(p) {
  estado.reloj = p * CONFIG.duracion + (p > CONFIG.negroEn ? CONFIG.negro : 0);
}

// Negro total cuando termina de pasar la luna: se apaga en "fundido"
// segundos, queda negro "negro" segundos y vuelve en otros "fundido" segundos.
function oscuridad() {
  const N = CONFIG.negro, F = Math.max(CONFIG.fundido, 0.001);
  if (N <= 0) return;
  const total = duracionLoop(), b = inicioNegro();
  const desde = (estado.reloj - b + total) % total;    // segundos desde que empezó el negro
  let a = 1;
  if (desde > N) {
    const antes = total - desde;    // cuánto falta para el próximo negro
    a = Math.max(1 - suave(0, F, antes), 1 - suave(0, F, desde - N));
  }
  if (a <= 0) return;
  push();
  noStroke();
  fill(0, a * 255);
  rect(0, 0, width, height);
  pop();
}

// ---------- Agua ----------

function generarOndas() {
  const r = mulberry32(CONFIG.agua.semilla);
  ondas = [];
  for (let i = 0; i < NUM_ONDAS; i++) {
    const grande = i < NUM_ONDAS / 2;
    ondas.push({
      giro: (r() * 2 - 1) * (grande ? 1 : 1.5),    // relativo a la apertura
      k: grande ? 14 + r() * 10 : 30 + r() * 25,
      amp: grande ? 1 : 0.55,
      des: r() * TWO_PI,
    });
  }
  // Normalizar para que "agitación" signifique lo mismo con cualquier semilla
  const energia = Math.sqrt(ondas.reduce((s, o) => s + o.amp * o.amp, 0) / 2);
  for (const o of ondas) o.amp /= energia;
}

function dibujarAgua(p, m, agitacion) {
  const A = CONFIG.agua;
  const dx = [], dy = [], k = [], amp = [], cic = [], des = [];
  for (const o of ondas) {
    const ang = radians(A.rumbo) + o.giro * radians(A.apertura);
    const kk = o.k * A.escala;
    dx.push(Math.cos(ang));
    dy.push(Math.sin(ang));
    k.push(kk * 0.35);   // en el agua, medido en "alturas de los ojos"
    amp.push(o.amp);
    // En el domo todo se ve más rápido (la imagen es enorme), por eso va más lento
    const vel = A.velocidad * (DOMO ? CONFIG.domo.velocidad : 1);
    const porMinuto = 1.4 * Math.sqrt(kk) * vel;
    // Vueltas por loop: siempre un número entero, así el loop cierra perfecto
    cic.push(vel > 0 ? Math.max(1, Math.round(porMinuto * duracionLoop() / 60)) : 0);
    des.push(o.des);
  }

  agua.shader(shaderAgua);
  shaderAgua.setUniform('uRes', [agua.width, agua.height]);
  // Las olas siguen el reloj (no el momento del día), así se mueven también en el negro
  shaderAgua.setUniform('uFase', TWO_PI * estado.reloj / duracionLoop());
  shaderAgua.setUniform('uDx', dx);
  shaderAgua.setUniform('uDy', dy);
  shaderAgua.setUniform('uK', k);
  shaderAgua.setUniform('uAmp', amp);
  shaderAgua.setUniform('uCic', cic);
  shaderAgua.setUniform('uDes', des);
  shaderAgua.setUniform('uCorriente', A.corriente);
  shaderAgua.setUniform('uD', 1.5 * Math.max(0, agitacion));
  shaderAgua.setUniform('uNitidez', A.nitidez);
  shaderAgua.setUniform('uDispersion', A.dispersion);
  shaderAgua.setUniform('uTurbidez', A.turbidez);
  shaderAgua.setUniform('uExpo', A.exposicion);
  shaderAgua.setUniform('uVineta', A.vineta);
  shaderAgua.setUniform('uAgua', m.agua);
  shaderAgua.setUniform('uLuz', m.luz);
  shaderAgua.setUniform('uInt', m.intensidad);
  shaderAgua.setUniform('uColCielo', m.cielo);
  shaderAgua.setUniform('uColHorizonte', m.horizonte);
  shaderAgua.setUniform('uColIslas', m.islas);

  const S = CONFIG.escena;
  shaderAgua.setUniform('uHorizonte', S.horizonte);
  shaderAgua.setUniform('uIslas', 0);   // sin islas
  shaderAgua.setUniform('uReflejo', Math.pow(2000, 1 - S.reflejo) * Math.pow(20, S.reflejo));
  shaderAgua.setUniform('uOrilla', S.orilla);

  const E = CONFIG.estilo;
  shaderAgua.setUniform('uPerspectiva', E.perspectiva);
  shaderAgua.setUniform('uOrganico', E.organico);
  shaderAgua.setUniform('uCapas', E.capas);
  shaderAgua.setUniform('uBorde', E.borde);
  shaderAgua.setUniform('uGrano', E.grano);
  shaderAgua.setUniform('uSol', m.sol);
  shaderAgua.setUniform('uLuna', m.luna);
  shaderAgua.setUniform('uSolVis', m.solVis);
  shaderAgua.setUniform('uLunaVis', m.lunaVis);

  const D = CONFIG.domo;
  shaderAgua.setUniform('uDomo', DOMO ? 1 : 0);
  if (DOMO) {
    shaderAgua.setUniform('uDomoEscala', D.escala);
    shaderAgua.setUniform('uDomoBrillo', D.brillo);
    shaderAgua.setUniform('uDomoContraste', D.contraste);
    // De día el marrón del río, de noche más oscuro; cambia despacio con la altura del sol
    const dia = suave(-0.25, 0.3, m.sol[1]);
    const fNoche = hexARgb(D.fondoNoche);
    shaderAgua.setUniform('uDomoFondo', hexARgb(D.fondo).map((v, n) => lerp(fNoche[n], v, dia)));
    shaderAgua.setUniform('uDomoSol', enDomo(m.sol));
    shaderAgua.setUniform('uDomoLuna', enDomo(m.luna));
    shaderAgua.setUniform('uDomoFoco', D.foco);
    shaderAgua.setUniform('uDomoRadio', D.radio);
    shaderAgua.setUniform('uDomoHalo', D.halo);
    shaderAgua.setUniform('uDomoMetal', D.metal * m.metal);
    shaderAgua.setUniform('uDomoLuzMetal', luzDelMetal(estado.progreso));
    shaderAgua.setUniform('uDomoCielo', D.cielo);
    shaderAgua.setUniform('uDomoColCielo', hexARgb(D.colorCielo));
    // La luz siempre al máximo: se estira el color hasta que su canal más alto vale 1
    const fija = hexARgb(D.luz);
    const luz = fija.map((v, n) => lerp(v, m.luz[n], D.ciclo));
    const tope = Math.max(...luz, 0.001);
    shaderAgua.setUniform('uDomoLuz', luz.map((v) => v / tope));
  }
  agua.rect(-agua.width / 2, -agua.height / 2, agua.width, agua.height);
}

// ---------- Momentos del día ----------

function momentoActual(p) {
  const ks = [...CONFIG.momentos].sort((a, b) => a.pos - b.pos);
  let i = ks.length - 1;
  for (let j = 0; j < ks.length; j++) if (ks[j].pos <= p) i = j;
  const a = ks[i];
  const b = ks[(i + 1) % ks.length];
  let tramo = b.pos - a.pos;
  if (tramo <= 0) tramo += 1;
  let t = fract(p - a.pos) / tramo;
  t = t * t * (3 - 2 * t);
  const m = {
    nombre: t < 0.5 ? a.nombre : b.nombre,
    intensidad: lerp(a.intensidad, b.intensidad, t),
    agitacion: lerp(a.agitacion, b.agitacion, t),
    metal: lerp(a.metal ?? 0, b.metal ?? 0, t),
  };
  for (const c of COLORES_MOMENTO) {
    const ca = hexARgb(a[c]), cb = hexARgb(b[c]);
    m[c] = ca.map((v, n) => lerp(v, cb[n], t));
  }

  // Miramos río abajo: el sol sale a nuestra espalda en 0.25, pasa por
  // arriba (un poco a la derecha, hacia el norte) y se pone de frente, en el
  // horizonte, en 0.75. La luna hace lo mismo de noche: sale atrás en 0.75
  // y se pone de frente en 0.25.
  const ang = TWO_PI * (p - 0.25);
  m.sol = direccion(Math.sin(ang) * 0.3, Math.sin(ang) * 0.9, -Math.cos(ang));
  m.luna = direccion(-Math.sin(ang) * 0.3, -Math.sin(ang) * 0.7, Math.cos(ang));
  m.solVis = suave(-0.03, 0.04, m.sol[1]);
  m.lunaVis = suave(-0.03, 0.04, m.luna[1]) * (1 - m.solVis);
  return m;
}

const COLORES_MOMENTO = ['cielo', 'horizonte', 'islas', 'agua', 'luz'];

// Color de luz del momento metalizado más cercano (amanecer o atardecer),
// estirado al brillo máximo, para que el metal no tome el azul de la luna
function luzDelMetal(p) {
  let mejor = null, dist = Infinity;
  for (const m of CONFIG.momentos) {
    if (!(m.metal > 0)) continue;
    const d = Math.min(Math.abs(p - m.pos), 1 - Math.abs(p - m.pos));
    if (d < dist) { dist = d; mejor = m; }
  }
  const luz = hexARgb(mejor ? mejor.luz : CONFIG.domo.luz);
  const tope = Math.max(...luz, 0.001);
  return luz.map((v) => v / tope);
}

function direccion(x, y, z) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

// Dirección en el cielo → punto del fisheye: el cenit en el centro, el
// horizonte en el borde (y bajo el horizonte, afuera del círculo).
function enDomo(dir) {
  const r = 1 - Math.asin(constrain(dir[1], -1, 1)) / HALF_PI;
  const az = Math.atan2(dir[0], dir[2]);
  return [r * Math.sin(az), r * Math.cos(az)];
}

function suave(a, b, x) {
  const t = constrain((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hexARgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---------- Panel ----------

function crearPanel() {
  panel = new lil.GUI({ title: 'un poco de río' });
  const A = CONFIG.agua, S = CONFIG.escena;

  const fT = panel.addFolder('Tiempo');
  fT.add(CONFIG, 'duracion', 5, 600, 1).name('duración del día (s)');
  fT.add(CONFIG, 'negro', 0, 60, 0.5).name('negro total (s)');
  fT.add(CONFIG, 'negroEn', 0, 0.999, 0.001).name('momento del negro');
  fT.add(CONFIG, 'fundido', 0, 20, 0.5).name('fundido al negro (s)');
  fT.add(estado, 'pausa').name('pausa').listen();
  fT.add(estado, 'progreso', 0, 1, 0.001).name('momento del día').listen()
    .onChange((v) => { estado.pausa = true; irAlMomento(v); });
  fT.add(estado, 'momento').name('ahora').listen().disable();

  const fS = panel.addFolder('Escena');
  fS.add(S, 'reflejo', 0, 1, 0.01).name('ancho del reflejo');

  const fEst = panel.addFolder('Estilo');
  fEst.add(CONFIG.estilo, 'perspectiva', 0, 1, 0.01);
  fEst.add(CONFIG.estilo, 'organico', 0, 2, 0.01).name('orgánico');
  fEst.add(CONFIG.estilo, 'capas', 0, 10, 1).name('capas de tono (0 = no)');
  fEst.add(CONFIG.estilo, 'borde', 0.01, 0.5, 0.01).name('borde suave');
  fEst.add(CONFIG.estilo, 'grano', 0, 1, 0.01).name('grano de papel');

  const fA = panel.addFolder('Agua');
  fA.add(A, 'agitacion', 0, 3, 0.01).name('agitación');
  fA.add(A, 'velocidad', 0, 4, 0.05);
  fA.add(A, 'corriente', 0, 1, 0.01).name('olas avanzan');
  fA.add(A, 'escala', 0.3, 3, 0.01);
  fA.add(A, 'rumbo', 0, 180, 1).name('rumbo (°)');
  fA.add(A, 'apertura', 0, 180, 1).name('apertura (°)');
  fA.add(A, 'nitidez', 0.5, 3, 0.01);
  fA.add(A, 'dispersion', 0, 0.3, 0.005).name('dispersión');
  fA.add(A, 'turbidez', 0, 1, 0.01).name('turbidez (barro)');
  fA.add(A, 'exposicion', 0.2, 3, 0.01).name('exposición');
  fA.add(A, 'rafagas', 0, 0.9, 0.01).name('ráfagas');
  fA.add(A, 'rafagasPorLoop', 0, 12, 1).name('ráfagas por loop');
  fA.add(A, 'vineta', 0, 1, 0.01).name('viñeta');
  fA.add(A, 'semilla', 1, 999, 1).onChange(generarOndas);

  if (DOMO) {
    const D = CONFIG.domo;
    const fD = panel.addFolder('Domo');
    fD.add(D, 'escala', 0.5, 6, 0.01).name('escala (más = más chicas)');
    fD.add(D, 'velocidad', 0.1, 1, 0.01).name('velocidad (× la del agua)');
    fD.add(D, 'agitacion', 0, 3, 0.01).name('agitación');
    fD.add(D, 'brillo', 0.1, 3, 0.01);
    fD.add(D, 'contraste', 0.5, 4, 0.01);
    fD.add(D, 'foco', 0, 1, 0.01).name('foco en sol / luna');
    fD.add(D, 'radio', 0.1, 1.5, 0.01).name('tamaño del foco');
    fD.add(D, 'halo', 0, 1, 0.01).name('resplandor');
    fD.add(D, 'metal', 0, 1, 0.01).name('metalizado');
    fD.add(D, 'cielo', 0, 1, 0.01).name('reflejo del cielo');
    fD.addColor(D, 'colorCielo').name('color del cielo');
    fD.addColor(D, 'fondo').name('color fondo (día)');
    fD.addColor(D, 'fondoNoche').name('color fondo (noche)');
    fD.addColor(D, 'luz').name('color luz');
    fD.add(D, 'ciclo', 0, 1, 0.01).name('color del momento del día');
  }

  const fM = panel.addFolder('Momentos del día');
  for (const m of CONFIG.momentos) {
    const f = fM.addFolder(m.nombre);
    f.add(m, 'pos', 0, 0.999, 0.001).name('posición');
    f.addColor(m, 'cielo').name('cielo');
    f.addColor(m, 'horizonte').name('cielo en el horizonte');
    f.addColor(m, 'islas').name('islas');
    f.addColor(m, 'agua').name('agua');
    f.addColor(m, 'luz').name('luz (sol / luna)');
    f.add(m, 'intensidad', 0, 3, 0.01);
    f.add(m, 'agitacion', 0, 3, 0.01).name('agitación');
    if (DOMO) f.add(m, 'metal', 0, 1, 0.01).name('metalizado (domo)');
    f.close();
  }
  fM.close();

  panel.add({ copiar: copiarAjustes }, 'copiar').name('Copiar ajustes');
  panel.add({ completa: () => fullscreen(!fullscreen()) }, 'completa').name('Pantalla completa (F)');
}

function togglePanel() {
  panel.show(panel._hidden);
  panel._hidden ? noCursor() : cursor();
}

function copiarAjustes() {
  const texto = '// Ajustes de la obra (copiados desde el panel).\n\nconst CONFIG = ' +
    JSON.stringify(CONFIG, null, 2) + ';\n';
  console.log(texto);
  navigator.clipboard.writeText(texto).then(
    () => aviso('Ajustes copiados: pegalos en config.js'),
    () => aviso('No pude copiar: están en la consola (F12)')
  );
}

function aviso(texto) {
  const div = createDiv(texto).class('aviso');
  setTimeout(() => div.remove(), 2500);
}

// ---------- Eventos ----------

function keyPressed() {
  if (key === 'g' || key === 'G') togglePanel();
  if (key === 'f' || key === 'F') fullscreen(!fullscreen());
  if (key === ' ') estado.pausa = !estado.pausa;
}

function windowResized() {
  if (DOMO) return;   // el domo siempre se dibuja a 2048 × 2048
  resizeCanvas(windowWidth, windowHeight);
  agua.resizeCanvas(width, height);
  sombras.resizeCanvas(width, height);
}
