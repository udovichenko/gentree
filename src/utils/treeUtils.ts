// Утилиты для работы с деревом и построения графа для React Flow
import type { Node, Edge } from 'reactflow';
import { Position } from 'reactflow';
import type { FamilyTree, Person, TreeSettings } from '../types';
import { getRelationship } from './relationshipUtils';

// Тип для узла персоны
export type PersonNodeData = {
  person: Person;
  isRoot?: boolean;
  showPhoto?: boolean;
  generation?: number;
  baseColorMale?: string;
  baseColorFemale?: string;
  // Настройки отображения
  cardWidth?: number;
  showBirthPlace?: boolean;
  showRelationship?: boolean;
  relationshipName?: string;
  showFullDates?: boolean;
  hidePatronymic?: boolean;
  showMaidenName?: boolean;
  // Стиль карточки
  cardBorderRadius?: 'none' | 'small' | 'medium' | 'large';
  cardBorderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
  cardBorderColor?: string;
  cardBorderWidth?: number;
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
    // Когда галочка ВКЛЮЧЕНА - показываем только прямых предков и их супругов
    const ancestors = getAncestors(settings.rootPersonId, tree);
    
    // Сначала добавляем всех прямых предков
    for (const id of ancestors) {
      const person = persons.get(id);
      if (person && !isPersonHidden(person, settings) && !isBranchHidden(id, settings)) {
        visible.add(id);
      }
    }
    
    // Затем добавляем супругов прямых предков (чтобы были видны пары)
    for (const ancestorId of ancestors) {
      const person = persons.get(ancestorId);
      if (!person) continue;
      
      for (const familyId of person.spouseFamilyIds) {
        const family = families.get(familyId);
        if (!family) continue;
        
        // Проверяем, есть ли общие дети в списке прямых предков
        const hasAncestorChild = family.childrenIds.some(childId => ancestors.has(childId));
        if (!hasAncestorChild) continue;
        
        // Добавляем супруга
        const spouseId = family.husbandId === ancestorId ? family.wifeId : family.husbandId;
        if (spouseId) {
          const spouse = persons.get(spouseId);
          if (spouse && !isPersonHidden(spouse, settings) && !isBranchHidden(spouseId, settings)) {
            visible.add(spouseId);
          }
        }
      }
    }
    
    // Добавляем супруга корневого человека
    const rootPerson = persons.get(settings.rootPersonId);
    if (rootPerson) {
      for (const familyId of rootPerson.spouseFamilyIds) {
        const family = families.get(familyId);
        if (family) {
          const spouseId = family.husbandId === settings.rootPersonId ? family.wifeId : family.husbandId;
          if (spouseId) {
            const spouse = persons.get(spouseId);
            if (spouse && !isPersonHidden(spouse, settings) && !isBranchHidden(spouseId, settings)) {
              visible.add(spouseId);
            }
          }
        }
      }
    }
  } else {
    // Когда галочка ВЫКЛЮЧЕНА - показываем всех связанных людей
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

// ============== УЛУЧШЕННЫЙ АЛГОРИТМ РАСКЛАДКИ ==============

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
  
  // Функция для расчёта ширины поддерева персоны
  function getSubtreeWidth(personId: string, visited: Set<string>): number {
    if (visited.has(personId) || !visiblePersons.has(personId)) return 0;
    visited.add(personId);
    
    const person = tree.persons.get(personId);
    if (!person) return CARD_WIDTH;
    
    let maxChildrenWidth = 0;
    
    for (const familyId of person.spouseFamilyIds) {
      const family = tree.families.get(familyId);
      if (!family) continue;
      
      const visibleChildren = family.childrenIds.filter(id => 
        visiblePersons.has(id) && !visited.has(id)
      );
      
      if (visibleChildren.length > 0) {
        let childrenWidth = 0;
        for (const childId of visibleChildren) {
          const childWidth = getSubtreeWidth(childId, new Set(visited));
          childrenWidth += Math.max(childWidth, CARD_WIDTH);
        }
        childrenWidth += (visibleChildren.length - 1) * horizontalGap;
        maxChildrenWidth = Math.max(maxChildrenWidth, childrenWidth);
      }
    }
    
    // Минимальная ширина - карточка, но если есть супруг - пара
    return Math.max(CARD_WIDTH, maxChildrenWidth);
  }
  
  // Проверка коллизий и поиск свободного места
  function findFreeX(y: number, width: number, preferredX: number): number {
    const occupied: Array<{ left: number; right: number }> = [];
    
    for (const [id, pos] of positions) {
      const gen = generations.get(id);
      if (gen !== undefined) {
        const posY = gen * (CARD_HEIGHT + verticalGap);
        if (Math.abs(posY - y) < CARD_HEIGHT) {
          occupied.push({ left: pos.x - horizontalGap, right: pos.x + CARD_WIDTH + horizontalGap });
        }
      }
    }
    
    // Проверяем, свободно ли предпочтительное место
    const checkFree = (x: number) => {
      for (const { left, right } of occupied) {
        if (x < right && x + width > left) return false;
      }
      return true;
    };
    
    if (checkFree(preferredX)) return preferredX;
    
    // Ищем ближайшее свободное место
    for (let offset = horizontalGap; offset < 10000; offset += horizontalGap) {
      if (checkFree(preferredX + offset)) return preferredX + offset;
      if (checkFree(preferredX - offset)) return preferredX - offset;
    }
    
    return preferredX;
  }
  
  // Поиск свободного места ТОЛЬКО справа от preferredX (не влево)
  function findFreeXRightOnly(y: number, width: number, preferredX: number): number {
    const occupied: Array<{ left: number; right: number }> = [];
    
    for (const [id, pos] of positions) {
      const gen = generations.get(id);
      if (gen !== undefined) {
        const posY = gen * (CARD_HEIGHT + verticalGap);
        if (Math.abs(posY - y) < CARD_HEIGHT) {
          occupied.push({ left: pos.x - horizontalGap, right: pos.x + CARD_WIDTH + horizontalGap });
        }
      }
    }
    
    const checkFree = (x: number) => {
      for (const { left, right } of occupied) {
        if (x < right && x + width > left) return false;
      }
      return true;
    };
    
    // Ищем свободное место только вправо
    let x = preferredX;
    while (!checkFree(x) && x < 10000) {
      x += horizontalGap;
    }
    
    return x;
  }
  
  // Размещение супруга рядом с уже размещённым
  function placeSpouseNear(spouseId: string, existingId: string, gen: number) {
    const existingPos = positions.get(existingId);
    if (!existingPos) return;
    
    const y = gen * (CARD_HEIGHT + verticalGap);
    
    // Пробуем справа
    let x = existingPos.x + CARD_WIDTH + horizontalGap;
    x = findFreeX(y, CARD_WIDTH, x);
    
    positions.set(spouseId, { x, y });
    placed.add(spouseId);
  }
  
  // Рекурсивное размещение предков
  function placeAncestors(personId: string, centerX: number, processedFamilies: Set<string>) {
    const person = tree.persons.get(personId);
    if (!person || !person.parentFamilyId) return;
    
    const family = tree.families.get(person.parentFamilyId);
    if (!family || processedFamilies.has(person.parentFamilyId)) return;
    
    processedFamilies.add(person.parentFamilyId);
    
    const husbandVisible = family.husbandId && visiblePersons.has(family.husbandId);
    const wifeVisible = family.wifeId && visiblePersons.has(family.wifeId);
    
    if (!husbandVisible && !wifeVisible) return;
    
    const gen = generations.get(personId);
    if (gen === undefined) return;
    
    const parentGen = gen - 1;
    const y = parentGen * (CARD_HEIGHT + verticalGap);
    
    const husbandPlaced = family.husbandId && placed.has(family.husbandId);
    const wifePlaced = family.wifeId && placed.has(family.wifeId);
    
    if (husbandVisible && wifeVisible) {
      if (!husbandPlaced && !wifePlaced) {
        // Размещаем обоих супругов
        const husbandX = findFreeX(y, CARD_WIDTH, centerX - CARD_WIDTH - horizontalGap / 2);
        positions.set(family.husbandId!, { x: husbandX, y });
        placed.add(family.husbandId!);
        
        const wifeX = findFreeX(y, CARD_WIDTH, husbandX + CARD_WIDTH + horizontalGap);
        positions.set(family.wifeId!, { x: wifeX, y });
        placed.add(family.wifeId!);
        
        placeAncestors(family.husbandId!, husbandX + CARD_WIDTH / 2, processedFamilies);
        placeAncestors(family.wifeId!, wifeX + CARD_WIDTH / 2, processedFamilies);
      } else if (husbandPlaced && !wifePlaced) {
        placeSpouseNear(family.wifeId!, family.husbandId!, parentGen);
        placeAncestors(family.wifeId!, positions.get(family.wifeId!)!.x + CARD_WIDTH / 2, processedFamilies);
      } else if (wifePlaced && !husbandPlaced) {
        const wifePos = positions.get(family.wifeId!)!;
        const husbandX = findFreeX(y, CARD_WIDTH, wifePos.x - CARD_WIDTH - horizontalGap);
        positions.set(family.husbandId!, { x: husbandX, y });
        placed.add(family.husbandId!);
        placeAncestors(family.husbandId!, husbandX + CARD_WIDTH / 2, processedFamilies);
      }
    } else if (husbandVisible && !husbandPlaced) {
      const x = findFreeX(y, CARD_WIDTH, centerX - CARD_WIDTH / 2);
      positions.set(family.husbandId!, { x, y });
      placed.add(family.husbandId!);
      placeAncestors(family.husbandId!, x + CARD_WIDTH / 2, processedFamilies);
    } else if (wifeVisible && !wifePlaced) {
      const x = findFreeX(y, CARD_WIDTH, centerX - CARD_WIDTH / 2);
      positions.set(family.wifeId!, { x, y });
      placed.add(family.wifeId!);
      placeAncestors(family.wifeId!, x + CARD_WIDTH / 2, processedFamilies);
    }
  }
  
  // Размещение потомков
  function placeDescendants(familyId: string, centerX: number, processedFamilies: Set<string>) {
    if (processedFamilies.has(familyId)) return;
    processedFamilies.add(familyId);
    
    const family = tree.families.get(familyId);
    if (!family) return;
    
    const husbandVisible = family.husbandId && visiblePersons.has(family.husbandId);
    const wifeVisible = family.wifeId && visiblePersons.has(family.wifeId);
    
    // Определяем поколение родителей
    let parentGen = 0;
    if (husbandVisible && generations.has(family.husbandId!)) {
      parentGen = generations.get(family.husbandId!)!;
    } else if (wifeVisible && generations.has(family.wifeId!)) {
      parentGen = generations.get(family.wifeId!)!;
    }
    
    const parentY = parentGen * (CARD_HEIGHT + verticalGap);
    
    // Размещаем супругов если нужно
    const husbandPlaced = family.husbandId && placed.has(family.husbandId);
    const wifePlaced = family.wifeId && placed.has(family.wifeId);
    
    let familyCenterX = centerX;
    
    if (husbandVisible && wifeVisible) {
      if (husbandPlaced && !wifePlaced) {
        placeSpouseNear(family.wifeId!, family.husbandId!, parentGen);
        const hp = positions.get(family.husbandId!)!;
        const wp = positions.get(family.wifeId!)!;
        familyCenterX = (hp.x + wp.x + CARD_WIDTH) / 2;
      } else if (wifePlaced && !husbandPlaced) {
        const wifePos = positions.get(family.wifeId!)!;
        const husbandX = findFreeX(parentY, CARD_WIDTH, wifePos.x - CARD_WIDTH - horizontalGap);
        positions.set(family.husbandId!, { x: husbandX, y: parentY });
        placed.add(family.husbandId!);
        familyCenterX = (husbandX + wifePos.x + CARD_WIDTH) / 2;
      } else if (!husbandPlaced && !wifePlaced) {
        const husbandX = findFreeX(parentY, CARD_WIDTH, centerX - CARD_WIDTH - horizontalGap / 2);
        positions.set(family.husbandId!, { x: husbandX, y: parentY });
        placed.add(family.husbandId!);
        
        const wifeX = findFreeX(parentY, CARD_WIDTH, husbandX + CARD_WIDTH + horizontalGap);
        positions.set(family.wifeId!, { x: wifeX, y: parentY });
        placed.add(family.wifeId!);
        
        familyCenterX = (husbandX + wifeX + CARD_WIDTH) / 2;
      } else {
        const hp = positions.get(family.husbandId!)!;
        const wp = positions.get(family.wifeId!)!;
        familyCenterX = (hp.x + wp.x + CARD_WIDTH) / 2;
      }
    } else if (husbandVisible && !husbandPlaced) {
      const x = findFreeX(parentY, CARD_WIDTH, centerX - CARD_WIDTH / 2);
      positions.set(family.husbandId!, { x, y: parentY });
      placed.add(family.husbandId!);
      familyCenterX = x + CARD_WIDTH / 2;
    } else if (wifeVisible && !wifePlaced) {
      const x = findFreeX(parentY, CARD_WIDTH, centerX - CARD_WIDTH / 2);
      positions.set(family.wifeId!, { x, y: parentY });
      placed.add(family.wifeId!);
      familyCenterX = x + CARD_WIDTH / 2;
    }
    
    // Размещаем детей
    const visibleChildren = family.childrenIds.filter(id => visiblePersons.has(id));
    const unplacedChildren = visibleChildren.filter(id => !placed.has(id));
    
    if (unplacedChildren.length > 0) {
      const childGen = parentGen + 1;
      const childY = childGen * (CARD_HEIGHT + verticalGap);
      
      // Проверяем, есть ли уже размещённые дети с супругами
      // Если да, то siblings нужно размещать снаружи от этих пар
      const placedChildrenWithSpouses: Array<{
        childId: string;
        childX: number;
        spouseX: number;
        leftEdge: number;
        rightEdge: number;
      }> = [];
      
      for (const childId of visibleChildren) {
        if (!placed.has(childId)) continue;
        
        const childPos = positions.get(childId);
        if (!childPos) continue;
        
        const child = tree.persons.get(childId);
        if (!child) continue;
        
        // Ищем супруга этого ребёнка
        for (const childFamilyId of child.spouseFamilyIds) {
          const childFamily = tree.families.get(childFamilyId);
          if (!childFamily) continue;
          
          const spouseId = childFamily.husbandId === childId ? childFamily.wifeId : childFamily.husbandId;
          if (!spouseId || !placed.has(spouseId)) continue;
          
          const spousePos = positions.get(spouseId);
          if (!spousePos) continue;
          
          placedChildrenWithSpouses.push({
            childId,
            childX: childPos.x,
            spouseX: spousePos.x,
            leftEdge: Math.min(childPos.x, spousePos.x),
            rightEdge: Math.max(childPos.x, spousePos.x) + CARD_WIDTH,
          });
        }
      }
      
      // Рассчитываем ширину поддеревьев для неразмещённых детей
      const childWidths: Array<{ id: string; width: number }> = [];
      for (const childId of unplacedChildren) {
        const width = Math.max(CARD_WIDTH, getSubtreeWidth(childId, new Set(placed)));
        childWidths.push({ id: childId, width });
      }
      
      const totalWidth = childWidths.reduce((sum, c) => sum + c.width, 0) + 
        (childWidths.length - 1) * horizontalGap;
      
      // Определяем стартовую позицию - справа от всех пар если они есть
      let startX: number;
      if (placedChildrenWithSpouses.length > 0) {
        // Размещаем справа от самой правой пары
        const maxRightEdge = Math.max(...placedChildrenWithSpouses.map(p => p.rightEdge));
        startX = maxRightEdge + horizontalGap;
      } else {
        startX = familyCenterX - totalWidth / 2;
      }
      
      let currentX = startX;
      
      for (const { id: childId, width } of childWidths) {
        const childCenterX = currentX + width / 2;
        const childX = findFreeX(childY, CARD_WIDTH, childCenterX - CARD_WIDTH / 2);
        
        positions.set(childId, { x: childX, y: childY });
        placed.add(childId);
        
        // Размещаем семьи ребёнка
        const child = tree.persons.get(childId);
        if (child) {
          for (const childFamilyId of child.spouseFamilyIds) {
            placeDescendants(childFamilyId, childX + CARD_WIDTH / 2, processedFamilies);
          }
        }
        
        currentX += width + horizontalGap;
      }
    }
  }
  
  const processedFamilies = new Set<string>();
  const rootPersonId = tree.settings.rootPersonId;
  
  // Начинаем с корневого человека
  if (rootPersonId && visiblePersons.has(rootPersonId)) {
    const rootGen = generations.get(rootPersonId) || 0;
    const rootY = rootGen * (CARD_HEIGHT + verticalGap);
    
    positions.set(rootPersonId, { x: 0, y: rootY });
    placed.add(rootPersonId);
    
    // Размещаем предков
    placeAncestors(rootPersonId, CARD_WIDTH / 2, processedFamilies);
    
    // Размещаем семьи (супруг + дети)
    const rootPerson = tree.persons.get(rootPersonId);
    if (rootPerson) {
      for (const familyId of rootPerson.spouseFamilyIds) {
        placeDescendants(familyId, CARD_WIDTH / 2, processedFamilies);
      }
    }
  }
  
  // Размещаем оставшиеся семьи
  for (const [familyId, family] of tree.families) {
    if (processedFamilies.has(familyId)) continue;
    
    const hasVisible = 
      (family.husbandId && visiblePersons.has(family.husbandId)) ||
      (family.wifeId && visiblePersons.has(family.wifeId));
    
    if (!hasVisible) continue;
    
    let maxX = 0;
    for (const pos of positions.values()) {
      maxX = Math.max(maxX, pos.x + CARD_WIDTH);
    }
    
    placeDescendants(familyId, maxX + horizontalGap * 2 + CARD_WIDTH, processedFamilies);
  }
  
  // Размещаем оставшихся людей без семей
  // Для siblings нужно размещать их справа от пары брата/сестры
  for (const personId of visiblePersons) {
    if (placed.has(personId)) continue;
    
    const person = tree.persons.get(personId);
    if (!person) continue;
    
    const gen = generations.get(personId) || 0;
    const y = gen * (CARD_HEIGHT + verticalGap);
    
    // Проверяем, есть ли у этого человека siblings которые уже размещены
    let preferredX: number | null = null;
    
    if (person.parentFamilyId) {
      const parentFamily = tree.families.get(person.parentFamilyId);
      if (parentFamily) {
        // Ищем размещённых siblings и их супругов
        let maxSiblingRightEdge = -Infinity;
        
        for (const siblingId of parentFamily.childrenIds) {
          if (siblingId === personId) continue;
          if (!placed.has(siblingId)) continue;
          
          const siblingPos = positions.get(siblingId);
          if (!siblingPos) continue;
          
          // Учитываем позицию sibling
          maxSiblingRightEdge = Math.max(maxSiblingRightEdge, siblingPos.x + CARD_WIDTH);
          
          // Проверяем супруга sibling
          const sibling = tree.persons.get(siblingId);
          if (sibling) {
            for (const familyId of sibling.spouseFamilyIds) {
              const family = tree.families.get(familyId);
              if (!family) continue;
              
              const spouseId = family.husbandId === siblingId ? family.wifeId : family.husbandId;
              if (spouseId && placed.has(spouseId)) {
                const spousePos = positions.get(spouseId);
                if (spousePos) {
                  maxSiblingRightEdge = Math.max(maxSiblingRightEdge, spousePos.x + CARD_WIDTH);
                }
              }
            }
          }
        }
        
        if (maxSiblingRightEdge > -Infinity) {
          preferredX = maxSiblingRightEdge + horizontalGap;
        }
      }
    }
    
    // Если не нашли sibling, используем общий nextX
    if (preferredX === null) {
      let maxX = 0;
      for (const pos of positions.values()) {
        maxX = Math.max(maxX, pos.x + CARD_WIDTH);
      }
      preferredX = maxX + horizontalGap;
    }
    
    // Размещаем, но ищем место ТОЛЬКО справа от preferredX
    const x = findFreeXRightOnly(y, CARD_WIDTH, preferredX);
    positions.set(personId, { x, y });
    placed.add(personId);
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
    
    // Определяем родственную связь
    let relationshipName: string | undefined;
    if (tree.settings.showRelationship && tree.settings.rootPersonId) {
      relationshipName = getRelationship(tree, tree.settings.rootPersonId, personId) || undefined;
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
        // Настройки отображения
        cardWidth: tree.settings.cardWidth,
        showBirthPlace: tree.settings.showBirthPlace,
        showRelationship: tree.settings.showRelationship,
        relationshipName,
        showFullDates: tree.settings.showFullDates,
        hidePatronymic: tree.settings.hidePatronymic,
        showMaidenName: tree.settings.showMaidenName,
        // Стиль карточки
        cardBorderRadius: tree.settings.cardBorderRadius,
        cardBorderStyle: tree.settings.cardBorderStyle,
        cardBorderColor: tree.settings.cardBorderColor,
        cardBorderWidth: tree.settings.cardBorderWidth,
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
