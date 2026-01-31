// Панель информации и настроек человека
import React from 'react';
import {
  Drawer,
  Form,
  Select,
  ColorPicker,
  Slider,
  Button,
  Divider,
  Typography,
  Space,
  Collapse,
} from 'antd';
import {
  UserOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import type { Person, FamilyTree, PersonDisplaySettings } from '../../types';
import { formatDate } from '../../utils/treeUtils';
import styles from './PersonPanel.module.scss';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface PersonPanelProps {
  open: boolean;
  person: Person | null;
  tree: FamilyTree;
  onClose: () => void;
  onPersonUpdate: (person: Person) => void;
  onSetRootPerson: (personId: string) => void;
  onHidePerson: (personId: string) => void;
  onHideBranch: (personId: string) => void;
}

const PersonPanel: React.FC<PersonPanelProps> = ({
  open,
  person,
  tree,
  onClose,
  onPersonUpdate,
  onSetRootPerson,
  onHidePerson,
  onHideBranch,
}) => {
  if (!person) {
    return (
      <Drawer
        title="Информация"
        placement="left"
        width={360}
        onClose={onClose}
        open={open}
      >
        <Text type="secondary">Выберите человека для просмотра информации</Text>
      </Drawer>
    );
  }
  
  // Получение связанных людей
  const getRelatives = () => {
    const parents: Person[] = [];
    const spouses: Person[] = [];
    const children: Person[] = [];
    const siblings: Person[] = [];
    
    // Родители и братья/сестры
    if (person.parentFamilyId) {
      const family = tree.families.get(person.parentFamilyId);
      if (family) {
        if (family.husbandId) {
          const father = tree.persons.get(family.husbandId);
          if (father) parents.push(father);
        }
        if (family.wifeId) {
          const mother = tree.persons.get(family.wifeId);
          if (mother) parents.push(mother);
        }
        // Братья/сестры
        for (const childId of family.childrenIds) {
          if (childId !== person.id) {
            const sibling = tree.persons.get(childId);
            if (sibling) siblings.push(sibling);
          }
        }
      }
    }
    
    // Супруги и дети
    for (const familyId of person.spouseFamilyIds) {
      const family = tree.families.get(familyId);
      if (family) {
        // Супруг(а)
        const spouseId = family.husbandId === person.id ? family.wifeId : family.husbandId;
        if (spouseId) {
          const spouse = tree.persons.get(spouseId);
          if (spouse) spouses.push(spouse);
        }
        // Дети
        for (const childId of family.childrenIds) {
          const child = tree.persons.get(childId);
          if (child) children.push(child);
        }
      }
    }
    
    return { parents, spouses, children, siblings };
  };
  
  const relatives = getRelatives();
  
  // Обновление настроек отображения карточки
  const updateDisplaySettings = (updates: Partial<PersonDisplaySettings>) => {
    onPersonUpdate({
      ...person,
      displaySettings: {
        ...person.displaySettings,
        ...updates,
      },
    });
  };
  
  const settings = person.displaySettings || {};
  
  return (
    <Drawer
      title={person.name.fullName}
      placement="left"
      width={360}
      onClose={onClose}
      open={open}
      className={styles.drawer}
    >
      {/* Информация о человеке */}
      <div className={styles.section}>
        <Title level={5}>Информация</Title>
        
        {person.name.maidenName && (
          <Text type="secondary">Девичья фамилия: {person.name.maidenName}</Text>
        )}
        
        <Space direction="vertical" size="small" style={{ width: '100%', marginTop: 8 }}>
          {person.birth && (
            <div>
              <Text strong>Рождение: </Text>
              <Text>
                {formatDate(person.birth.date)}
                {person.birth.place && `, ${person.birth.place.original}`}
              </Text>
            </div>
          )}
          
          {person.death && (
            <div>
              <Text strong>Смерть: </Text>
              <Text>
                {formatDate(person.death.date)}
                {person.death.place && `, ${person.death.place.original}`}
              </Text>
            </div>
          )}
          
          {person.burial && (
            <div>
              <Text strong>Захоронение: </Text>
              <Text>{person.burial.place?.original}</Text>
            </div>
          )}
          
          {person.occupation && (
            <div>
              <Text strong>Занятие: </Text>
              <Text>{person.occupation}</Text>
            </div>
          )}
          
          {person.name.suffix && (
            <div>
              <Text strong>Звание/титул: </Text>
              <Text>{person.name.suffix}</Text>
            </div>
          )}
        </Space>
      </div>
      
      {/* Родственники */}
      <Collapse ghost className={styles.relatives}>
        {relatives.parents.length > 0 && (
          <Panel header={`Родители (${relatives.parents.length})`} key="parents">
            {relatives.parents.map(p => (
              <div key={p.id} className={styles.relativeName}>{p.name.fullName}</div>
            ))}
          </Panel>
        )}
        
        {relatives.spouses.length > 0 && (
          <Panel header={`Супруги (${relatives.spouses.length})`} key="spouses">
            {relatives.spouses.map(p => (
              <div key={p.id} className={styles.relativeName}>{p.name.fullName}</div>
            ))}
          </Panel>
        )}
        
        {relatives.children.length > 0 && (
          <Panel header={`Дети (${relatives.children.length})`} key="children">
            {relatives.children.map(p => (
              <div key={p.id} className={styles.relativeName}>{p.name.fullName}</div>
            ))}
          </Panel>
        )}
        
        {relatives.siblings.length > 0 && (
          <Panel header={`Братья/сёстры (${relatives.siblings.length})`} key="siblings">
            {relatives.siblings.map(p => (
              <div key={p.id} className={styles.relativeName}>{p.name.fullName}</div>
            ))}
          </Panel>
        )}
      </Collapse>
      
      <Divider />
      
      {/* Действия с человеком */}
      <div className={styles.section}>
        <Title level={5}>Действия</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            icon={<UserOutlined />}
            onClick={() => onSetRootPerson(person.id)}
            disabled={tree.settings.rootPersonId === person.id}
          >
            Сделать корнем дерева
          </Button>
          
          <Button
            block
            icon={<EyeInvisibleOutlined />}
            onClick={() => onHidePerson(person.id)}
          >
            Скрыть человека
          </Button>
          
          <Button
            block
            icon={<EyeInvisibleOutlined />}
            onClick={() => onHideBranch(person.id)}
          >
            Скрыть ветку от этого человека
          </Button>
        </Space>
      </div>
      
      <Divider />
      
      {/* Настройки карточки */}
      <div className={styles.section}>
        <Title level={5}>Настройки карточки</Title>
        
        <Form layout="vertical" className={styles.form}>
          <Form.Item label="Цвет фона">
            <ColorPicker
              value={settings.backgroundColor || '#ffffff'}
              onChange={(color) => updateDisplaySettings({ backgroundColor: color.toHexString() })}
            />
          </Form.Item>
          
          <Form.Item label="Скругление углов">
            <Select
              value={settings.borderRadius || 'medium'}
              onChange={(value) => updateDisplaySettings({ borderRadius: value })}
            >
              <Select.Option value="none">Без скругления</Select.Option>
              <Select.Option value="small">Маленькое</Select.Option>
              <Select.Option value="medium">Среднее</Select.Option>
              <Select.Option value="large">Большое</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item label="Стиль рамки">
            <Select
              value={settings.borderStyle || 'solid'}
              onChange={(value) => updateDisplaySettings({ borderStyle: value })}
            >
              <Select.Option value="none">Без рамки</Select.Option>
              <Select.Option value="solid">Сплошная</Select.Option>
              <Select.Option value="dashed">Пунктирная</Select.Option>
              <Select.Option value="double">Двойная</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item label="Цвет рамки">
            <ColorPicker
              value={settings.borderColor || '#d9d9d9'}
              onChange={(color) => updateDisplaySettings({ borderColor: color.toHexString() })}
            />
          </Form.Item>
          
          <Form.Item label="Толщина рамки">
            <Slider
              min={0}
              max={5}
              value={settings.borderWidth ?? 1}
              onChange={(value) => updateDisplaySettings({ borderWidth: value })}
            />
          </Form.Item>
          
          <Form.Item label="Смещение по горизонтали">
            <Slider
              min={-200}
              max={200}
              value={settings.customPosition?.offsetX || 0}
              onChange={(value) => updateDisplaySettings({
                customPosition: {
                  offsetX: value,
                  offsetY: 0,
                },
              })}
            />
          </Form.Item>
        </Form>
      </div>
    </Drawer>
  );
};

export default PersonPanel;
