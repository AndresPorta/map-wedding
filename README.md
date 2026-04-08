# Landing page de invitación de boda

Proyecto web estático, elegante y responsive para una invitación de boda, inspirado en una landing de evento romántica. Está construido únicamente con **HTML5, CSS3 y JavaScript nativo**, por lo que puede abrirse directamente con `index.html` o desplegarse fácilmente en **GitHub Pages**.

## Características

- Hero principal con monograma, nombres, fecha y fotografía destacada
- Contador regresivo hacia la boda
- Animaciones suaves al hacer scroll usando `IntersectionObserver`
- Navegación fija minimalista
- Timeline vertical responsive para el itinerario
- Tarjetas de ubicaciones con enlaces a Google Maps
- Sección de mesa de regalos y CTA de confirmación por WhatsApp
- Diseño mobile-first y compatible con navegadores modernos

## Estructura de archivos

```bash
/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── main.js
├── assets/
│   └── images/
│       └── README.txt
└── README.md
```

## Cómo personalizar

### 1. Nombres de la pareja
Editar en `index.html`:

- `Michelle & Andres`
- Monograma `MAP`

### 2. Fecha del evento
Editar en `index.html` y `js/main.js`:

- Texto visible: `21 / Noviembre / 2026`
- Timeline: `20/06/2026 ...`
- Countdown en `js/main.js`:

```js
const weddingDate = new Date('2026-11-21T17:00:00');
```

### 3. Mensajes y textos
Modificar en `index.html`:

- Mensaje de bienvenida
- Indicaciones del evento
- Itinerario
- Información de regalos
- CTA final

### 4. Enlaces importantes
Modificar en `index.html`:

- WhatsApp RSVP:
  `https://wa.me/5218139935005?text=Hola,%20confirmo%20mi%20asistencia%20a%20la%20boda`
- Google Maps ceremonia:
  `https://maps.app.goo.gl/ggNidnDUjqtDVZHe7`
- Google Maps recepción:
  `https://maps.app.goo.gl/WsQ4CniAY6Jyo9se6`
- Liverpool:
  `https://mesaderegalos.liverpool.com.mx/milistaderegalos/51740012`

### 5. Colores del sitio
Modificar en `css/styles.css`, dentro de `:root`:

```css
:root {
  --bg: #fdfaf6;
  --bg-strong: #f7f1e8;
  --primary: #c9a96e;
  --primary-dark: #b28f55;
  --text: #1f1f1f;
  --text-soft: #6b6b6b;
  --white: #ffffff;
}
```

### 6. Tipografías
El proyecto usa Google Fonts vía `@import` en `css/styles.css`:

- `Cormorant Garamond` para títulos
- `Lato` para textos

Si quieres cambiarlas, sustituye la línea `@import` y los `font-family` correspondientes.

## Cómo sustituir imágenes

Actualmente el proyecto utiliza imágenes de placeholder con `https://picsum.photos`.

Para usar tus fotos reales:

1. Coloca tus archivos dentro de `assets/images/`, por ejemplo:

```bash
assets/images/hero.jpg
assets/images/bienvenida.jpg
assets/images/ceremonia.jpg
assets/images/recepcion.jpg
assets/images/cta.jpg
```

2. Reemplaza las rutas en `index.html` y `css/styles.css`.

### Ejemplos

En `index.html` cambia:

```html
<img src="https://picsum.photos/seed/Michelle-Andres-hero/900/1200" alt="..." />
```

por:

```html
<img src="assets/images/hero.jpg" alt="Foto principal de la pareja" />
```

Para el CTA, en `css/styles.css` cambia:

```css
background:
  linear-gradient(135deg, rgba(31, 31, 31, 0.22), rgba(31, 31, 31, 0.42)),
  url('https://picsum.photos/seed/Michelle-Andres-rsvp/1600/1000') center/cover;
```

por:

```css
background:
  linear-gradient(135deg, rgba(31, 31, 31, 0.22), rgba(31, 31, 31, 0.42)),
  url('../assets/images/cta.jpg') center/cover;
```

## Cómo desplegar en GitHub Pages

### Opción recomendada: desde la rama principal

1. Crea un repositorio nuevo en GitHub.
2. Sube todos los archivos del proyecto respetando la estructura.
3. Haz commit y push a la rama `main`.
4. En GitHub, entra a **Settings**.
5. Ve a **Pages**.
6. En **Build and deployment**, selecciona:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main`
   - **Folder:** `/ (root)`
7. Guarda los cambios.
8. GitHub generará una URL pública para tu invitación.

### Opción rápida con GitHub Desktop o terminal

```bash
git init
git add .
git commit -m "Initial wedding landing page"
git branch -M main
git remote add origin TU_REPOSITORIO
git push -u origin main
```

Después activa GitHub Pages desde la configuración del repositorio.

## Cómo ejecutar localmente

No necesitas servidor ni dependencias.

Solo abre `index.html` en tu navegador.

También puedes usar una extensión como **Live Server** en VS Code si quieres ver cambios en tiempo real mientras editas.

## Notas técnicas

- No usa frameworks ni librerías externas de JavaScript.
- Funciona con Chrome, Firefox y Safari modernos.
- El `IntersectionObserver` se usa para revelar secciones al entrar al viewport.
- El menú superior cambia de transparente a sólido al hacer scroll.
- El diseño está planteado con enfoque **mobile-first**.

## Créditos

- Inspiración visual basada en una landing de invitación de boda de referencia.
- Fotografías de demostración vía `picsum.photos`.
- Tipografías servidas desde Google Fonts.

## Licencia

Puedes usar este proyecto como base para proyectos personales o comerciales, adaptando contenido, imágenes y branding según tus necesidades.
