// Карточка человека для отображения в дереве
import React, { memo } from 'react';
import { type NodeProps } from 'reactflow';
import { UserOutlined } from '@ant-design/icons';
import type { Person } from '../../types';
import { formatDate, formatName } from '../../utils/relationshipUtils';
import styles from './PersonCard.module.scss';

interface PersonCardData {
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
  // Стиль карточки (общий)
  cardBorderRadius?: 'none' | 'small' | 'medium' | 'large';
  cardBorderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
  cardBorderColor?: string;
  cardBorderWidth?: number;
}

const PersonCard: React.FC<NodeProps<PersonCardData>> = ({ data, selected }) => {
  const { 
    person, 
    isRoot, 
    showPhoto = true, 
    baseColorMale, 
    baseColorFemale,
    cardWidth = 200,
    showBirthPlace = true,
    showRelationship = true,
    relationshipName,
    showFullDates = false,
    hidePatronymic = false,
    showMaidenName = true,
    // Стиль карточки
    cardBorderRadius = 'medium',
    cardBorderStyle = 'solid',
    cardBorderColor = '#d9d9d9',
    cardBorderWidth = 1,
  } = data;
  
  // Индивидуальные настройки человека (перезаписывают общие)
  const personSettings = person.displaySettings || {};
  
  // Определяем базовый цвет на основе пола (если не задан индивидуальный)
  const getBaseColor = () => {
    if (personSettings.backgroundColor) return personSettings.backgroundColor;
    if (person.sex === 'M' && baseColorMale) return baseColorMale;
    if (person.sex === 'F' && baseColorFemale) return baseColorFemale;
    return '#ffffff';
  };
  
  // Определяем стили на основе настроек
  const borderRadiusMap = {
    'none': '0',
    'small': '4px',
    'medium': '8px',
    'large': '16px',
  };
  
  // Используем индивидуальные настройки если есть, иначе общие
  const effectiveBorderRadius = personSettings.borderRadius || cardBorderRadius;
  const effectiveBorderStyle = personSettings.borderStyle || cardBorderStyle;
  const effectiveBorderColor = personSettings.borderColor || cardBorderColor;
  const effectiveBorderWidth = personSettings.borderWidth ?? cardBorderWidth;
  
  const cardStyle: React.CSSProperties = {
    backgroundColor: getBaseColor(),
    backgroundImage: personSettings.backgroundImage ? `url(${personSettings.backgroundImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderRadius: borderRadiusMap[effectiveBorderRadius],
    borderStyle: effectiveBorderStyle,
    borderColor: effectiveBorderColor,
    borderWidth: effectiveBorderWidth,
    width: cardWidth,
  };
  
  // Определяем класс для пола
  const sexClass = person.sex === 'M' ? styles.male : person.sex === 'F' ? styles.female : styles.unknown;
  
  // Форматируем даты жизни
  const birthDate = formatDate(person.birth?.date, showFullDates);
  const deathDate = formatDate(person.death?.date, showFullDates);
  const lifeYears = birthDate || deathDate 
    ? `${birthDate || '?'} — ${deathDate || (person.death ? '?' : '')}`
    : '';
  
  // Форматируем имя (девичья фамилия включается в formatName)
  const displayName = formatName(person.name, { 
    hidePatronymic, 
    showMaidenName 
  });
  
  // Показывать ли фото/аватар
  const hasPhoto = showPhoto && person.photos && person.photos.length > 0;
  
  return (
    <div 
      className={`${styles.card} ${sexClass} ${selected ? styles.selected : ''} ${isRoot ? styles.root : ''}`}
      style={cardStyle}
    >
      <div className={styles.content}>
        {/* Аватар / иконка */}
        {showPhoto && (
          <div className={styles.avatar}>
            {hasPhoto ? (
              <img src={person.photos![0]} alt={person.name.fullName} />
            ) : (
              <UserOutlined />
            )}
          </div>
        )}
        
        {/* Информация */}
        <div className={styles.info}>
          {/* Родственная связь */}
          {showRelationship && relationshipName && (
            <div className={styles.relationship}>
              {relationshipName}
            </div>
          )}
          
          <div className={styles.name} title={person.name.fullName}>
            {displayName}
          </div>
          
          {lifeYears && (
            <div className={styles.dates}>
              {lifeYears}
            </div>
          )}
          
          {showBirthPlace && person.birth?.place && (
            <div className={styles.place} title={person.birth.place.original}>
              📍 {person.birth.place.city || person.birth.place.original}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(PersonCard);
