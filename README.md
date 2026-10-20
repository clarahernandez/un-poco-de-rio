# un poco de río

El río Paraná visto desde la playa, para proyectar, hecho con p5.js.
El loop recorre un día (noche → amanecer → mediodía → atardecer → noche) sin corte: el sol y la luna cruzan el cielo sobre las islas, dejan su reflejo en el agua, y en la orilla se ven las cáusticas del fondo.

## Cómo verlo

Abrí `index.html` con Chrome. Necesita internet, porque p5.js y el panel se cargan de la web.

| Tecla   | Qué hace                       |
|---------|--------------------------------|
| G       | muestra u oculta el panel      |
| F       | pantalla completa              |
| espacio | pausa                          |

Para arrancar en un momento fijo podés agregar parámetros a la URL, por ejemplo
`index.html?t=0.75&pausa&panel=0` (atardecer, en pausa, sin panel).

## Archivos

- `config.js`: todos los ajustes: duración, negro total (cuando se pone la luna), escena (horizonte, islas, reflejo, orilla), agua, colores de cada momento del día y elementos.
  Para la obra final, cambiá `duracion: 30` por `duracion: 360`.
- `shaders.js`: el dibujo del cielo, las islas, el agua y la luz.
- `elementos.js`: camalotes, hojas y ramas que flotan de derecha a izquierda, en perspectiva.
- `sketch.js`: arma todo, el panel y las teclas.

Si te gustan los ajustes que encontraste en el panel, apretá **Copiar ajustes**
y pegá el resultado reemplazando el contenido de `config.js`.

## Versión domo (planetario)

`index.html?domo` dibuja solo las cáusticas del fondo del río en formato
fulldome: un fisheye de 2048 × 2048 px (el centro es el cenit, el borde el
horizonte, afuera negro). Las líneas de luz van siempre a brillo máximo y el
agua quieta queda oscura, porque el proyector del domo tiene poca potencia.
Los ajustes están en `domo` dentro de `config.js` y en la carpeta "Domo" del panel.

En pantalla se ve achicado, pero se dibuja a 2048. Para mandarlo al domo,
en OBS agregá una fuente "Navegador" con el archivo local, ancho y alto 2048,
y la URL `index.html?domo&panel=0`.
