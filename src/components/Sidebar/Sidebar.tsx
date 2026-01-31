// Боковая панель с информацией о человеке и настройками
import React, { useState } from 'react';
import {
  Drawer,
  Tabs,
  Form,
  Select,
  ColorPicker,
  Slider,
  Button,
  Divider,
  Typography,
  Space,
  Switch,
  Collapse,
} from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import type { Person, FamilyTree, PersonDisplaySettings } from '../../types';
import { formatDate } from '../../utils/treeUtils';
import styles from './Sidebar.module.scss';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface SidebarProps {
  open: boolean;
  person: Person | null;
  tree: FamilyTree;
  onClose: () => void;
  onPersonUpdate: (person: Person) => void;
  onTreeSettingsUpdate: (settings: Partial<FamilyTree['settings']>) => void;
  onSetRootPerson: (personId: string | undefined) => void;
  onHidePerson: (personId: string) => void;
  onHideBranch: (personId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  open,
  person,
  tree,
  onClose,
  onPersonUpdate,
  onTreeSettingsUpdate,
  onSetRootPerson,
  onHidePerson,
  onHideBranch,
}) => {
  const [activeTab, setActiveTab] = useState('info');
  
  // Получение связанных людей
  const getRelatives = () => {
    if (!person) return { parents: [], spouses: [], children: [], siblings: [] };
    
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
    if (!person) return;
    onPersonUpdate({
      ...person,
      displaySettings: {
        ...person.displaySettings,
        ...updates,
      },
    });
  };
  
  const renderPersonInfo = () => {
    if (!person) return <Text type="secondary">Выберите человека для просмотра информации</Text>;
    
    return (
      <div className={styles.personInfo}>
        <Title level={4}>{person.name.fullName}</Title>
        
        {person.name.maidenName && (
          <Text type="secondary">Девичья фамилия: {person.name.maidenName}</Text>
        )}
        
        <Divider />
        
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
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
              <Text>
                {person.burial.place?.original}
              </Text>
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
    );
  };
  
  const renderCardSettings = () => {
    if (!person) return <Text type="secondary">Выберите человека для настройки карточки</Text>;
    
    const settings = person.displaySettings || {};
    
    return (
      <Form layout="vertical" className={styles.settingsForm}>
        <Form.Item label="Цвет фона карточки">
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
        
        <Form.Item label="Смещение по X">
          <Slider
            min={-200}
            max={200}
            value={settings.customPosition?.offsetX || 0}
            onChange={(value) => updateDisplaySettings({
              customPosition: {
                offsetX: value,
                offsetY: settings.customPosition?.offsetY || 0,
              },
            })}
          />
        </Form.Item>
        
        <Form.Item label="Смещение по Y">
          <Slider
            min={-100}
            max={100}
            value={settings.customPosition?.offsetY || 0}
            onChange={(value) => updateDisplaySettings({
              customPosition: {
                offsetX: settings.customPosition?.offsetX || 0,
                offsetY: value,
              },
            })}
          />
        </Form.Item>
      </Form>
    );
  };
  
  const renderTreeSettings = () => {
    const { settings } = tree;
    
    // Список всех людей для выбора корня
    const personOptions = Array.from(tree.persons.values()).map(p => ({
      value: p.id,
      label: p.name.fullName,
    }));
    
    return (
      <Form layout="vertical" className={styles.settingsForm}>
        <Form.Item label="Корень дерева (от кого строить)">
          <Select
            value={settings.rootPersonId}
            onChange={(value) => onTreeSettingsUpdate({ rootPersonId: value })}
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={personOptions}
            placeholder="Показать всех"
          />
        </Form.Item>
        
        <Form.Item label="Показывать только прямых предков">
          <Switch
            checked={settings.showOnlyDirectAncestors}
            onChange={(checked) => onTreeSettingsUpdate({ showOnlyDirectAncestors: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Показывать братьев/сестёр">
          <Switch
            checked={settings.showSiblings}
            onChange={(checked) => onTreeSettingsUpdate({ showSiblings: checked })}
          />
        </Form.Item>
        
        <Divider>Отображение карточек</Divider>
        
        <Form.Item label="Ширина карточки">
          <Slider
            min={150}
            max={300}
            value={settings.cardWidth ?? 200}
            onChange={(value) => onTreeSettingsUpdate({ cardWidth: value })}
            marks={{ 150: '150', 200: '200', 250: '250', 300: '300' }}
          />
        </Form.Item>
        
        <Form.Item label="Показывать фото">
          <Switch
            checked={settings.showPhotos}
            onChange={(checked) => onTreeSettingsUpdate({ showPhotos: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Показывать место рождения">
          <Switch
            checked={settings.showBirthPlace ?? true}
            onChange={(checked) => onTreeSettingsUpdate({ showBirthPlace: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Показывать кем приходится">
          <Switch
            checked={settings.showRelationship ?? true}
            onChange={(checked) => onTreeSettingsUpdate({ showRelationship: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Полные даты (не только год)">
          <Switch
            checked={settings.showFullDates ?? false}
            onChange={(checked) => onTreeSettingsUpdate({ showFullDates: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Скрыть отчества">
          <Switch
            checked={settings.hidePatronymic ?? false}
            onChange={(checked) => onTreeSettingsUpdate({ hidePatronymic: checked })}
          />
        </Form.Item>
        
        <Divider>Визуальные настройки</Divider>
        
        <Form.Item label="Цвет фона дерева">
          <ColorPicker
            value={settings.backgroundColor || '#f5f5f5'}
            onChange={(color) => onTreeSettingsUpdate({ backgroundColor: color.toHexString() })}
          />
        </Form.Item>
        
        <Form.Item label="Цвет линий">
          <ColorPicker
            value={settings.lineColor || '#8c8c8c'}
            onChange={(color) => onTreeSettingsUpdate({ lineColor: color.toHexString() })}
          />
        </Form.Item>
        
        <Form.Item label="Толщина линий">
          <Slider
            min={1}
            max={5}
            value={settings.lineWidth || 2}
            onChange={(value) => onTreeSettingsUpdate({ lineWidth: value })}
          />
        </Form.Item>
        
        {settings.hiddenPersonIds.length > 0 && (
          <Form.Item label="Скрытые люди">
            <Button
              size="small"
              onClick={() => onTreeSettingsUpdate({ hiddenPersonIds: [] })}
            >
              Показать всех ({settings.hiddenPersonIds.length})
            </Button>
          </Form.Item>
        )}
        
        {settings.hiddenBranchFromIds.length > 0 && (
          <Form.Item label="Скрытые ветки">
            <Button
              size="small"
              onClick={() => onTreeSettingsUpdate({ hiddenBranchFromIds: [] })}
            >
              Показать все ветки ({settings.hiddenBranchFromIds.length})
            </Button>
          </Form.Item>
        )}
      </Form>
    );
  };
  
  const tabItems = [
    {
      key: 'info',
      label: (
        <span>
          <UserOutlined />
          Информация
        </span>
      ),
      children: renderPersonInfo(),
    },
    {
      key: 'card',
      label: (
        <span>
          <SettingOutlined />
          Карточка
        </span>
      ),
      children: renderCardSettings(),
    },
    {
      key: 'tree',
      label: (
        <span>
          <EyeOutlined />
          Дерево
        </span>
      ),
      children: renderTreeSettings(),
    },
  ];
  
  return (
    <Drawer
      title={person ? person.name.fullName : 'Настройки'}
      placement="right"
      width={360}
      onClose={onClose}
      open={open}
      className={styles.drawer}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </Drawer>
  );
};

export default Sidebar;
