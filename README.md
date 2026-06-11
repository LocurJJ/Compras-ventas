# Compras y precios

App local separada para cargar pedidos de compra, aplicar compras al stock, actualizar precios y generar un mensaje de WhatsApp.

## Ejecutar

Opcion simple: doble click en `iniciar-compras-precios.bat`. Se abre el navegador en:

```text
http://127.0.0.1:8765
```

Importante: deje abierta la ventana negra del servidor mientras usa el programa.

O desde PowerShell:

```powershell
python server.py
```

Abrir:

```text
http://127.0.0.1:8765
```

## GitHub Pages

La pagina publicada en GitHub Pages sirve para probar la pantalla, cargar pedidos, cargar compras manualmente, sumar stock y generar el texto de WhatsApp.

GitHub Pages no puede ejecutar `server.py`, entonces no puede analizar fotos con IA. Para eso hace falta usar el servidor local o desplegar un backend en la nube.

## IA con foto

Para analizar imagenes con IA, configurar la clave antes de iniciar:

```powershell
$env:OPENAI_API_KEY="tu_clave"
python server.py
```

Si no hay clave, la app igual permite cargar los renglones a mano y aplica la misma logica:

- suma stock;
- actualiza precios;
- borra del pedido pendiente lo que aparecio en la compra;
- deja pendiente lo que todavia falta comprar;
- arma el texto para copiar y pegar en WhatsApp.

Si en la pantalla aparece `Falta configurar IA`, la foto se subio correctamente pero el servidor se inicio sin `OPENAI_API_KEY`.

Si aparece `Servidor no conectado`, el navegador esta abierto pero `server.py` no esta corriendo.