// Карточка человека для отображения в дереве
import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { UserOutlined } from '@ant-design/icons';
import type { Person } from '../../types';
import styles from './PersonCard.module.scss';

interface PersonCardData {
  person: Person;
  isRoot?: boolean;
  showPhoto?: boolean;
  generation?: number;
}

const PersonCard: React.FC<NodeProps<PersonCardData>> = ({ data, selected }) => {
  const { person, isRoot, showPhoto = true } = data;
  const settings = person.displaySettings || {};
  
  // Определяем стили на основе настроек
  const borderRadiusMap = {
    'none': '0',
    'small': '4px',
    'medium': '8px',
    'large': '16px',
  };
  
  const cardStyle: React.CSSProperties = {
    backgroundColor: settings.backgroundColor || '#ffffff',
    backgroundImage: settings.backgroundImage ? `url(${settings.backgroundImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderRadius: borderRadiusMap[settings.borderRadius || 'medium'],
    borderStyle: settings.borderStyle || 'solid',
    borderColor: settings.borderColor || '#d9d9d9',
    borderWidth: settings.borderWidth ?? 1,
  };
  
  // Определяем класс для пола
  const sexClass = person.sex === 'M' ? styles.male : person.sex === 'F' ? styles.female : styles.unknown;
  
  // Форматируем годы жизни
  const birthYear = person.birth?.date?.year;
  const deathYear = person.death?.date?.year;
  const lifeYears = birthYear || deathYear 
    ? `${birthYear || '?'} — ${deathYear || (person.death ? '?' : '')}`
    : '';
  
  // Показывать ли фото/аватар
  const hasPhoto = showPhoto && person.photos && person.photos.length > 0;
  
  return (
    <div 
      className={`${styles.card} ${sexClass} ${selected ? styles.selected : ''} ${isRoot ? styles.root : ''}`}
      style={cardStyle}
    >
      {/* Хэндлы для соединений */}
      <Handle
        type="target"
        position={Position.Top}
        className={styles.handle}
      />
      
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
          <div className={styles.name} title={person.name.fullName}>
            {person.name.fullName}
          </div>
          
          {person.name.maidenName && (
            <div className={styles.maidenName}>
              (урожд. {person.name.maidenName})
            </div>
          )}
          
          {lifeYears && (
            <div className={styles.dates}>
              {lifeYears}
            </div>
          )}
          
          {person.birth?.place && (
            <div className={styles.place} title={person.birth.place.original}>
              📍 {person.birth.place.city || person.birth.place.original}
            </div>
          )}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className={styles.handle}
      />
    </div>
  );
};

export default memo(PersonCard);
