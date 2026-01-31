// Основной компонент визуализации дерева
import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  type NodeChange,
  type Node,
  BackgroundVariant,
  type ReactFlowInstance,
  SelectionMode,
  useViewport,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { FamilyTree, Person } from '../../types';
import { buildFlowGraph } from '../../utils/treeUtils';
import PersonCard from '../PersonCard/PersonCard';
import FamilyLines from '../FamilyLines/FamilyLines';
import styles from './FamilyTreeView.module.scss';

// Регистрируем кастомные типы узлов
const nodeTypes = {
  personCard: PersonCard,
};

interface FamilyTreeViewInnerProps {
  tree: FamilyTree;
  onPersonSelect?: (person: Person | null) => void;
  onPersonsMove?: (moves: Array<{ personId: string; offsetX: number }>) => void;
}

// Компонент SVG-слоя с линиями
const LinesLayer: React.FC<{ nodes: Node[]; tree: FamilyTree }> = ({ nodes, tree }) => {
  const viewport = useViewport();
  
  return (
    <svg
      className={styles.linesLayer}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 0,
      }}
    >
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        <FamilyLines nodes={nodes} tree={tree} />
      </g>
    </svg>
  );
};

// Внутренний компонент с доступом к viewport
const FamilyTreeViewInner: React.FC<FamilyTreeViewInnerProps> = ({
  tree,
  onPersonSelect,
  onPersonsMove,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  
  // Храним Y-позиции поколений для ограничения вертикального перемещения
  const generationYPositionsRef = useRef<Map<number, number>>(new Map());
  
  // Начальные позиции при начале перетаскивания
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  
  // Флаг для отслеживания, была ли зажата клавиша модификатора при клике
  const isMultiSelectRef = useRef(false);
  
  // Флаг для скрытия selection box после завершения выделения
  const [isSelecting, setIsSelecting] = useState(false);
  
  // Строим граф из данных дерева (без edges - мы рисуем линии сами)
  const { initialNodes, generationYPositions } = useMemo(() => {
    const result = buildFlowGraph(tree);
    return { 
      initialNodes: result.nodes.filter(n => n.type === 'personCard'), // Только карточки персон
      generationYPositions: result.generationYPositions,
    };
  }, [tree]);
  
  // Обновляем ref с позициями поколений в эффекте
  useEffect(() => {
    generationYPositionsRef.current = generationYPositions;
  }, [generationYPositions]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  
  // Обновляем узлы при изменении дерева
  useEffect(() => {
    const result = buildFlowGraph(tree);
    generationYPositionsRef.current = result.generationYPositions;
    setNodes(result.nodes.filter(n => n.type === 'personCard'));
  }, [tree, setNodes]);
  
  // Обработка изменения узлов (перемещение) - ограничиваем только горизонтальное
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const modifiedChanges: NodeChange[] = [];
    
    for (const change of changes) {
      if (change.type === 'position') {
        // Начало перетаскивания - сохраняем начальные позиции всех выделенных узлов
        if (change.dragging === true) {
          // Сохраняем позиции всех выделенных узлов
          const selectedNodes = nodes.filter(n => n.selected || n.id === change.id);
          for (const node of selectedNodes) {
            if (!dragStartPositions.current.has(node.id)) {
              dragStartPositions.current.set(node.id, { ...node.position });
            }
          }
        }
        
        // Во время перетаскивания - блокируем изменение Y
        if (change.position) {
          const node = nodes.find(n => n.id === change.id);
          if (node && node.data.generation !== undefined) {
            const generation = node.data.generation;
            const fixedY = generationYPositionsRef.current.get(generation) ?? node.position.y;
            
            modifiedChanges.push({
              ...change,
              position: {
                x: change.position.x,
                y: fixedY,
              },
            });
            continue;
          }
        }
        
        // Конец перетаскивания - сохраняем смещения В ИСТОРИЮ
        if (change.dragging === false) {
          // Собираем все перемещённые узлы
          const movedNodes: Array<{ personId: string; offsetX: number }> = [];
          
          for (const [nodeId, startPos] of dragStartPositions.current) {
            const node = nodes.find(n => n.id === nodeId);
            if (node && node.data.person) {
              // Текущая позиция узла (после перетаскивания)
              const currentX = node.position.x;
              const deltaX = currentX - startPos.x;
              
              // Если было реальное смещение
              if (Math.abs(deltaX) > 1) {
                const currentOffset = node.data.person.displaySettings?.customPosition?.offsetX || 0;
                movedNodes.push({
                  personId: nodeId,
                  offsetX: currentOffset + deltaX,
                });
              }
            }
          }
          
          // Очищаем сохранённые позиции
          dragStartPositions.current.clear();
          
          // Вызываем callback для сохранения в историю
          if (movedNodes.length > 0) {
            onPersonsMove?.(movedNodes);
          }
        }
      }
      
      modifiedChanges.push(change);
    }
    
    onNodesChange(modifiedChanges);
  }, [nodes, onNodesChange, onPersonsMove]);
  
  // Обработка клика по узлу - открываем панель только если не multi-select
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Если зажат Shift, Ctrl или Cmd - это multi-select, не открываем панель
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      isMultiSelectRef.current = true;
      return;
    }
    
    isMultiSelectRef.current = false;
    const person = tree.persons.get(node.id);
    onPersonSelect?.(person || null);
  }, [tree, onPersonSelect]);
  
  // Обработка начала выделения рамкой
  const handleSelectionStart = useCallback(() => {
    setIsSelecting(true);
  }, []);
  
  // Обработка окончания выделения рамкой
  const handleSelectionEnd = useCallback(() => {
    setIsSelecting(false);
  }, []);
  
  // Клик по пустому месту - снимаем выделение
  const handlePaneClick = useCallback(() => {
    onPersonSelect?.(null);
  }, [onPersonSelect]);
  
  // Сохранение ссылки на инстанс
  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
    // Центрируем вид
    setTimeout(() => {
      instance.fitView({ padding: 0.2 });
    }, 100);
  }, []);
  
  // Стиль фона
  const containerStyle: React.CSSProperties = useMemo(() => ({
    backgroundColor: tree.settings.backgroundColor || '#f5f5f5',
    backgroundImage: tree.settings.backgroundImage ? `url(${tree.settings.backgroundImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }), [tree.settings.backgroundColor, tree.settings.backgroundImage]);
  
  return (
    <div ref={reactFlowWrapper} className={`${styles.container} ${!isSelecting ? styles.hideSelectionBox : ''}`} style={containerStyle}>
      <ReactFlow
        nodes={nodes}
        edges={[]} // Не используем edges React Flow
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag
        panOnDrag={[1, 2]} // Средняя и правая кнопки для pan
        panOnScroll  // Двухпальцевый скролл на тачпаде = pan
        zoomOnScroll={false} // Отключаем zoom по скроллу, чтобы тачпад работал для pan
        zoomOnPinch  // Но зум по щипку оставляем
        selectNodesOnDrag={false}
        selectionKeyCode={null}  // Убираем требование Shift для выделения рамкой
        multiSelectionKeyCode="Shift" // Shift или Ctrl/Cmd для multi-select
      >
        {/* SVG слой для линий */}
        <LinesLayer nodes={nodes} tree={tree} />
        
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="#ddd"
        />
        <Controls className={styles.controls} />
        <MiniMap 
          className={styles.minimap}
          nodeColor={(node) => {
            const person = node.data?.person as Person | undefined;
            if (!person) return '#ccc';
            return person.sex === 'M' ? '#1890ff' : person.sex === 'F' ? '#eb2f96' : '#8c8c8c';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
};

// Обёртка с ReactFlowProvider
interface FamilyTreeViewProps {
  tree: FamilyTree;
  onPersonSelect?: (person: Person | null) => void;
  onPersonsMove?: (moves: Array<{ personId: string; offsetX: number }>) => void;
}

const FamilyTreeView: React.FC<FamilyTreeViewProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FamilyTreeViewInner {...props} />
    </ReactFlowProvider>
  );
};

export default FamilyTreeView;
