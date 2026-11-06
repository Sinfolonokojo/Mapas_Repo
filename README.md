# Comparador editable de mapas de valor

Aplicación estática, sin dependencias en el navegador, publicada en https://mapasrepo.vercel.app/.

## Funciones

- Mapa de nodos interactivo, filtros temáticos, detalle de evidencia y matriz enlazada.
- Edición de todos los apartados: títulos, párrafos, listas, tabla de evidencia pública y enlaces.
- Edición de entidades, encabezados del mapa y nombres de temas.
- Editor de título, etiqueta del círculo, evidencia, valor generado y temas de cada nodo.
- Correcciones manuales de la matriz y de las lecturas, con opción de recuperar el cálculo automático.
- Guardado local automático en el navegador.
- Exportación e importación JSON para transferir los cambios entre navegadores.
- Importación compatible con los archivos anteriores que solo contienen nodos.

## Editar la página

1. Pulsa **Activar edición** en la barra superior.
2. Usa **Editar…** en el apartado que quieras modificar. Los enlaces tienen campos propios para cambiar su dirección.
3. Pulsa un nodo para editarlo o una fila de la matriz para corregir su estado y evidencia.
4. Cada tarjeta de lecturas tiene su propio botón **Editar lectura**. Una lectura personalizada deja de recalcularse hasta usar **Volver al contenido original**.
5. Guarda los cambios y pulsa **Terminar edición** al acabar.

El botón de restaurar dentro de un editor afecta solo a ese apartado. **Restaurar versión base** restaura toda la página después de pedir confirmación. Una corrección manual de una fila de la matriz prevalece sobre los nodos hasta restaurar esa fila.

## Publicar en Vercel

1. Sube el contenido de esta carpeta a un repositorio Git.
2. En Vercel, importa ese repositorio.
3. Deja el framework como **Other** y el directorio raíz como la raíz del proyecto.
4. No hace falta comando de build; publica los archivos estáticos.

## Cómo se comparten las ediciones

El enlace de Vercel se puede compartir y todos verán los datos base. Las ediciones se guardan en el navegador que las hizo. Para pasar ediciones a otra persona, exporta el JSON y esa persona lo importa. La sincronización simultánea entre personas requiere conectar una base de datos o servicio compartido.

## Desarrollo y pruebas

`npm ci` instala únicamente las dependencias de pruebas; `npm test` verifica edición, persistencia, importación, restauración y coherencia de la matriz. Para ver la página localmente: `python3 -m http.server 8765 --bind 127.0.0.1`.

Vercel sirve `index.html`, `editor.js` y `editor.css` directamente. No necesita compilar ni instalar las dependencias de pruebas.
