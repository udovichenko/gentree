// Кастомный edge для связи супругов с детьми
import React from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from 'reactflow';

interface FamilyEdgeData {
  type: 'spouse' | 'parent-child';
  spouseMidX?: number;
  spouseMidY?: number;
}

// Прямой edge для связи супругов (горизонтальная линия)
export const SpouseEdge: React.FC<EdgeProps<FamilyEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
}) => {
  // Прямая горизонтальная линия между супругами
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={style}
    />
  );
};

// Edge от центра линии супругов к ребенку
export const ParentChildEdge: React.FC<EdgeProps<FamilyEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data,
}) => {
  // Если есть данные о середине супругов, используем её
  const startX = data?.spouseMidX ?? sourceX;
  const startY = data?.spouseMidY ?? sourceY;
  
  // Создаём путь: вертикально вниз, потом горизонтально к центру ребёнка, потом вниз
  const midY = startY + (targetY - startY) / 2;
  
  const path = `M ${startX} ${startY} 
                L ${startX} ${midY} 
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
