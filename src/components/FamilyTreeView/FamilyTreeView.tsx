// Основной компонент визуализации дерева
import React, { useCallback, useMemo, useRef, useEffect } from 'react';
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
        // Начало перетаскивания - сохраняем начальные позиции
        if (change.dragging === true) {
          const node = nodes.find(n => n.id === change.id);
          if (node) {
            dragStartPositions.current.set(change.id, { ...node.position });
          }
        }
        
        // Во время перетаскивания - блокируем изменение Y
        if (change.position) {
          const node = nodes.find(n => n.id === change.id);
          if (node && node.data.generation !== undefined) {
            // Сохраняем только горизонтальное перемещение, Y остается фиксированным
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
        
        // Конец перетаскивания - сохраняем смещения
        if (change.dragging === false) {
          const startPos = dragStartPositions.current.get(change.id);
          if (startPos && change.position) {
            const node = nodes.find(n => n.id === change.id);
            if (node && node.data.person) {
              const offsetX = change.position.x - startPos.x + (node.data.person.displaySettings?.customPosition?.offsetX || 0);
              
              // Если выделено несколько узлов, собираем все смещения
              const selectedNodes = nodes.filter(n => n.selected);
              if (selectedNodes.length > 1) {
                const moves = selectedNodes.map(n => {
                  const start = dragStartPositions.current.get(n.id);
                  const currentOffset = n.data.person?.displaySettings?.customPosition?.offsetX || 0;
                  const newOffset = start ? n.position.x - start.x + currentOffset : currentOffset;
                  return { personId: n.id, offsetX: newOffset };
                });
                onPersonsMove?.(moves);
              } else {
                onPersonsMove?.([{ personId: change.id, offsetX: offsetX }]);
              }
            }
          }
          dragStartPositions.current.delete(change.id);
        }
      }
      
      modifiedChanges.push(change);
    }
    
    onNodesChange(modifiedChanges);
  }, [nodes, onNodesChange, onPersonsMove]);
  
  // Обработка клика по узлу
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const person = tree.persons.get(node.id);
    onPersonSelect?.(person || null);
  }, [tree, onPersonSelect]);
  
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
    <div ref={reactFlowWrapper} className={styles.container} style={containerStyle}>
      <ReactFlow
        nodes={nodes}
        edges={[]} // Не используем edges React Flow
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag
        panOnDrag={[1, 2]} // Средняя и правая кнопки для pan
        selectNodesOnDrag={false}
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
