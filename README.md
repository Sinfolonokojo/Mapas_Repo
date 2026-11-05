# Comparador editable de mapas de valor

Aplicación estática, sin dependencias, preparada para publicar en Vercel.

## Funciones

- Mapa de nodos interactivo, filtros temáticos, detalle de evidencia y matriz enlazada.
- Editor de título, etiqueta del círculo, evidencia y valor generado por nodo.
- Guardado local automático en el navegador.
- Exportación e importación JSON para transferir los cambios entre navegadores.
- Secciones 3 y 4 conservadas debajo del mapa.

## Publicar en Vercel

1. Sube el contenido de esta carpeta a un repositorio Git.
2. En Vercel, importa ese repositorio.
3. Deja el framework como **Other** y el directorio raíz como la raíz del proyecto.
4. No hace falta comando de build; publica los archivos estáticos.

## Cómo se comparten las ediciones

El enlace de Vercel se puede compartir y todos verán los datos base. Las ediciones se guardan en el navegador que las hizo. Para pasar ediciones a otra persona, exporta el JSON y esa persona lo importa. La sincronización simultánea entre personas requiere conectar una base de datos o servicio compartido.
