// un poco de río — el Paraná visto desde la playa
//
// Teclas:  G panel · F pantalla completa · espacio pausa
// URL:     index.html?t=0.5&pausa&panel=0  (arranca en ese momento del loop)

let agua, sombras, shaderAgua, panel;
let ondas;
const estado = { progreso: 0, pausa: false, momento: '', genteSuave: 0 };

function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight);
  agua = createGraphics(width, height, WEBGL);
  agua.noStroke();
  shaderAgua = agua.createShader(VERT, FRAG);
  sombras = createGraphics(width, height);

  const params = new URLSearchParams(location.search);
  if (params.has('t')) estado.progreso = fract(parseFloat(params.get('t')) || 0);
  if (params.has('pausa')) estado.pausa = true;

  generarOndas();
  generarElementos();
  crearPanel();
  if (params.get('panel') === '0') togglePanel();
}

function draw() {
  if (!estado.pausa) {
    const dt = Math.min(deltaTime, 100) / 1000;
    estado.progreso = fract(estado.progreso + dt / CONFIG.duracion);
  }
  const p = estado.progreso;
  const m = momentoActual(p);
  estado.momento = m.nombre;

  // La gente cambia de a poco, para que el agua no salte
  estado.genteSuave = lerp(estado.genteSuave, CONFIG.gente, 0.02);

  const A = CONFIG.agua;
  const rafaga = 1 + A.rafagas * Math.sin(TWO_PI * A.rafagasPorLoop * p);
  const agitacion = (m.agitacion + estado.genteSuave * 1.2) * A.agitacion * rafaga;

  dibujarAgua(p, m, agitacion);
  image(agua, 0, 0);

  const E = CONFIG.elementos;
  if (E.mostrar && elementos.length) {
    // Los camalotes toman la luz del momento: de día se ven, de noche son siluetas
    const base = hexARgb(E.color);
    const color = base.map((v, n) => 255 * v * Math.min(1, 0.15 + m.luz[n] * m.intensidad * (0.3 + 0.7 * m.solVis)));
    dibujarElementos(sombras, p, color);
    push();
    drawingContext.filter = E.desenfoque > 0 ? `blur(${E.desenfoque}px)` : 'none';
    tint(255, E.opacidad * 255);
    image(sombras, 0, 0);
    drawingContext.filter = 'none';
    pop();
  }
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
    // Vueltas por loop: siempre un número entero, así el loop cierra perfecto
    const porMinuto = 1.4 * Math.sqrt(kk) * A.velocidad;
    cic.push(A.velocidad > 0 ? Math.max(1, Math.round(porMinuto * CONFIG.duracion / 60)) : 0);
    des.push(o.des);
  }

  agua.shader(shaderAgua);
  shaderAgua.setUniform('uRes', [agua.width, agua.height]);
  shaderAgua.setUniform('uFase', TWO_PI * p);
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
  shaderAgua.setUniform('uIslas', S.islas);
  shaderAgua.setUniform('uReflejo', Math.pow(2000, 1 - S.reflejo) * Math.pow(20, S.reflejo));
  shaderAgua.setUniform('uOrilla', S.orilla);
  shaderAgua.setUniform('uSol', m.sol);
  shaderAgua.setUniform('uLuna', m.luna);
  shaderAgua.setUniform('uSolVis', m.solVis);
  shaderAgua.setUniform('uLunaVis', m.lunaVis);
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
  };
  for (const c of COLORES_MOMENTO) {
    const ca = hexARgb(a[c]), cb = hexARgb(b[c]);
    m[c] = ca.map((v, n) => lerp(v, cb[n], t));
  }

  // El sol sale por la izquierda en 0.25, pasa alto (fuera de cuadro) y se
  // pone por la derecha en 0.75. La luna hace lo mismo de noche, más baja.
  const ang = TWO_PI * (p - 0.25);
  m.sol = direccion(-Math.cos(ang) * 0.75, Math.sin(ang) * 0.9);
  m.luna = direccion(Math.cos(ang) * 0.75, -Math.sin(ang) * 0.28);
  m.solVis = suave(-0.03, 0.04, m.sol[1]);
  m.lunaVis = suave(-0.03, 0.04, m.luna[1]) * (1 - m.solVis);
  return m;
}

const COLORES_MOMENTO = ['cielo', 'horizonte', 'islas', 'agua', 'luz'];

function direccion(x, y) {
  const l = Math.hypot(x, y, 1);
  return [x / l, y / l, 1 / l];
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
  const A = CONFIG.agua, E = CONFIG.elementos, S = CONFIG.escena;

  const fT = panel.addFolder('Tiempo');
  fT.add(CONFIG, 'duracion', 5, 600, 1).name('duración loop (s)');
  fT.add(estado, 'pausa').name('pausa').listen();
  fT.add(estado, 'progreso', 0, 1, 0.001).name('momento del loop').listen()
    .onChange(() => (estado.pausa = true));
  fT.add(estado, 'momento').name('ahora').listen().disable();

  const fS = panel.addFolder('Escena');
  fS.add(S, 'horizonte', 0.3, 1.5, 0.01).name('altura horizonte');
  fS.add(S, 'islas', 0, 3, 0.01).name('altura islas');
  fS.add(S, 'reflejo', 0, 1, 0.01).name('ancho del reflejo');
  fS.add(S, 'orilla', 0, 1, 0.01).name('fondo en la orilla');

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

  const fG = panel.addFolder('Gente (sensor)');
  fG.add(CONFIG, 'gente', 0, 1, 0.01).name('cantidad de gente');

  const fE = panel.addFolder('Elementos');
  fE.add(E, 'mostrar');
  fE.add(E, 'cantidad', 0, 30, 1).onChange(generarElementos);
  fE.add(E, 'tamano', 0.3, 3, 0.01).name('tamaño');
  fE.add(E, 'velocidad', 0.5, 4, 0.5).name('cruces cada 30 s');
  fE.add(E, 'desenfoque', 0, 20, 0.5);
  fE.add(E, 'opacidad', 0, 1, 0.01);
  fE.addColor(E, 'color').name('color');
  fE.add(E, 'semilla', 1, 999, 1).onChange(generarElementos);

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
  resizeCanvas(windowWidth, windowHeight);
  agua.resizeCanvas(width, height);
  sombras.resizeCanvas(width, height);
}

// Para el sensor: cualquier cosa que llame a setGente(0..1) agita el agua.
// Más adelante una Raspberry puede mandar el valor por WebSocket y llamar esto.
window.setGente = (v) => (CONFIG.gente = constrain(v, 0, 1));
