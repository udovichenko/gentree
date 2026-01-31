// GEDCOM Parser - парсер формата GEDCOM 5.5.1
// Формат GEDCOM - текстовый иерархический формат для хранения генеалогических данных

import type {
  Person,
  Family,
  Place,
  Source,
  PersonName,
  Sex,
  GedcomDate,
  Event,
  FamilyTree,
} from '../types';
import { defaultTreeSettings } from '../types';

interface GedcomLine {
  level: number;
  tag: string;
  value: string;
  xref?: string; // @I1@, @F1@ и т.д.
}

interface GedcomNode {
  level: number;
  tag: string;
  value: string;
  xref?: string;
  children: GedcomNode[];
}

// Парсинг одной строки GEDCOM
function parseLine(line: string): GedcomLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  // Формат: LEVEL [XREF] TAG [VALUE]
  // Примеры:
  // 0 HEAD
  // 0 @I1@ INDI
  // 1 NAME Иван /Петров/
  // 2 GIVN Иван
  
  const match = trimmed.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/);
  if (!match) return null;
  
  return {
    level: parseInt(match[1], 10),
    xref: match[2],
    tag: match[3],
    value: match[4] || '',
  };
}

// Построение дерева из плоского списка строк
function buildTree(lines: GedcomLine[]): GedcomNode[] {
  const root: GedcomNode[] = [];
  const stack: GedcomNode[] = [];
  
  for (const line of lines) {
    const node: GedcomNode = {
      level: line.level,
      tag: line.tag,
      value: line.value,
      xref: line.xref,
      children: [],
    };
    
    // Найти родителя для текущего узла
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    
    stack.push(node);
  }
  
  return root;
}

// Парсинг даты GEDCOM
function parseDate(value: string): GedcomDate {
  const result: GedcomDate = { original: value };
  
  if (!value) return result;
  
  const upper = value.toUpperCase();
  
  // Определяем модификатор
  if (upper.startsWith('ABT ')) {
    result.modifier = 'ABT';
    value = value.substring(4);
  } else if (upper.startsWith('BEF ')) {
    result.modifier = 'BEF';
    value = value.substring(4);
  } else if (upper.startsWith('AFT ')) {
    result.modifier = 'AFT';
    value = value.substring(4);
  } else if (upper.startsWith('BET ')) {
    result.modifier = 'BET';
    // Формат: BET date1 AND date2
    const betMatch = value.match(/^BET\s+(.+?)\s+AND\s+(.+)$/i);
    if (betMatch) {
      const date1 = parseSimpleDate(betMatch[1]);
      const date2 = parseSimpleDate(betMatch[2]);
      result.year = date1.year;
      result.month = date1.month;
      result.day = date1.day;
      result.endYear = date2.year;
      return result;
    }
  } else if (upper.startsWith('CAL ')) {
    result.modifier = 'CAL';
    value = value.substring(4);
  } else if (upper.startsWith('EST ')) {
    result.modifier = 'EST';
    value = value.substring(4);
  }
  
  const parsed = parseSimpleDate(value);
  result.year = parsed.year;
  result.month = parsed.month;
  result.day = parsed.day;
  
  return result;
}

function parseSimpleDate(value: string): { year?: number; month?: number; day?: number } {
  const months: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  };
  
  // Формат: [DD] [MMM] YYYY
  const parts = value.trim().split(/\s+/);
  const result: { year?: number; month?: number; day?: number } = {};
  
  for (const part of parts) {
    const upper = part.toUpperCase();
    if (months[upper]) {
      result.month = months[upper];
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        if (num > 31) {
          result.year = num;
        } else if (!result.day) {
          result.day = num;
        }
      }
    }
  }
  
  return result;
}

// Парсинг имени GEDCOM
function parseName(node: GedcomNode): PersonName {
  // Формат VALUE: Given Name /Surname/
  const match = node.value.match(/^([^/]*)\s*\/([^/]*)\/?\s*(.*)$/);
  
  let given = '';
  let birthSurname = ''; // Фамилия при рождении (из основного поля или SURN)
  let marriedSurname = ''; // Фамилия в браке (_MARNM)
  let suffix = '';
  
  if (match) {
    given = match[1].trim();
    birthSurname = match[2].trim();
    suffix = match[3].trim();
  } else {
    given = node.value.trim();
  }
  
  // Ищем подробности в дочерних узлах
  for (const child of node.children) {
    switch (child.tag) {
      case 'GIVN':
        given = child.value;
        break;
      case 'SURN':
        birthSurname = child.value;
        break;
      case '_MARNM':
        // Фамилия в браке
        marriedSurname = child.value;
        break;
      case 'NSFX':
        suffix = child.value;
        break;
    }
  }
  
  // Если есть фамилия в браке, то:
  // surname = фамилия в браке (текущая)
  // maidenName = фамилия при рождении (девичья)
  // Если нет фамилии в браке, то surname = фамилия при рождении
  const surname = marriedSurname || birthSurname;
  const maidenName = marriedSurname && birthSurname && marriedSurname !== birthSurname 
    ? birthSurname 
    : undefined;
  
  const fullName = [given, surname].filter(Boolean).join(' ');
  
  return {
    given,
    surname,
    maidenName,
    suffix: suffix || undefined,
    fullName: fullName || 'Неизвестно',
  };
}

// Парсинг события (BIRT, DEAT, BURI, MARR и т.д.)
function parseEvent(node: GedcomNode, places: Map<string, Place>): Event {
  const event: Event = {};
  
  for (const child of node.children) {
    switch (child.tag) {
      case 'DATE':
        event.date = parseDate(child.value);
        break;
      case 'PLAC':
        event.place = getOrCreatePlace(child.value, places);
        break;
      case 'NOTE':
        event.description = child.value;
        break;
    }
  }
  
  return event;
}

// Получение или создание места
function getOrCreatePlace(placeStr: string, places: Map<string, Place>): Place {
  // Используем оригинальную строку как ключ
  const existing = places.get(placeStr);
  if (existing) return existing;
  
  const place: Place = {
    id: `P${places.size + 1}`,
    original: placeStr,
  };
  
  // Попробуем разобрать место (формат: город, район, область, страна)
  const parts = placeStr.split(',').map(p => p.trim());
  if (parts.length >= 1) place.city = parts[0];
  if (parts.length >= 2) place.district = parts[1];
  if (parts.length >= 3) place.region = parts[2];
  if (parts.length >= 4) place.country = parts[3];
  
  places.set(placeStr, place);
  return place;
}

// Парсинг записи INDI (человек)
function parseIndividual(node: GedcomNode, places: Map<string, Place>): Person {
  const id = node.xref?.replace(/@/g, '') || `I${Date.now()}`;
  
  const person: Person = {
    id,
    name: { given: '', surname: '', fullName: 'Неизвестно' },
    sex: 'U',
    spouseFamilyIds: [],
  };
  
  for (const child of node.children) {
    switch (child.tag) {
      case '_UID':
        person.uid = child.value;
        break;
      case 'NAME':
        person.name = parseName(child);
        break;
      case 'SEX':
        person.sex = (child.value as Sex) || 'U';
        break;
      case 'BIRT':
        person.birth = parseEvent(child, places);
        break;
      case 'DEAT':
        person.death = parseEvent(child, places);
        break;
      case 'BURI':
        person.burial = parseEvent(child, places);
        break;
      case 'FAMC':
        // Семья, где этот человек - ребенок
        person.parentFamilyId = child.value.replace(/@/g, '');
        break;
      case 'FAMS':
        // Семья, где этот человек - супруг
        person.spouseFamilyIds.push(child.value.replace(/@/g, ''));
        break;
      case 'OCCU':
        person.occupation = child.value;
        break;
      case 'EDUC':
        person.education = child.value;
        break;
      case 'NOTE':
        person.notes = child.value;
        break;
    }
  }
  
  return person;
}

// Парсинг записи FAM (семья)
function parseFamily(node: GedcomNode, places: Map<string, Place>): Family {
  const id = node.xref?.replace(/@/g, '') || `F${Date.now()}`;
  
  const family: Family = {
    id,
    childrenIds: [],
  };
  
  for (const child of node.children) {
    switch (child.tag) {
      case '_UID':
        family.uid = child.value;
        break;
      case 'HUSB':
        family.husbandId = child.value.replace(/@/g, '');
        break;
      case 'WIFE':
        family.wifeId = child.value.replace(/@/g, '');
        break;
      case 'CHIL':
        family.childrenIds.push(child.value.replace(/@/g, ''));
        break;
      case 'MARR':
        family.marriageEvent = parseEvent(child, places);
        break;
      case 'DIV':
        family.divorceEvent = parseEvent(child, places);
        break;
    }
  }
  
  return family;
}

// Парсинг записи SOUR (источник)
function parseSource(node: GedcomNode): Source {
  const id = node.xref?.replace(/@/g, '') || `S${Date.now()}`;
  
  const source: Source = { id };
  
  for (const child of node.children) {
    switch (child.tag) {
      case 'TITL':
        source.title = child.value;
        break;
      case 'PAGE':
        source.page = child.value;
        break;
      case 'TEXT':
        source.text = child.value;
        break;
    }
  }
  
  return source;
}

// Главная функция парсинга GEDCOM файла
export function parseGedcom(content: string): FamilyTree {
  const lines: GedcomLine[] = [];
  
  // Парсим все строки
  for (const line of content.split('\n')) {
    const parsed = parseLine(line);
    if (parsed) {
      lines.push(parsed);
    }
  }
  
  // Строим дерево
  const tree = buildTree(lines);
  
  // Создаем структуры данных
  const persons = new Map<string, Person>();
  const families = new Map<string, Family>();
  const places = new Map<string, Place>();
  const sources = new Map<string, Source>();
  
  // Обрабатываем узлы верхнего уровня
  for (const node of tree) {
    switch (node.tag) {
      case 'INDI': {
        const person = parseIndividual(node, places);
        persons.set(person.id, person);
        break;
      }
      case 'FAM': {
        const family = parseFamily(node, places);
        families.set(family.id, family);
        break;
      }
      case 'SOUR': {
        const source = parseSource(node);
        sources.set(source.id, source);
        break;
      }
    }
  }
  
  return {
    id: crypto.randomUUID(),
    name: 'Imported Tree',
    persons,
    families,
    places,
    sources,
    settings: { ...defaultTreeSettings },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Экспорт в GEDCOM формат
export function exportToGedcom(tree: FamilyTree): string {
  const lines: string[] = [];
  
  // Заголовок
  lines.push('0 HEAD');
  lines.push('1 SOUR GenTree');
  lines.push('2 NAME GenTree Web Application');
  lines.push('2 VERS 1.0');
  lines.push('1 CHAR UTF-8');
  lines.push(`1 DATE ${formatGedcomDate(new Date())}`);
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM Lineage-Linked');
  lines.push('1 SUBM @U0@');
  lines.push('0 @U0@ SUBM');
  lines.push('1 NAME GenTree User');
  
  // Люди
  for (const [id, person] of tree.persons) {
    lines.push(`0 @${id}@ INDI`);
    
    if (person.uid) {
      lines.push(`1 _UID ${person.uid}`);
    }
    
    // Имя
    const nameStr = `${person.name.given} /${person.name.surname}/`;
    lines.push(`1 NAME ${nameStr}`);
    if (person.name.given) lines.push(`2 GIVN ${person.name.given}`);
    if (person.name.surname) lines.push(`2 SURN ${person.name.surname}`);
    if (person.name.suffix) lines.push(`2 NSFX ${person.name.suffix}`);
    
    // Пол
    lines.push(`1 SEX ${person.sex}`);
    
    // Рождение
    if (person.birth) {
      lines.push('1 BIRT');
      if (person.birth.date) lines.push(`2 DATE ${person.birth.date.original}`);
      if (person.birth.place) lines.push(`2 PLAC ${person.birth.place.original}`);
    }
    
    // Смерть
    if (person.death) {
      if (person.death.date || person.death.place) {
        lines.push('1 DEAT');
        if (person.death.date) lines.push(`2 DATE ${person.death.date.original}`);
        if (person.death.place) lines.push(`2 PLAC ${person.death.place.original}`);
      } else {
        lines.push('1 DEAT Y');
      }
    }
    
    // Захоронение
    if (person.burial) {
      lines.push('1 BURI');
      if (person.burial.date) lines.push(`2 DATE ${person.burial.date.original}`);
      if (person.burial.place) lines.push(`2 PLAC ${person.burial.place.original}`);
    }
    
    // Семья родителей
    if (person.parentFamilyId) {
      lines.push(`1 FAMC @${person.parentFamilyId}@`);
    }
    
    // Семьи где супруг
    for (const famId of person.spouseFamilyIds) {
      lines.push(`1 FAMS @${famId}@`);
    }
  }
  
  // Семьи
  for (const [id, family] of tree.families) {
    lines.push(`0 @${id}@ FAM`);
    
    if (family.uid) {
      lines.push(`1 _UID ${family.uid}`);
    }
    
    if (family.husbandId) lines.push(`1 HUSB @${family.husbandId}@`);
    if (family.wifeId) lines.push(`1 WIFE @${family.wifeId}@`);
    
    for (const childId of family.childrenIds) {
      lines.push(`1 CHIL @${childId}@`);
    }
    
    if (family.marriageEvent) {
      lines.push('1 MARR');
      if (family.marriageEvent.date) lines.push(`2 DATE ${family.marriageEvent.date.original}`);
      if (family.marriageEvent.place) lines.push(`2 PLAC ${family.marriageEvent.place.original}`);
    }
  }
  
  // Конец файла
  lines.push('0 TRLR');
  
  return lines.join('\n');
}

function formatGedcomDate(date: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
