// Основные типы данных для генеалогического дерева

export interface GedcomDate {
  original: string;
  year?: number;
  month?: number;
  day?: number;
  modifier?: 'ABT' | 'BEF' | 'AFT' | 'BET' | 'CAL' | 'EST'; // приблизительно, до, после, между, вычислено, оценено
  endYear?: number; // для BET (между датами)
}

export interface Place {
  id: string;
  original: string;
  country?: string;
  region?: string;
  district?: string;
  city?: string;
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface PersonName {
  given: string;       // Имя (и отчество)
  surname: string;     // Фамилия
  maidenName?: string; // Девичья фамилия
  suffix?: string;     // Суффикс (титул, звание и т.д.)
  fullName: string;    // Полное имя для отображения
}

export type Sex = 'M' | 'F' | 'U'; // Male, Female, Unknown

export interface Event {
  date?: GedcomDate;
  place?: Place;
  description?: string;
}

export interface Person {
  id: string;
  uid?: string;
  name: PersonName;
  sex: Sex;
  
  // События жизни
  birth?: Event;
  death?: Event;
  burial?: Event;
  
  // Связи (ID других записей)
  parentFamilyId?: string;   // Семья, где этот человек - ребенок
  spouseFamilyIds: string[]; // Семьи, где этот человек - супруг
  
  // Дополнительные данные
  occupation?: string;
  education?: string;
  notes?: string;
  sources?: Source[];
  photos?: string[];
  
  // Настройки отображения (для кастомизации)
  displaySettings?: PersonDisplaySettings;
  
  // Флаг скрытия
  isHidden?: boolean;
}

export interface Family {
  id: string;
  uid?: string;
  husbandId?: string;
  wifeId?: string;
  childrenIds: string[];
  marriageEvent?: Event;
  divorceEvent?: Event;
}

export interface Source {
  id: string;
  title?: string;
  page?: string;
  text?: string;
}

// Настройки отображения карточки человека
export interface PersonDisplaySettings {
  backgroundColor?: string;
  backgroundImage?: string;
  borderRadius?: 'none' | 'small' | 'medium' | 'large';
  borderStyle?: 'none' | 'solid' | 'dashed' | 'double';
  borderColor?: string;
  borderWidth?: number;
  customPosition?: {
    offsetX: number; // смещение по X в процентах
    offsetY: number; // смещение по Y в процентах
  };
}

// Глобальные настройки дерева
export interface TreeSettings {
  rootPersonId?: string;          // От кого строим дерево
  showOnlyDirectAncestors: boolean; // Только прямые предки
  showSiblings: boolean;          // Показывать братьев/сестер
  hiddenPersonIds: string[];      // Скрытые люди
  hiddenBranchFromIds: string[];  // Скрыть ветки от этих людей
  hiddenSurnames: string[];       // Скрытые фамилии
  
  // Визуальные настройки
  backgroundColor?: string;
  backgroundImage?: string;
  defaultCardStyle: PersonDisplaySettings;
  lineColor?: string;
  lineWidth?: number;
  
  // Базовые цвета карточек
  baseColorMale: string;     // Цвет фона для мужчин
  baseColorFemale: string;   // Цвет фона для женщин
  
  // Настройки расстояний
  verticalSpacing: number;        // Расстояние между поколениями (по вертикали)
  horizontalSpacing: number;      // Расстояние между соседними ветками
  spouseSpacing: number;          // Расстояние между супругами
  
  // Отображение карточек
  showPhotos: boolean;            // Показывать фото в карточках
  cardWidth: number;              // Ширина карточки в пикселях
  showBirthPlace: boolean;        // Показывать место рождения
  showRelationship: boolean;      // Показывать кем приходится корню (мать, дед и т.д.)
  showFullDates: boolean;         // Показывать полные даты (не только год)
  hidePatronymic: boolean;        // Скрыть отчества
  showMaidenName: boolean;        // Показывать девичью фамилию
  
  // Стиль карточек (общий для всех)
  cardBorderRadius: 'none' | 'small' | 'medium' | 'large';
  cardBorderStyle: 'none' | 'solid' | 'dashed' | 'dotted';
  cardBorderColor: string;
  cardBorderWidth: number;
  
  // Перемещение карточек
  snapToGrid: boolean;            // Привязка к сетке при перемещении
  snapGridSize: number;           // Размер шага сетки в пикселях
}

// Полное состояние дерева
export interface FamilyTree {
  id: string;
  name: string;
  description?: string;
  persons: Map<string, Person>;
  families: Map<string, Family>;
  places: Map<string, Place>;
  sources: Map<string, Source>;
  settings: TreeSettings;
  createdAt: Date;
  updatedAt: Date;
}

// Для сериализации (Map -> Object)
export interface FamilyTreeData {
  id: string;
  name: string;
  description?: string;
  persons: Record<string, Person>;
  families: Record<string, Family>;
  places: Record<string, Place>;
  sources: Record<string, Source>;
  settings: TreeSettings;
  createdAt: string;
  updatedAt: string;
}

// Дефолтные настройки
export const defaultTreeSettings: TreeSettings = {
  showOnlyDirectAncestors: false,
  showSiblings: true,
  hiddenPersonIds: [],
  hiddenBranchFromIds: [],
  hiddenSurnames: [],
  backgroundColor: '#f5f5f5',
  defaultCardStyle: {
    backgroundColor: '#ffffff',
    borderRadius: 'medium',
    borderStyle: 'solid',
    borderColor: '#d9d9d9',
    borderWidth: 1,
  },
  lineColor: '#8c8c8c',
  lineWidth: 2,
  baseColorMale: '#e6f4ff',       // Светло-голубой для мужчин
  baseColorFemale: '#fff0f6',     // Светло-розовый для женщин
  verticalSpacing: 150,
  horizontalSpacing: 50,
  spouseSpacing: 20,
  showPhotos: true,
  cardWidth: 200,                 // Ширина карточки по умолчанию
  showBirthPlace: true,           // Показывать место рождения
  showRelationship: true,         // Показывать кем приходится
  showFullDates: false,           // По умолчанию только год
  hidePatronymic: false,          // По умолчанию показывать отчества
  showMaidenName: true,           // По умолчанию показывать девичью фамилию
  // Стиль карточек
  cardBorderRadius: 'medium',
  cardBorderStyle: 'solid',
  cardBorderColor: '#d9d9d9',
  cardBorderWidth: 1,
  // Перемещение карточек
  snapToGrid: true,
  snapGridSize: 8,
};
