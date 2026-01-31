// Кастомный edge для связи супругов с детьми
import React from 'react';
import { BaseEdge, type EdgeProps } from 'reactflow';

// Прямой edge для связи супругов (строго горизонтальная линия)
export const SpouseEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
}) => {
  // Горизонтальная линия на уровне нижнего из двух handles (середина Y)
  const lineY = (sourceY + targetY) / 2;
  
  // Путь: горизонтальная линия
  const path = `M ${sourceX} ${lineY} L ${targetX} ${lineY}`;

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
    />
  );
};

// Edge от родителя к ребенку (ступенчатая линия)
export const ParentChildEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
}) => {
  // Вычисляем Y для горизонтального участка (посередине между source и target)
  const midY = sourceY + (targetY - sourceY) / 2;
  
  // Путь: вниз от источника -> горизонтально к ребёнку -> вниз к ребёнку
  const path = `M ${sourceX} ${sourceY} 
                L ${sourceX} ${midY} 
                L ${targetX} ${midY} 
                L ${targetX} ${targetY}`;
  
  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
    />
  );
};
