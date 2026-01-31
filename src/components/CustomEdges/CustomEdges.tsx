// Кастомный edge для связи супругов с детьми
import React from 'react';
import { BaseEdge, type EdgeProps } from 'reactflow';

interface SpouseEdgeData {
  // Реальные координаты для горизонтальной линии между супругами
  lineY: number;      // Y координата горизонтальной линии
  sourceX: number;    // X правого края карточки мужа
  targetX: number;    // X левого края карточки жены
}

interface ParentChildEdgeData {
  // Точка начала (середина линии супругов)
  spouseMidX: number;
  spouseMidY: number;
  // Точка конца (верх карточки ребёнка)
  childX: number;
  childY: number;
}

// Прямой edge для связи супругов (строго горизонтальная линия)
export const SpouseEdge: React.FC<EdgeProps<SpouseEdgeData>> = ({
  id,
  data,
  style,
}) => {
  if (!data) return null;
  
  const { lineY, sourceX, targetX } = data;
  
  // Строго горизонтальная линия
  const path = `M ${sourceX} ${lineY} L ${targetX} ${lineY}`;

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
    />
  );
};

// Edge от центра линии супругов к ребенку
export const ParentChildEdge: React.FC<EdgeProps<ParentChildEdgeData>> = ({
  id,
  data,
  style,
}) => {
  if (!data) return null;
  
  const { spouseMidX, spouseMidY, childX, childY } = data;
  
  // Вычисляем Y для горизонтального участка (посередине между линией супругов и ребёнком)
  const midY = spouseMidY + (childY - spouseMidY) / 2;
  
  // Путь: вниз от линии супругов -> горизонтально к ребёнку -> вниз к ребёнку
  const path = `M ${spouseMidX} ${spouseMidY} 
                L ${spouseMidX} ${midY} 
                L ${childX} ${midY} 
                L ${childX} ${childY}`;
  
  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
    />
  );
};
