# Vencimiento — Asistente de Cuentas por Pagar

App web para registrar y recordar pagos del hogar y la empresa: servicios públicos, telefonía, tarjetas de crédito, créditos bancarios y más.

## Funcionalidades

- Registro manual, por foto o chat con bot
- Pagos recurrentes y puntuales con fechas y período sin mora
- Recordatorios configurables (WhatsApp, correo, chat en app)
- Dashboard, listado de cuentas y calendario
- Interfaz responsive para web y móvil

## Ejecución local

Abre `index.html` en el navegador o usa cualquier servidor estático.

## Docker

### Con Docker Compose (recomendado)

```bash
docker compose up -d --build
```

La app queda disponible en [http://localhost:8080](http://localhost:8080).

### Solo Docker

```bash
docker build -t asistente-facturas .
docker run -d -p 8080:80 --name asistente-facturas asistente-facturas
```

### Detener

```bash
docker compose down
```

## Estructura

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Estructura de la interfaz |
| `styles.css` | Estilos y diseño responsive |
| `app.js` | Lógica de la interfaz (datos en memoria) |
| `Dockerfile` | Imagen nginx para servir la app |
| `docker-compose.yml` | Orquestación del contenedor |

## Próximos pasos

- Backend y persistencia de datos
- PWA / Capacitor para Android
- Notificaciones reales (WhatsApp, correo, push)
- OCR para facturas y bot con IA
