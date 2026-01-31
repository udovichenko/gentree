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
        
        <Form.Item label="Показывать фото в карточках">
          <Switch
            checked={settings.showPhotos}
            onChange={(checked) => onSettingsUpdate({ showPhotos: checked })}
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
