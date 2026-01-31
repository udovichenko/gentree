// Утилиты для определения родственных отношений
import type { FamilyTree, Person } from '../types';

export type RelationshipPath = {
  type: 'parent' | 'child' | 'spouse' | 'sibling';
  personId: string;
}[];

// Определение родственной связи между двумя людьми
export function getRelationship(
  tree: FamilyTree,
  fromPersonId: string,
  toPersonId: string
): string | null {
  if (fromPersonId === toPersonId) return 'Корень дерева';
  
  const { persons, families } = tree;
  const fromPerson = persons.get(fromPersonId);
  const toPerson = persons.get(toPersonId);
  
  if (!fromPerson || !toPerson) return null;
  
  // BFS для поиска пути
  const visited = new Set<string>();
  const queue: Array<{ id: string; path: RelationshipPath }> = [
    { id: fromPersonId, path: [] }
  ];
  
  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    
    if (id === toPersonId) {
      return pathToRelationshipName(path, toPerson.sex, persons);
    }
    
    if (visited.has(id)) continue;
    visited.add(id);
    
    // Ограничиваем глубину поиска
    if (path.length > 15) continue;
    
    const person = persons.get(id);
    if (!person) continue;
    
    // Родители
    if (person.parentFamilyId) {
      const family = families.get(person.parentFamilyId);
      if (family) {
        if (family.husbandId && !visited.has(family.husbandId)) {
          queue.push({ 
            id: family.husbandId, 
            path: [...path, { type: 'parent', personId: family.husbandId }] 
          });
        }
        if (family.wifeId && !visited.has(family.wifeId)) {
          queue.push({ 
            id: family.wifeId, 
            path: [...path, { type: 'parent', personId: family.wifeId }] 
          });
        }
        // Siblings
        for (const siblingId of family.childrenIds) {
          if (siblingId !== id && !visited.has(siblingId)) {
            queue.push({
              id: siblingId,
              path: [...path, { type: 'sibling', personId: siblingId }]
            });
          }
        }
      }
    }
    
    // Дети
    for (const familyId of person.spouseFamilyIds) {
      const family = families.get(familyId);
      if (family) {
        // Супруг
        const spouseId = family.husbandId === id ? family.wifeId : family.husbandId;
        if (spouseId && !visited.has(spouseId)) {
          queue.push({
            id: spouseId,
            path: [...path, { type: 'spouse', personId: spouseId }]
          });
        }
        // Дети
        for (const childId of family.childrenIds) {
          if (!visited.has(childId)) {
            queue.push({
              id: childId,
              path: [...path, { type: 'child', personId: childId }]
            });
          }
        }
      }
    }
  }
  
  return null;
}

// Преобразование пути в название отношения
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pathToRelationshipName(
  path: RelationshipPath, 
  sex: 'M' | 'F' | 'U',
  _persons: Map<string, Person>
): string {
  if (path.length === 0) return 'Корень дерева';
  
  // Анализируем путь
  const parentCount = path.filter(p => p.type === 'parent').length;
  const childCount = path.filter(p => p.type === 'child').length;
  const siblingCount = path.filter(p => p.type === 'sibling').length;
  const spouseCount = path.filter(p => p.type === 'spouse').length;
  
  const isMale = sex === 'M';
  const isFemale = sex === 'F';
  
  // Прямая линия предков (только parent)
  if (childCount === 0 && siblingCount === 0 && spouseCount === 0) {
    if (parentCount === 1) return isMale ? 'Отец' : isFemale ? 'Мать' : 'Родитель';
    if (parentCount === 2) return isMale ? 'Дедушка' : isFemale ? 'Бабушка' : 'Прародитель';
    if (parentCount === 3) return isMale ? 'Прадедушка' : isFemale ? 'Прабабушка' : 'Прапрародитель';
    if (parentCount >= 4) {
      const praCount = parentCount - 2;
      return isMale ? `Пра(${praCount})дедушка` : isFemale ? `Пра(${praCount})бабушка` : `Пра(${praCount})прародитель`;
    }
  }
  
  // Прямая линия потомков (только child)
  if (parentCount === 0 && siblingCount === 0 && spouseCount === 0) {
    if (childCount === 1) return isMale ? 'Сын' : isFemale ? 'Дочь' : 'Ребёнок';
    if (childCount === 2) return isMale ? 'Внук' : isFemale ? 'Внучка' : 'Внук/внучка';
    if (childCount === 3) return isMale ? 'Правнук' : isFemale ? 'Правнучка' : 'Правнук/правнучка';
    if (childCount >= 4) {
      const praCount = childCount - 2;
      return isMale ? `Пра(${praCount})внук` : isFemale ? `Пра(${praCount})внучка` : `Пра(${praCount})внук/внучка`;
    }
  }
  
  // Супруг
  if (spouseCount === 1 && parentCount === 0 && childCount === 0 && siblingCount === 0) {
    return isMale ? 'Муж' : isFemale ? 'Жена' : 'Супруг';
  }
  
  // Брат/сестра (sibling)
  if (siblingCount === 1 && parentCount === 0 && childCount === 0 && spouseCount === 0) {
    return isMale ? 'Брат' : isFemale ? 'Сестра' : 'Брат/сестра';
  }
  
  // Дядя/тётя (parent + sibling)
  if (parentCount === 1 && siblingCount === 1 && childCount === 0 && spouseCount === 0) {
    return isMale ? 'Дядя' : isFemale ? 'Тётя' : 'Дядя/тётя';
  }
  
  // Двоюродный брат/сестра (parent + sibling + child)
  if (parentCount === 1 && siblingCount === 1 && childCount === 1 && spouseCount === 0) {
    return isMale ? 'Двоюродный брат' : isFemale ? 'Двоюродная сестра' : 'Двоюродный брат/сестра';
  }
  
  // Племянник/племянница (sibling + child)
  if (siblingCount === 1 && childCount === 1 && parentCount === 0 && spouseCount === 0) {
    return isMale ? 'Племянник' : isFemale ? 'Племянница' : 'Племянник/племянница';
  }
  
  // Дедушка/бабушка брата/сестры родителя (двоюродные дедушка/бабушка)
  if (parentCount === 2 && siblingCount === 1 && childCount === 0 && spouseCount === 0) {
    return isMale ? 'Двоюродный дедушка' : isFemale ? 'Двоюродная бабушка' : 'Двоюродный дед/бабка';
  }
  
  // Троюродный брат/сестра
  if (parentCount === 2 && siblingCount === 1 && childCount === 2 && spouseCount === 0) {
    return isMale ? 'Троюродный брат' : isFemale ? 'Троюродная сестра' : 'Троюродный брат/сестра';
  }
  
  // Супруги родственников
  if (spouseCount === 1) {
    // Супруг родителя (не родитель) = отчим/мачеха
    if (parentCount === 1 && siblingCount === 0 && childCount === 0) {
      // Проверяем, является ли это биологическим родителем
      return isMale ? 'Отчим' : isFemale ? 'Мачеха' : 'Отчим/мачеха';
    }
    // Супруг брата/сестры
    if (siblingCount === 1 && parentCount === 0 && childCount === 0) {
      return isMale ? 'Зять (муж сестры/брата)' : isFemale ? 'Невестка/сноха' : 'Супруг брата/сестры';
    }
    // Супруг ребёнка
    if (childCount === 1 && parentCount === 0 && siblingCount === 0) {
      return isMale ? 'Зять' : isFemale ? 'Невестка' : 'Супруг ребёнка';
    }
  }
  
  // Свёкор/свекровь, тесть/тёща (родители супруга)
  if (spouseCount === 1 && parentCount === 1 && childCount === 0 && siblingCount === 0) {
    return isMale ? 'Свёкор/тесть' : isFemale ? 'Свекровь/тёща' : 'Родитель супруга';
  }
  
  // Шурин/золовка (брат/сестра супруга)
  if (spouseCount === 1 && siblingCount === 1 && parentCount === 0 && childCount === 0) {
    return isMale ? 'Шурин/деверь' : isFemale ? 'Золовка/свояченица' : 'Брат/сестра супруга';
  }
  
  // Общий случай - пытаемся описать
  let description = '';
  
  if (parentCount > 0) {
    description += `↑${parentCount} `;
  }
  if (siblingCount > 0) {
    description += `↔${siblingCount} `;
  }
  if (childCount > 0) {
    description += `↓${childCount} `;
  }
  if (spouseCount > 0) {
    description += `♥${spouseCount} `;
  }
  
  return `Родственник (${description.trim()})`;
}

// Форматирование даты
export function formatDate(
  date: { day?: number; month?: number; year?: number } | undefined,
  showFullDate: boolean
): string {
  if (!date) return '';
  
  if (showFullDate) {
    const parts: string[] = [];
    if (date.day) parts.push(String(date.day).padStart(2, '0'));
    if (date.month) parts.push(String(date.month).padStart(2, '0'));
    if (date.year) parts.push(String(date.year));
    return parts.join('.');
  }
  
  return date.year ? String(date.year) : '';
}

// Форматирование имени
// given = "Имя Отчество" (может быть просто "Имя")
// surname = "Фамилия"
// maidenName = "Девичья фамилия"
export function formatName(
  name: { given: string; surname: string; maidenName?: string },
  options: {
    hidePatronymic?: boolean;
    showMaidenName?: boolean;
  } = {}
): string {
  const { hidePatronymic = false, showMaidenName = true } = options;
  
  // Разбиваем given на имя и отчество
  const givenParts = name.given.trim().split(/\s+/);
  const firstName = givenParts[0] || '';
  const patronymic = givenParts.slice(1).join(' '); // Всё после первого слова - отчество
  
  // Формируем: Фамилия Имя [Отчество]
  const parts: string[] = [name.surname];
  
  if (firstName) {
    parts.push(firstName);
  }
  
  if (!hidePatronymic && patronymic) {
    parts.push(patronymic);
  }
  
  let result = parts.join(' ');
  
  // Добавляем девичью фамилию в скобках
  if (showMaidenName && name.maidenName) {
    result += ` (урожд. ${name.maidenName})`;
  }
  
  return result;
}
