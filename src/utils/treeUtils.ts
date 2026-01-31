// Утилиты для работы с деревом и построения графа для React Flow
import type { Node, Edge } from 'reactflow';
import { Position } from 'reactflow';
import type { FamilyTree, Person, TreeSettings } from '../types';

export type TreeNode = Node<{
  person: Person;
  isRoot?: boolean;
  showPhoto?: boolean;
  generation?: number;
  baseColorMale?: string;
  baseColorFemale?: string;
}>;

export type TreeEdge = Edge<{
  spouseMidX?: number;
}>;

// Проверка, скрыт ли человек
function isPersonHidden(person: Person, settings: TreeSettings): boolean {
  if (person.isHidden) return true;
  if (settings.hiddenPersonIds.includes(person.id)) return true;
  if (settings.hiddenSurnames.includes(person.name.surname)) return true;
  return false;
}

// Проверка, скрыта ли ветка
function isBranchHidden(personId: string, settings: TreeSettings): boolean {
  return settings.hiddenBranchFromIds.includes(personId);
}

// Получение предков человека
function getAncestors(
  personId: string,
  tree: FamilyTree,
  visited = new Set<string>()
): Set<string> {
  if (visited.has(personId)) return visited;
  visited.add(personId);
  
  const person = tree.persons.get(personId);
  if (!person || !person.parentFamilyId) return visited;
  
  const family = tree.families.get(person.parentFamilyId);
  if (!family) return visited;
  
  if (family.husbandId) getAncestors(family.husbandId, tree, visited);
  if (family.wifeId) getAncestors(family.wifeId, tree, visited);
  
  return visited;
}

// Получение всех людей, которых нужно показать
function getVisiblePersons(tree: FamilyTree): Set<string> {
  const { settings, persons, families } = tree;
  const visible = new Set<string>();
  
  // Если нет корневого человека, показываем всех (не скрытых)
  if (!settings.rootPersonId) {
    for (const [id, person] of persons) {
      if (!isPersonHidden(person, settings) && !isBranchHidden(id, settings)) {
        visible.add(id);
      }
    }
    return visible;
  }
  
  // Если есть корневой человек
  const rootPerson = persons.get(settings.rootPersonId);
  if (!rootPerson) return visible;
  
  if (settings.showOnlyDirectAncestors) {
    // Только прямые предки
    const ancestors = getAncestors(settings.rootPersonId, tree);
    for (const id of ancestors) {
      const person = persons.get(id);
      if (person && !isPersonHidden(person, settings) && !isBranchHidden(id, settings)) {
        visible.add(id);
      }
    }
  } else {
    // Все связанные люди
    const toProcess = [settings.rootPersonId];
    const processed = new Set<string>();
    
    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!;
      if (processed.has(currentId)) continue;
      processed.add(currentId);
      
      const person = persons.get(currentId);
      if (!person) continue;
      if (isPersonHidden(person, settings) || isBranchHidden(currentId, settings)) continue;
      
      visible.add(currentId);
      
      // Родители
      if (person.parentFamilyId) {
        const family = families.get(person.parentFamilyId);
        if (family) {
          if (family.husbandId) toProcess.push(family.husbandId);
          if (family.wifeId) toProcess.push(family.wifeId);
          
          // Братья/сестры
          if (settings.showSiblings) {
            for (const siblingId of family.childrenIds) {
              toProcess.push(siblingId);
            }
          }
        }
      }
      
      // Супруги и дети
      for (const familyId of person.spouseFamilyIds) {
        const family = families.get(familyId);
        if (family) {
          if (family.husbandId) toProcess.push(family.husbandId);
          if (family.wifeId) toProcess.push(family.wifeId);
          for (const childId of family.childrenIds) {
            toProcess.push(childId);
          }
        }
      }
    }
  }
  
  return visible;
}

// Построение уровней дерева (для вертикальной раскладки)

function calculateGenerations(
  tree: FamilyTree,
  visiblePersons: Set<string>
): Map<string, number> {
  const generations = new Map<string, number>();
  const { persons, families, settings } = tree;
  
  // Начинаем с корневого человека или первого найденного
  const startId = settings.rootPersonId || visiblePersons.values().next().value;
  if (!startId) return generations;
  
  // BFS для определения поколений
  const queue: Array<{ id: string; gen: number }> = [{ id: startId, gen: 0 }];
  
  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    
    if (!visiblePersons.has(id)) continue;
    if (generations.has(id)) continue;
    
    generations.set(id, gen);
    
    const person = persons.get(id);
    if (!person) continue;
    
    // Родители - на поколение выше (меньше номер = выше на экране)
    if (person.parentFamilyId) {
      const family = families.get(person.parentFamilyId);
      if (family) {
        if (family.husbandId && visiblePersons.has(family.husbandId)) {
          queue.push({ id: family.husbandId, gen: gen - 1 });
        }
        if (family.wifeId && visiblePersons.has(family.wifeId)) {
          queue.push({ id: family.wifeId, gen: gen - 1 });
        }
      }
    }
    
    // Дети - на поколение ниже
    for (const familyId of person.spouseFamilyIds) {
      const family = families.get(familyId);
      if (family) {
        for (const childId of family.childrenIds) {
          if (visiblePersons.has(childId)) {
            queue.push({ id: childId, gen: gen + 1 });
          }
        }
      }
    }
  }
  
  return generations;
}

// Нормализация поколений (чтобы минимальное было 0)
function normalizeGenerations(generations: Map<string, number>): Map<string, number> {
  if (generations.size === 0) return generations;
  
  const minGen = Math.min(...generations.values());
  const normalized = new Map<string, number>();
  
  for (const [id, gen] of generations) {
    normalized.set(id, gen - minGen);
  }
  
  return normalized;
}

// Константы раскладки (дефолтные)
const CARD_WIDTH = 200;
const CARD_HEIGHT = 120;

// Построение узлов и рёбер для React Flow
export function buildFlowGraph(tree: FamilyTree): { nodes: TreeNode[]; edges: TreeEdge[]; generationYPositions: Map<number, number> } {
  const visiblePersons = getVisiblePersons(tree);
  const generations = normalizeGenerations(calculateGenerations(tree, visiblePersons));
  
  // Получаем настройки расстояний
  const verticalGap = tree.settings.verticalSpacing ?? 150;
  const horizontalGap = tree.settings.horizontalSpacing ?? 50;
  
  // Группируем по поколениям
  const generationGroups = new Map<number, string[]>();
  for (const [personId, gen] of generations) {
    if (!generationGroups.has(gen)) {
      generationGroups.set(gen, []);
    }
    generationGroups.get(gen)!.push(personId);
  }
  
  // Сохраняем Y-позиции поколений для ограничения вертикального перемещения
  const generationYPositions = new Map<number, number>();
  
  // Создаем узлы с позициями
  const nodes: TreeNode[] = [];

  for (const [gen, personIds] of generationGroups) {
    const y = gen * (CARD_HEIGHT + verticalGap);
    generationYPositions.set(gen, y);
    
    const totalWidth = personIds.length * CARD_WIDTH + (personIds.length - 1) * horizontalGap;
    const startX = -totalWidth / 2;
    
    personIds.forEach((personId, index) => {
      const person = tree.persons.get(personId);
      if (!person) return;
      
      // Учитываем кастомное смещение (только по X)
      let x = startX + index * (CARD_WIDTH + horizontalGap);
      
      if (person.displaySettings?.customPosition) {
        x += person.displaySettings.customPosition.offsetX;
      }
      
      nodes.push({
        id: personId,
        type: 'personCard',
        position: { x, y },
        data: {
          person,
          isRoot: personId === tree.settings.rootPersonId,
          showPhoto: tree.settings.showPhotos,
          generation: gen,
          baseColorMale: tree.settings.baseColorMale,
          baseColorFemale: tree.settings.baseColorFemale,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });
    });
  }
  
  // Создаем рёбра с новой логикой:
  // 1. Горизонтальная линия между супругами (используем боковые handles)
  // 2. От середины этой линии - ступенчатая линия к детям
  const edges: TreeEdge[] = [];
  const edgeSet = new Set<string>();
  
  // Сохраняем позиции узлов для расчёта spouseMidX
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    nodePositions.set(node.id, { x: node.position.x, y: node.position.y });
  }
  
  for (const [, family] of tree.families) {
    const husbandId = family.husbandId;
    const wifeId = family.wifeId;
    
    const husbandVisible = husbandId && visiblePersons.has(husbandId);
    const wifeVisible = wifeId && visiblePersons.has(wifeId);
    
    // Получаем позиции супругов
    const husbandPos = husbandId ? nodePositions.get(husbandId) : null;
    const wifePos = wifeId ? nodePositions.get(wifeId) : null;
    
    // Вычисляем X середины линии между супругами
    let spouseMidX: number | null = null;
    
    if (husbandVisible && wifeVisible && husbandPos && wifePos) {
      // Оба супруга видны - горизонтальная линия между ними
      // Определяем кто слева, кто справа
      const leftPos = husbandPos.x < wifePos.x ? husbandPos : wifePos;
      const rightPos = husbandPos.x < wifePos.x ? wifePos : husbandPos;
      const leftId = husbandPos.x < wifePos.x ? husbandId! : wifeId!;
      const rightId = husbandPos.x < wifePos.x ? wifeId! : husbandId!;
      
      // Середина между карточками
      spouseMidX = (leftPos.x + CARD_WIDTH + rightPos.x) / 2;
      
      const edgeId = `spouse-${husbandId}-${wifeId}`;
      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        edges.push({
          id: edgeId,
          source: leftId,
          target: rightId,
          type: 'spouse',
          sourceHandle: 'right',
          targetHandle: 'left',
          style: { 
            stroke: tree.settings.lineColor || '#8c8c8c',
            strokeWidth: tree.settings.lineWidth || 2,
          },
          data: {},
        });
      }
    } else if (husbandVisible && husbandPos) {
      spouseMidX = husbandPos.x + CARD_WIDTH / 2;
    } else if (wifeVisible && wifePos) {
      spouseMidX = wifePos.x + CARD_WIDTH / 2;
    }
    
    // Связи к детям - все идут от одной точки (середины линии супругов)
    if (spouseMidX !== null) {
      for (const childId of family.childrenIds) {
        if (!visiblePersons.has(childId)) continue;
        
        const childPos = nodePositions.get(childId);
        if (!childPos) continue;
        
        // Выбираем одного родителя как источник
        const sourceParentId = husbandVisible ? husbandId! : wifeId!;
        
        const edgeId = `child-${family.id}-${childId}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            source: sourceParentId,
            target: childId,
            type: 'parentChild',
            sourceHandle: 'bottom',
            targetHandle: 'top',
            style: { 
              stroke: tree.settings.lineColor || '#8c8c8c',
              strokeWidth: tree.settings.lineWidth || 2,
            },
            data: { 
              spouseMidX,
            },
          });
        }
      }
    }
  }
  
  return { nodes, edges, generationYPositions };
}

// Форматирование даты для отображения
export function formatDate(date: { original: string; year?: number; month?: number; day?: number; modifier?: string } | undefined): string {
  if (!date) return '';
  
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  
  let result = '';
  
  if (date.modifier) {
    const modifiers: Record<string, string> = {
      'ABT': 'ок.',
      'BEF': 'до',
      'AFT': 'после',
      'BET': 'между',
      'CAL': 'выч.',
      'EST': 'оц.',
    };
    result += (modifiers[date.modifier] || '') + ' ';
  }
  
  if (date.day) result += date.day + ' ';
  if (date.month) result += months[date.month] + ' ';
  if (date.year) result += date.year;
  
  return result.trim() || date.original;
}
