import { useLayoutEffect, useRef, useState } from 'react';

// Ancho real del contenedor para dibujar los SVG en píxeles reales: así el texto no se encoge en móvil.
export function useAnchoContenedor(respaldo = 640) {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(respaldo);
  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return undefined;
    // Primera medida antes de pintar; después, los cambios de tamaño.
    if (elemento.clientWidth > 0) setAncho(elemento.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(([entrada]) => {
      const medido = Math.round(entrada.contentRect.width);
      if (medido > 0) setAncho(medido);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return [ref, ancho];
}
