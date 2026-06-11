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

## Catalogo de ventas

La app puede importar un catalogo JSON de productos de ventas para comparar cada renglon de compra contra el nombre oficial de la otra app.

Por ahora es solo lectura: muestra producto de boleta, producto de la app, stock previo, cantidad comprada, stock final, precio de compra, descuento e IVA 21%. No modifica la app de ventas todavia.

## GitHub Pages

La pagina publicada en GitHub Pages sirve para probar la pantalla, cargar pedidos, cargar compras manualmente, sumar stock y generar el texto de WhatsApp.

GitHub Pages no puede ejecutar `server.py`, entonces no puede analizar fotos con IA. Para eso hace falta usar el servidor local o desplegar un backend en la nube.

## Render

Para usarlo como app web con IA:

1. Crear una cuenta o entrar a Render.
2. Crear un Web Service conectado a `LocurJJ/Compras-ventas`.
3. Usar `python server.py` como comando de inicio, o importar `render.yaml`.
4. Agregar la variable secreta `OPENAI_API_KEY`.
5. Abrir la URL `onrender.com` que genere Render.

Opcional: si OpenAI cambia el acceso a modelos, en Render se puede agregar `OPENAI_MODEL` con el modelo a usar. Por defecto usa `gpt-5.4-mini`.

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

Tambien se puede usar `Demo factura` para probar el circuito completo sin gastar credito de OpenAI.

Si en la pantalla aparece `Falta configurar IA`, la foto se subio correctamente pero el servidor se inicio sin `OPENAI_API_KEY`.

Si aparece `Servidor no conectado`, el navegador esta abierto pero `server.py` no esta corriendo.