// Утилиты экспорта дерева
import { toPng } from 'html-to-image';

/**
 * Экспорт дерева в PNG
 */
export async function exportTreeToPng(
  element: HTMLElement,
  options: { width?: number; height?: number; scale?: number } = {}
): Promise<string> {
  const { scale = 2 } = options;
  
  const dataUrl = await toPng(element, {
    backgroundColor: '#ffffff',
    pixelRatio: scale,
    filter: (node) => {
      // Исключаем контролы и миникарту при экспорте
      const classList = node.classList;
      if (!classList) return true;
      return !classList.contains('react-flow__controls') && 
             !classList.contains('react-flow__minimap');
    },
  });
  
  return dataUrl;
}
