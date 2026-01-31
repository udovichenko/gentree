// Основной компонент визуализации дерева
import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeChange,
  type Node,
  BackgroundVariant,
  type ReactFlowInstance,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { FamilyTree, Person } from '../../types';
import { buildFlowGraph } from '../../utils/treeUtils';
import PersonCard from '../PersonCard/PersonCard';
import FamilyNode from '../FamilyNode/FamilyNode';
import { edgeTypes } from '../CustomEdges';
import styles from './FamilyTreeView.module.scss';

// Регистрируем кастомные типы узлов
const nodeTypes = {
  personCard: PersonCard,
  familyNode: FamilyNode,
};

interface FamilyTreeViewProps {
  tree: FamilyTree;
  onPersonSelect?: (person: Person | null) => void;
  onPersonsMove?: (moves: Array<{ personId: string; offsetX: number }>) => void;
}

const FamilyTreeView: React.FC<FamilyTreeViewProps> = ({
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
  
  // Строим граф из данных дерева
  const { initialNodes, initialEdges, generationYPositions } = useMemo(() => {
    const result = buildFlowGraph(tree);
    return { 
      initialNodes: result.nodes, 
      initialEdges: result.edges,
      generationYPositions: result.generationYPositions,
    };
  }, [tree]);
  
  // Обновляем ref с позициями поколений в эффекте
  useEffect(() => {
    generationYPositionsRef.current = generationYPositions;
  }, [generationYPositions]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Обновляем узлы при изменении дерева
  useEffect(() => {
    const result = buildFlowGraph(tree);
    generationYPositionsRef.current = result.generationYPositions;
    setNodes(result.nodes);
    setEdges(result.edges);
  }, [tree, setNodes, setEdges]);
  
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
          if (node) {
            // Сохраняем только горизонтальное перемещение, Y остается фиксированным
            const generation = node.data.generation;
            const fixedY = generation !== undefined 
              ? generationYPositionsRef.current.get(generation) ?? node.position.y
              : node.position.y;
            
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
            if (node) {
              const offsetX = change.position.x - startPos.x + (node.data.person.displaySettings?.customPosition?.offsetX || 0);
              
              // Если выделено несколько узлов, собираем все смещения
              const selectedNodes = nodes.filter(n => n.selected);
              if (selectedNodes.length > 1) {
                const moves = selectedNodes.map(n => {
                  const start = dragStartPositions.current.get(n.id);
                  const currentOffset = n.data.person.displaySettings?.customPosition?.offsetX || 0;
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
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag
        panOnDrag={[1, 2]} // Средняя и правая кнопки для pan
        selectNodesOnDrag={false}
      >
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

export default FamilyTreeView;
