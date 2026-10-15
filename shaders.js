// Shader del río visto desde la playa.
//
// La escena tiene tres partes:
//  - Cielo: degradé según el momento del día, con el sol, la luna y la línea
//    de las islas de enfrente sobre el horizonte.
//  - Agua: una superficie de ondas vista en perspectiva. Cada punto refleja
//    el cielo (más cuanto más lejos, como el agua de verdad) y el sol o la
//    luna dejan un camino de destellos sobre las olas.
//  - Orilla: abajo, donde el agua es baja, se ve el fondo con las cáusticas,
//    las figuras de luz que hacen las olas al funcionar como lentes.
//
// Estilo: para que no se vea como 3D pulido, las ondas se deforman (orgánico),
// la perspectiva se puede achatar, los tonos se agrupan en pocas capas con
// borde (como un grabado) y hay un grano fijo de papel.
//
// Las ondas suben y bajan en su lugar (ondas estacionarias). Con "corriente"
// mayor a 0 además avanzan hacia la orilla.
//
// Para que el loop sea perfecto, cada onda da un número ENTERO de vueltas
// por loop (uCic), así el final queda idéntico al principio.

const NUM_ONDAS = 16;

const VERT = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
`;

const FRAG = `
precision highp float;
#define NW ${NUM_ONDAS}

const float F = 1.2;          // distancia focal de la "cámara"
const float ALTO = 1.0;       // altura de los ojos sobre el agua

varying vec2 vUv;
uniform vec2 uRes;
uniform float uFase;          // 2π × progreso del loop

uniform float uDx[NW];        // dirección de cada onda
uniform float uDy[NW];
uniform float uK[NW];         // frecuencia espacial
uniform float uAmp[NW];       // curvatura
uniform float uCic[NW];       // vueltas por loop (enteros)
uniform float uDes[NW];       // desfase inicial
uniform float uCorriente;     // 0 = suben y bajan en su lugar, 1 = avanzan hacia la orilla

uniform float uD;             // agitación
uniform float uNitidez;
uniform float uDispersion;
uniform float uTurbidez;
uniform float uExpo;
uniform float uVineta;

uniform float uHorizonte;     // altura del horizonte en pantalla (0 abajo, 1 arriba)
uniform float uIslas;         // altura de las islas
uniform float uReflejo;       // exponente del brillo: más alto = camino de luz más angosto
uniform float uOrilla;        // cuánto fondo se ve en la orilla

uniform float uPerspectiva;   // 0 = olas del mismo tamaño en todo el cuadro, 1 = perspectiva real
uniform float uOrganico;      // cuánto se deforman las ondas
uniform float uCapas;         // cantidad de tonos (0 = degradé continuo)
uniform float uBorde;         // suavidad del borde entre tonos
uniform float uGrano;         // textura de papel

uniform vec3 uAgua;
uniform vec3 uLuz;
uniform float uInt;
uniform vec3 uColCielo;
uniform vec3 uColHorizonte;
uniform vec3 uColIslas;
uniform vec3 uSol;            // dirección del sol
uniform vec3 uLuna;
uniform float uSolVis;
uniform float uLunaVis;

// Islas bajas y chatas, con el borde irregular de los árboles
float perfilIslas(float x) {
  float monte = 0.004 * sin(x * 3.0 + 1.3) + 0.003 * sin(x * 7.0 + 0.4);
  // Copas de árboles: lomitas redondeadas de distinto tamaño
  float copas = 0.005 * abs(sin(x * 19.0 + 2.1)) * (0.6 + 0.4 * sin(x * 4.3))
              + 0.003 * abs(sin(x * 47.0 + 1.0))
              + 0.0015 * abs(sin(x * 113.0));
  return uIslas * (0.016 + monte + copas);
}

// Lo que se ve mirando en la dirección dir (cielo, sol, luna, islas).
// pesoIslas < 1 aclara las islas (para sus reflejos en las olas cercanas).
vec3 cielo(vec3 dir, float pesoIslas) {
  dir = normalize(dir);
  vec2 s = dir.xy / max(dir.z, 0.001) * F;    // posición en pantalla
  vec3 col = mix(uColHorizonte, uColCielo, smoothstep(0.0, 0.3, dir.y));

  float ds = dot(dir, uSol);
  col += uLuz * uInt * (pow(max(ds, 0.0), 12.0) * 0.35 + smoothstep(0.99975, 0.9999, ds) * 2.5) * uSolVis;
  float dm = dot(dir, uLuna);
  col += vec3(0.9, 0.93, 1.0) * (pow(max(dm, 0.0), 60.0) * 0.12 + smoothstep(0.99965, 0.9998, dm) * 1.2) * uLunaVis;

  col = mix(col, uColIslas, smoothstep(0.004, -0.002, s.y - perfilIslas(s.x)) * pesoIslas);
  return col;
}

// Pendiente (g) y curvatura (Hs) de la superficie en el punto P del agua.
// fp = tamaño de un pixel en el agua: las ondas más chicas que eso se apagan
// para que a lo lejos no titile.
void olas(vec2 P, float fp, out vec2 g, out vec3 Hs) {
  g = vec2(0.0);
  Hs = vec3(0.0);
  for (int i = 0; i < NW; i++) {
    vec2 d = vec2(uDx[i], uDy[i]);
    float k = uK[i];
    float filtro = clamp(1.0 - k * fp * 1.5, 0.0, 1.0);
    float x = k * dot(d, P) + uDes[i];
    float t = uCic[i] * uFase + uDes[i] * 1.7;
    float s = mix(sin(x) * cos(t) * 1.41, sin(x + t), uCorriente);
    float c = mix(cos(x) * cos(t) * 1.41, cos(x + t), uCorriente);
    float a = uAmp[i] * filtro;
    g += a / k * c * d;
    Hs -= a * s * vec3(d.x * d.x, d.y * d.y, d.x * d.y);
  }
}

float luzEn(vec3 H, float D) {
  float det = (1.0 + D * H.x) * (1.0 + D * H.y) - D * D * H.z * H.z;
  return 1.0 / (abs(det) + 0.06);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float aspecto = uRes.x / uRes.y;
  vec3 rayo = vec3((uv.x - 0.5) * aspecto, uv.y - uHorizonte, F);
  vec3 col;

  if (rayo.y >= 0.0) {
    col = cielo(rayo, 1.0);
  } else {
    // Punto del agua que se ve en este pixel
    float dy = -rayo.y;
    float zReal = ALTO * F / dy;
    vec2 Preal = vec2(rayo.x * zReal / F, zReal);
    // Versión plana: las olas no se achican hacia arriba, solo se estiran a lo ancho
    float zCerca = ALTO * F / uHorizonte;
    vec2 Pplano = vec2(rayo.x * 1.8, zCerca + uv.y * 3.0);
    vec2 P = mix(Pplano, Preal, uPerspectiva);
    float z = P.y;
    float fp = mix(3.0 / uRes.y, zReal * zReal / (ALTO * F) / uRes.y, uPerspectiva);

    // Deformación orgánica (vueltas enteras por loop, así sigue cerrando)
    vec2 w = vec2(sin(P.y * 1.7 + sin(P.x * 0.8 + uFase)),
                  sin(P.x * 1.3 - cos(P.y * 1.1 - 2.0 * uFase)));
    P += uOrganico * 0.35 * w;

    vec2 g; vec3 Hs;
    olas(P, fp, g, Hs);
    g *= 0.4 * uD;

    vec3 V = normalize(rayo);
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 R = reflect(V, N);
    R.y = abs(R.y);
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(-V, N), 0.0), 5.0);

    // Camino de luz del sol / la luna
    float brillo = pow(max(dot(R, uSol), 0.0), uReflejo) * uSolVis
                 + pow(max(dot(R, uLuna), 0.0), uReflejo * 1.5) * uLunaVis * 0.6;
    // Con capas, el brillo es una mancha plana de luz en vez de un lustre
    if (uCapas > 0.5) brillo = smoothstep(0.3, 0.32 + uBorde * 0.6, brillo) * 0.6;

    // Fondo de la orilla con cáusticas, se pierde en el agua barrosa
    float claridad = uOrilla * exp(-(z - zCerca) * (0.6 + 2.5 * uTurbidez));
    vec3 l = vec3(
      luzEn(Hs, uD * (1.0 - uDispersion)),
      luzEn(Hs, uD),
      luzEn(Hs, uD * (1.0 + uDispersion))
    );
    l = pow(mix(l, vec3(1.0), uTurbidez), vec3(uNitidez));
    vec3 fondo = uAgua * 1.3 + uLuz * uInt * 0.3 * l;
    vec3 adentro = mix(uAgua, fondo, claridad);

    float pesoIslas = mix(0.35, 1.0, smoothstep(4.0, 14.0, z));
    col = mix(adentro, cielo(R, pesoIslas), fresnel) + uLuz * uInt * brillo * 3.0;
  }

  col = 1.0 - exp(-col * uExpo * 1.6);

  // Pocas capas de tono con borde, como un grabado o papel recortado
  if (uCapas > 0.5) {
    float lum = max(dot(col, vec3(0.299, 0.587, 0.114)), 0.001);
    float f = lum * uCapas;
    float q = (floor(f) + smoothstep(0.5 - uBorde, 0.5 + uBorde, fract(f)) + 0.3) / (uCapas + 0.3);
    col *= q / lum;
  }

  // Grano de papel: fijo, no cambia con el tiempo
  float papel = hash(floor(gl_FragCoord.xy)) * 0.6 + hash(floor(gl_FragCoord.xy / 3.0) + 17.0) * 0.4;
  col *= 1.0 + (papel - 0.5) * uGrano * 0.18;

  float v = smoothstep(1.15, 0.35, length((vUv - 0.5) * vec2(aspecto, 1.0)) * 1.1);
  col *= mix(1.0, v, uVineta);

  // Un poquito de grano para que no se vean escalones en el proyector
  col += (hash(gl_FragCoord.xy + fract(uFase * 7.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;
