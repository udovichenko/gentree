// Утилиты для работы с деревом и построения графа для React Flow
import type { Node, Edge } from 'reactflow';
import { Position } from 'reactflow';
import type { FamilyTree, Person, TreeSettings } from '../types';

// Тип для узла персоны
export type PersonNodeData = {
  person: Person;
  isRoot?: boolean;
  showPhoto?: boolean;
  generation?: number;
  baseColorMale?: string;
  baseColorFemale?: string;
};

// Общий тип для всех узлов
export type TreeNode = Node<PersonNodeData>;

// Тип для рёбер (сейчас не используется, линии рисуются FamilyLines)
export type TreeEdge = Edge<Record<string, never>>;

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

// Константы раскладки (должны совпадать с FamilyLines)
const CARD_WIDTH = 200;
const CARD_HEIGHT = 120;

// ============== НОВЫЙ АЛГОРИТМ РАСКЛАДКИ ==============

// Функция раскладки дерева с учётом семейных связей
function layoutTree(
  tree: FamilyTree,
  visiblePersons: Set<string>,
  generations: Map<string, number>,
  horizontalGap: number,
  verticalGap: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();
  
  // Находим все семьи с видимыми членами
  const visibleFamilies: Array<{ familyId: string; gen: number }> = [];
  
  for (const [familyId, family] of tree.families) {
    const hasVisibleMember = 
      (family.husbandId && visiblePersons.has(family.husbandId)) ||
      (family.wifeId && visiblePersons.has(family.wifeId)) ||
      family.childrenIds.some(id => visiblePersons.has(id));
    
    if (hasVisibleMember) {
      // Определяем поколение семьи по родителям
      let gen = 0;
      if (family.husbandId && generations.has(family.husbandId)) {
        gen = generations.get(family.husbandId)!;
      } else if (family.wifeId && generations.has(family.wifeId)) {
        gen = generations.get(family.wifeId)!;
      }
      visibleFamilies.push({ familyId, gen });
    }
  }
  
  // Сортируем семьи по поколению (от старших к младшим)
  visibleFamilies.sort((a, b) => a.gen - b.gen);
  
  // Рекурсивная функция для расчёта ширины поддерева
  function calculateSubtreeWidth(personId: string, visited: Set<string> = new Set()): number {
    if (visited.has(personId) || !visiblePersons.has(personId)) return 0;
    visited.add(personId);
    
    const person = tree.persons.get(personId);
    if (!person) return CARD_WIDTH;
    
    // Находим семьи, где этот человек - родитель
    let totalChildrenWidth = 0;
    
    for (const familyId of person.spouseFamilyIds) {
      const family = tree.families.get(familyId);
      if (!family) continue;
      
      // Ширина детей
      const childrenWidths = family.childrenIds
        .filter(id => visiblePersons.has(id) && !visited.has(id))
        .map(id => calculateSubtreeWidth(id, visited));
      
      if (childrenWidths.length > 0) {
        totalChildrenWidth += childrenWidths.reduce((a, b) => a + b, 0) + 
          (childrenWidths.length - 1) * horizontalGap;
      }
    }
    
    return Math.max(CARD_WIDTH, totalChildrenWidth);
  }
  
  // Функция для размещения семьи (супруги + дети)
  function placeFamily(
    familyId: string,
    centerX: number,
    processedFamilies: Set<string>
  ): number {
    if (processedFamilies.has(familyId)) return 0;
    processedFamilies.add(familyId);
    
    const family = tree.families.get(familyId);
    if (!family) return 0;
    
    const husbandVisible = family.husbandId && visiblePersons.has(family.husbandId);
    const wifeVisible = family.wifeId && visiblePersons.has(family.wifeId);
    
    // Вычисляем поколение родителей
    let parentGen = 0;
    if (husbandVisible && generations.has(family.husbandId!)) {
      parentGen = generations.get(family.husbandId!)!;
    } else if (wifeVisible && generations.has(family.wifeId!)) {
      parentGen = generations.get(family.wifeId!)!;
    }
    
    const parentY = parentGen * (CARD_HEIGHT + verticalGap);
    
    // Собираем видимых детей
    const visibleChildren = family.childrenIds.filter(id => visiblePersons.has(id));
    
    // Рассчитываем ширину поддеревьев каждого ребёнка
    const childSubtreeWidths: Array<{ id: string; width: number }> = [];
    for (const childId of visibleChildren) {
      if (!placed.has(childId)) {
        const width = calculateSubtreeWidth(childId, new Set(placed));
        childSubtreeWidths.push({ id: childId, width: Math.max(width, CARD_WIDTH) });
      }
    }
    
    // Общая ширина всех детей
    let totalChildrenWidth = 0;
    if (childSubtreeWidths.length > 0) {
      totalChildrenWidth = childSubtreeWidths.reduce((sum, c) => sum + c.width, 0) +
        (childSubtreeWidths.length - 1) * horizontalGap;
    }
    
    // Ширина родителей
    let parentsWidth = 0;
    if (husbandVisible && wifeVisible) {
      parentsWidth = 2 * CARD_WIDTH + horizontalGap;
    } else if (husbandVisible || wifeVisible) {
      parentsWidth = CARD_WIDTH;
    }
    
    // Итоговая ширина семьи
    const familyWidth = Math.max(parentsWidth, totalChildrenWidth);
    
    // Размещаем родителей по центру
    if (husbandVisible && wifeVisible && !placed.has(family.husbandId!) && !placed.has(family.wifeId!)) {
      // Муж слева, жена справа
      const husbandX = centerX - horizontalGap / 2 - CARD_WIDTH;
      const wifeX = centerX + horizontalGap / 2;
      
      positions.set(family.husbandId!, { x: husbandX, y: parentY });
      positions.set(family.wifeId!, { x: wifeX, y: parentY });
      placed.add(family.husbandId!);
      placed.add(family.wifeId!);
    } else if (husbandVisible && !placed.has(family.husbandId!)) {
      positions.set(family.husbandId!, { x: centerX - CARD_WIDTH / 2, y: parentY });
      placed.add(family.husbandId!);
    } else if (wifeVisible && !placed.has(family.wifeId!)) {
      positions.set(family.wifeId!, { x: centerX - CARD_WIDTH / 2, y: parentY });
      placed.add(family.wifeId!);
    }
    
    // Размещаем детей
    if (childSubtreeWidths.length > 0) {
      const childY = (parentGen + 1) * (CARD_HEIGHT + verticalGap);
      let currentX = centerX - totalChildrenWidth / 2;
      
      for (const { id: childId, width: subtreeWidth } of childSubtreeWidths) {
        if (!placed.has(childId)) {
          const childCenterX = currentX + subtreeWidth / 2;
          positions.set(childId, { x: childCenterX - CARD_WIDTH / 2, y: childY });
          placed.add(childId);
          
          // Рекурсивно размещаем семьи этого ребёнка
          const child = tree.persons.get(childId);
          if (child) {
            for (const childFamilyId of child.spouseFamilyIds) {
              placeFamily(childFamilyId, childCenterX, processedFamilies);
            }
          }
          
          currentX += subtreeWidth + horizontalGap;
        }
      }
    }
    
    return familyWidth;
  }
  
  // Находим корневую точку - самую старшую семью с rootPerson или первую семью
  const rootPersonId = tree.settings.rootPersonId;
  let startFamilyId: string | null = null;
  
  if (rootPersonId) {
    const rootPerson = tree.persons.get(rootPersonId);
    if (rootPerson?.parentFamilyId) {
      startFamilyId = rootPerson.parentFamilyId;
    } else if (rootPerson?.spouseFamilyIds.length) {
      startFamilyId = rootPerson.spouseFamilyIds[0];
    }
  }
  
  // Если не нашли стартовую семью, берём самую старшую
  if (!startFamilyId && visibleFamilies.length > 0) {
    startFamilyId = visibleFamilies[0].familyId;
  }
  
  // Размещаем дерево от корня
  const processedFamilies = new Set<string>();
  
  // Сначала размещаем предков (идём вверх)
  function placeAncestors(personId: string, childCenterX: number) {
    const person = tree.persons.get(personId);
    if (!person || !person.parentFamilyId) return;
    
    const family = tree.families.get(person.parentFamilyId);
    if (!family || processedFamilies.has(person.parentFamilyId)) return;
    
    processedFamilies.add(person.parentFamilyId);
    
    const husbandVisible = family.husbandId && visiblePersons.has(family.husbandId);
    const wifeVisible = family.wifeId && visiblePersons.has(family.wifeId);
    
    if (!husbandVisible && !wifeVisible) return;
    
    // Вычисляем поколение родителей
    const parentGen = generations.get(personId)! - 1;
    const parentY = parentGen * (CARD_HEIGHT + verticalGap);
    
    // Размещаем родителей над ребёнком
    if (husbandVisible && wifeVisible && !placed.has(family.husbandId!) && !placed.has(family.wifeId!)) {
      const husbandX = childCenterX - horizontalGap / 2 - CARD_WIDTH;
      const wifeX = childCenterX + horizontalGap / 2;
      
      positions.set(family.husbandId!, { x: husbandX, y: parentY });
      positions.set(family.wifeId!, { x: wifeX, y: parentY });
      placed.add(family.husbandId!);
      placed.add(family.wifeId!);
      
      // Рекурсивно размещаем предков
      placeAncestors(family.husbandId!, husbandX + CARD_WIDTH / 2);
      placeAncestors(family.wifeId!, wifeX + CARD_WIDTH / 2);
    } else if (husbandVisible && !placed.has(family.husbandId!)) {
      positions.set(family.husbandId!, { x: childCenterX - CARD_WIDTH / 2, y: parentY });
      placed.add(family.husbandId!);
      placeAncestors(family.husbandId!, childCenterX);
    } else if (wifeVisible && !placed.has(family.wifeId!)) {
      positions.set(family.wifeId!, { x: childCenterX - CARD_WIDTH / 2, y: parentY });
      placed.add(family.wifeId!);
      placeAncestors(family.wifeId!, childCenterX);
    }
  }
  
  // Начинаем с корневого человека
  if (rootPersonId && visiblePersons.has(rootPersonId)) {
    const rootGen = generations.get(rootPersonId) || 0;
    const rootY = rootGen * (CARD_HEIGHT + verticalGap);
    
    // Сначала размещаем корневого человека
    positions.set(rootPersonId, { x: -CARD_WIDTH / 2, y: rootY });
    placed.add(rootPersonId);
    
    // Размещаем предков
    placeAncestors(rootPersonId, 0);
    
    // Размещаем семьи (супруг + дети)
    const rootPerson = tree.persons.get(rootPersonId);
    if (rootPerson) {
      for (const familyId of rootPerson.spouseFamilyIds) {
        placeFamily(familyId, 0, processedFamilies);
      }
    }
  }
  
  // Размещаем оставшиеся семьи (если есть)
  for (const { familyId } of visibleFamilies) {
    if (!processedFamilies.has(familyId)) {
      // Находим свободное место справа
      let maxX = 0;
      for (const pos of positions.values()) {
        maxX = Math.max(maxX, pos.x + CARD_WIDTH);
      }
      placeFamily(familyId, maxX + horizontalGap + CARD_WIDTH, processedFamilies);
    }
  }
  
  // Размещаем оставшихся людей без семей
  let nextX = 0;
  for (const pos of positions.values()) {
    nextX = Math.max(nextX, pos.x + CARD_WIDTH + horizontalGap);
  }
  
  for (const personId of visiblePersons) {
    if (!placed.has(personId)) {
      const gen = generations.get(personId) || 0;
      const y = gen * (CARD_HEIGHT + verticalGap);
      positions.set(personId, { x: nextX, y });
      nextX += CARD_WIDTH + horizontalGap;
    }
  }
  
  return positions;
}

// Построение узлов и рёбер для React Flow
export function buildFlowGraph(tree: FamilyTree): { nodes: TreeNode[]; edges: TreeEdge[]; generationYPositions: Map<number, number> } {
  const visiblePersons = getVisiblePersons(tree);
  const generations = normalizeGenerations(calculateGenerations(tree, visiblePersons));
  
  // Получаем настройки расстояний
  const verticalGap = tree.settings.verticalSpacing ?? 150;
  const horizontalGap = tree.settings.horizontalSpacing ?? 50;
  
  // Используем новый алгоритм раскладки
  const positions = layoutTree(tree, visiblePersons, generations, horizontalGap, verticalGap);
  
  // Сохраняем Y-позиции поколений для ограничения вертикального перемещения
  const generationYPositions = new Map<number, number>();
  const uniqueGenerations = new Set(generations.values());
  for (const gen of uniqueGenerations) {
    generationYPositions.set(gen, gen * (CARD_HEIGHT + verticalGap));
  }
  
  // Создаем узлы с позициями
  const nodes: TreeNode[] = [];

  for (const [personId, pos] of positions) {
    const person = tree.persons.get(personId);
    if (!person) continue;
    
    const gen = generations.get(personId) ?? 0;
    
    // Учитываем кастомное смещение (только по X)
    let x = pos.x;
    if (person.displaySettings?.customPosition) {
      x += person.displaySettings.customPosition.offsetX;
    }
    
    nodes.push({
      id: personId,
      type: 'personCard',
      position: { x, y: pos.y },
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
  }
  
  // Edges больше не создаём - линии рисуются компонентом FamilyLines
  const edges: TreeEdge[] = [];
  
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
