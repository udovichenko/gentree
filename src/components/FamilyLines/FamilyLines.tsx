// Компонент для отрисовки линий связей в генеалогическом дереве
// Рисуется как SVG-элементы внутри родительского <g>
import React, { useMemo } from 'react';
import type { Node } from 'reactflow';
import type { FamilyTree } from '../../types';

// Константы размеров карточек (должны совпадать с treeUtils)
const CARD_WIDTH = 200;
const CARD_HEIGHT = 120;

interface FamilyLinesProps {
  nodes: Node[];
  tree: FamilyTree;
}

interface LineData {
  id: string;
  path: string;
  stroke: string;
  strokeWidth: number;
}

const FamilyLines: React.FC<FamilyLinesProps> = ({ nodes, tree }) => {
  const lines = useMemo(() => {
    const result: LineData[] = [];
    const lineColor = tree.settings.lineColor || '#8c8c8c';
    const lineWidth = tree.settings.lineWidth || 2;
    
    // Создаём карту позиций узлов
    const nodePositions = new Map<string, { x: number; y: number; centerX: number; centerY: number; bottomY: number; topY: number }>();
    for (const node of nodes) {
      // Пропускаем familyNode - они нам не нужны
      if (node.type === 'familyNode') continue;
      
      nodePositions.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        centerX: node.position.x + CARD_WIDTH / 2,
        centerY: node.position.y + CARD_HEIGHT / 2,
        bottomY: node.position.y + CARD_HEIGHT,
        topY: node.position.y,
      });
    }
    
    // Для каждой семьи рисуем линии
    for (const [familyId, family] of tree.families) {
      const husbandId = family.husbandId;
      const wifeId = family.wifeId;
      
      const husbandPos = husbandId ? nodePositions.get(husbandId) : null;
      const wifePos = wifeId ? nodePositions.get(wifeId) : null;
      
      // Проверяем видимость
      const husbandVisible = husbandPos !== null && husbandPos !== undefined;
      const wifeVisible = wifePos !== null && wifePos !== undefined;
      
      if (!husbandVisible && !wifeVisible) continue;
      
      // Собираем видимых детей
      const visibleChildren = family.childrenIds
        .map(id => ({ id, pos: nodePositions.get(id) }))
        .filter(c => c.pos !== undefined) as Array<{ id: string; pos: NonNullable<typeof husbandPos> }>;
      
      // Определяем позиции супругов (кто слева, кто справа)
      let leftSpouse: typeof husbandPos = null;
      let rightSpouse: typeof husbandPos = null;
      
      if (husbandVisible && wifeVisible) {
        if (husbandPos!.x < wifePos!.x) {
          leftSpouse = husbandPos;
          rightSpouse = wifePos;
        } else {
          leftSpouse = wifePos;
          rightSpouse = husbandPos;
        }
      } else if (husbandVisible) {
        leftSpouse = husbandPos;
      } else {
        leftSpouse = wifePos;
      }
      
      // Y-координата горизонтальной линии между супругами (середина карточки)
      const spouseLineY = leftSpouse!.centerY;
      
      // 1. Линия между супругами (если оба видны)
      if (husbandVisible && wifeVisible && leftSpouse && rightSpouse) {
        const spousePath = `M ${leftSpouse.x + CARD_WIDTH} ${spouseLineY} L ${rightSpouse.x} ${spouseLineY}`;
        result.push({
          id: `spouse-${familyId}`,
          path: spousePath,
          stroke: lineColor,
          strokeWidth: lineWidth,
        });
      }
      
      // 2. Линии к детям (гребёнка)
      if (visibleChildren.length > 0) {
        // Точка, откуда идут линии к детям
        let dropPointX: number;
        
        if (husbandVisible && wifeVisible && leftSpouse && rightSpouse) {
          // Середина между супругами
          dropPointX = (leftSpouse.x + CARD_WIDTH + rightSpouse.x) / 2;
        } else {
          // Центр единственного родителя
          dropPointX = leftSpouse!.centerX;
        }
        
        // Y-координата горизонтальной "гребёнки" над детьми
        // Находим минимальный Y детей и размещаем гребёнку посередине
        const childrenTopY = Math.min(...visibleChildren.map(c => c.pos.topY));
        const combY = (spouseLineY + childrenTopY) / 2;
        
        // Вертикальная линия от середины супругов вниз до гребёнки
        const verticalPath = `M ${dropPointX} ${spouseLineY} L ${dropPointX} ${combY}`;
        result.push({
          id: `vertical-${familyId}`,
          path: verticalPath,
          stroke: lineColor,
          strokeWidth: lineWidth,
        });
        
        // Горизонтальная гребёнка
        const childrenXs = visibleChildren.map(c => c.pos.centerX);
        const minChildX = Math.min(...childrenXs, dropPointX);
        const maxChildX = Math.max(...childrenXs, dropPointX);
        
        const combPath = `M ${minChildX} ${combY} L ${maxChildX} ${combY}`;
        result.push({
          id: `comb-${familyId}`,
          path: combPath,
          stroke: lineColor,
          strokeWidth: lineWidth,
        });
        
        // Вертикальные линии от гребёнки к каждому ребёнку
        for (const child of visibleChildren) {
          const childPath = `M ${child.pos.centerX} ${combY} L ${child.pos.centerX} ${child.pos.topY}`;
          result.push({
            id: `child-${familyId}-${child.id}`,
            path: childPath,
            stroke: lineColor,
            strokeWidth: lineWidth,
          });
        }
      }
    }
    
    return result;
  }, [nodes, tree]);
  
  return (
    <>
      {lines.map(line => (
        <path
          key={line.id}
          d={line.path}
          stroke={line.stroke}
          strokeWidth={line.strokeWidth}
          fill="none"
        />
      ))}
    </>
  );
};

export default FamilyLines;
