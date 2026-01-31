// Панель настроек дерева
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
  Switch,
  InputNumber,
} from 'antd';
import type { FamilyTree, TreeSettings } from '../../types';
import styles from './TreeSettingsPanel.module.scss';

const { Text } = Typography;

interface TreeSettingsPanelProps {
  open: boolean;
  tree: FamilyTree;
  onClose: () => void;
  onSettingsUpdate: (settings: Partial<TreeSettings>) => void;
}

const TreeSettingsPanel: React.FC<TreeSettingsPanelProps> = ({
  open,
  tree,
  onClose,
  onSettingsUpdate,
}) => {
  const { settings } = tree;
  
  // Список всех людей для выбора корня
  const personOptions = Array.from(tree.persons.values()).map(p => ({
    value: p.id,
    label: p.name.fullName,
  }));
  
  return (
    <Drawer
      title="Настройки дерева"
      placement="right"
      width={360}
      onClose={onClose}
      open={open}
      className={styles.drawer}
    >
      <Form layout="vertical" className={styles.form}>
        <Divider>Отображение</Divider>
        
        <Form.Item label="Корень дерева (от кого строить)">
          <Select
            value={settings.rootPersonId}
            onChange={(value) => onSettingsUpdate({ rootPersonId: value })}
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
            onChange={(checked) => onSettingsUpdate({ showOnlyDirectAncestors: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Показывать братьев/сестёр">
          <Switch
            checked={settings.showSiblings}
            onChange={(checked) => onSettingsUpdate({ showSiblings: checked })}
          />
        </Form.Item>
        
        <Divider>Отображение карточек</Divider>
        
        <Form.Item label="Ширина карточки (px)">
          <InputNumber
            min={150}
            max={300}
            value={settings.cardWidth ?? 200}
            onChange={(value) => onSettingsUpdate({ cardWidth: value ?? 200 })}
            style={{ width: '100%' }}
          />
        </Form.Item>
        
        <Form.Item label="Показывать фото">
          <Switch
            checked={settings.showPhotos}
            onChange={(checked) => onSettingsUpdate({ showPhotos: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Показывать место рождения">
          <Switch
            checked={settings.showBirthPlace ?? true}
            onChange={(checked) => onSettingsUpdate({ showBirthPlace: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Показывать кем приходится корню">
          <Switch
            checked={settings.showRelationship ?? true}
            onChange={(checked) => onSettingsUpdate({ showRelationship: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Полные даты (не только год)">
          <Switch
            checked={settings.showFullDates ?? false}
            onChange={(checked) => onSettingsUpdate({ showFullDates: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Скрыть отчества у всех">
          <Switch
            checked={settings.hidePatronymic ?? false}
            onChange={(checked) => onSettingsUpdate({ hidePatronymic: checked })}
          />
        </Form.Item>
        
        <Form.Item label="Показывать девичью фамилию">
          <Switch
            checked={settings.showMaidenName ?? true}
            onChange={(checked) => onSettingsUpdate({ showMaidenName: checked })}
          />
        </Form.Item>
        
        <Divider>Стиль рамки карточек</Divider>
        
        <Form.Item label="Скругление углов">
          <Select
            value={settings.cardBorderRadius ?? 'medium'}
            onChange={(value) => onSettingsUpdate({ cardBorderRadius: value })}
            options={[
              { value: 'none', label: 'Без скругления' },
              { value: 'small', label: 'Маленькое (4px)' },
              { value: 'medium', label: 'Среднее (8px)' },
              { value: 'large', label: 'Большое (16px)' },
            ]}
          />
        </Form.Item>
        
        <Form.Item label="Стиль рамки">
          <Select
            value={settings.cardBorderStyle ?? 'solid'}
            onChange={(value) => onSettingsUpdate({ cardBorderStyle: value })}
            options={[
              { value: 'none', label: 'Без рамки' },
              { value: 'solid', label: 'Сплошная' },
              { value: 'dashed', label: 'Пунктирная' },
              { value: 'dotted', label: 'Точечная' },
            ]}
          />
        </Form.Item>
        
        <Form.Item label="Цвет рамки">
          <ColorPicker
            value={settings.cardBorderColor || '#d9d9d9'}
            onChange={(color) => onSettingsUpdate({ cardBorderColor: color.toHexString() })}
          />
        </Form.Item>
        
        <Form.Item label="Толщина рамки">
          <InputNumber
            min={0}
            max={5}
            value={settings.cardBorderWidth ?? 1}
            onChange={(value) => onSettingsUpdate({ cardBorderWidth: value ?? 1 })}
            addonAfter="px"
            style={{ width: '100%' }}
          />
        </Form.Item>
        
        <Divider>Расстояния</Divider>
        
        <Form.Item label="Расстояние между поколениями (вертикаль)">
          <InputNumber
            min={50}
            max={400}
            value={settings.verticalSpacing}
            onChange={(value) => onSettingsUpdate({ verticalSpacing: value ?? 150 })}
            addonAfter="px"
            style={{ width: '100%' }}
          />
        </Form.Item>
        
        <Form.Item label="Расстояние между ветками (горизонталь)">
          <InputNumber
            min={20}
            max={200}
            value={settings.horizontalSpacing}
            onChange={(value) => onSettingsUpdate({ horizontalSpacing: value ?? 50 })}
            addonAfter="px"
            style={{ width: '100%' }}
          />
        </Form.Item>
        
        <Form.Item label="Расстояние между супругами">
          <InputNumber
            min={0}
            max={100}
            value={settings.spouseSpacing}
            onChange={(value) => onSettingsUpdate({ spouseSpacing: value ?? 20 })}
            addonAfter="px"
            style={{ width: '100%' }}
          />
        </Form.Item>
        
        <Divider>Визуальные настройки</Divider>
        
        <Form.Item label="Базовый цвет карточек (мужчины)">
          <ColorPicker
            value={settings.baseColorMale || '#e6f4ff'}
            onChange={(color) => onSettingsUpdate({ baseColorMale: color.toHexString() })}
          />
        </Form.Item>
        
        <Form.Item label="Базовый цвет карточек (женщины)">
          <ColorPicker
            value={settings.baseColorFemale || '#fff0f6'}
            onChange={(color) => onSettingsUpdate({ baseColorFemale: color.toHexString() })}
          />
        </Form.Item>
        
        <Form.Item label="Цвет фона дерева">
          <ColorPicker
            value={settings.backgroundColor || '#f5f5f5'}
            onChange={(color) => onSettingsUpdate({ backgroundColor: color.toHexString() })}
          />
        </Form.Item>
        
        <Form.Item label="Цвет линий">
          <ColorPicker
            value={settings.lineColor || '#8c8c8c'}
            onChange={(color) => onSettingsUpdate({ lineColor: color.toHexString() })}
          />
        </Form.Item>
        
        <Form.Item label="Толщина линий">
          <Slider
            min={1}
            max={5}
            value={settings.lineWidth || 2}
            onChange={(value) => onSettingsUpdate({ lineWidth: value })}
          />
        </Form.Item>
        
        <Divider>Скрытые элементы</Divider>
        
        {settings.hiddenPersonIds.length > 0 && (
          <Form.Item>
            <Button
              block
              onClick={() => onSettingsUpdate({ hiddenPersonIds: [] })}
            >
              Показать всех скрытых ({settings.hiddenPersonIds.length})
            </Button>
          </Form.Item>
        )}
        
        {settings.hiddenBranchFromIds.length > 0 && (
          <Form.Item>
            <Button
              block
              onClick={() => onSettingsUpdate({ hiddenBranchFromIds: [] })}
            >
              Показать все скрытые ветки ({settings.hiddenBranchFromIds.length})
            </Button>
          </Form.Item>
        )}
        
        {settings.hiddenPersonIds.length === 0 && settings.hiddenBranchFromIds.length === 0 && (
          <Text type="secondary">Нет скрытых элементов</Text>
        )}
      </Form>
    </Drawer>
  );
};

export default TreeSettingsPanel;
