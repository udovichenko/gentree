// Верхняя панель инструментов
import React, { useRef } from 'react';
import { Button, Space, Dropdown, message, Tooltip, Typography, Modal, Slider, Form } from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  CameraOutlined,
  SettingOutlined,
  FileOutlined,
  PlusOutlined,
  UndoOutlined,
  RedoOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { FamilyTree } from '../../types';
import { parseGedcom, exportToGedcom } from '../../utils/gedcomParser';
import { exportToJson, importFromJson, storage } from '../../utils/storage';
import { exportTreeToPng } from '../../utils/exportUtils';
import styles from './Toolbar.module.scss';

const { Text } = Typography;

interface ToolbarProps {
  tree: FamilyTree | null;
  onTreeLoad: (tree: FamilyTree) => void;
  onNewTree: () => void;
  onSettingsOpen: () => void;
  onPersonPanelOpen: () => void;
  treeContainerRef: React.RefObject<HTMLDivElement | null>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  tree,
  onTreeLoad,
  onNewTree,
  onSettingsOpen,
  onPersonPanelOpen,
  treeContainerRef,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportModalOpen, setExportModalOpen] = React.useState(false);
  const [exportScale, setExportScale] = React.useState(2);
  
  // Импорт файла
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const content = await file.text();
      let newTree: FamilyTree;
      
      if (file.name.endsWith('.ged')) {
        newTree = parseGedcom(content);
        newTree.name = file.name.replace('.ged', '');
      } else if (file.name.endsWith('.json')) {
        newTree = importFromJson(content);
      } else {
        message.error('Неподдерживаемый формат файла. Используйте .ged или .json');
        return;
      }
      
      // Сохраняем в хранилище
      await storage.saveTree(newTree);
      onTreeLoad(newTree);
      
      message.success(`Загружено: ${newTree.persons.size} человек, ${newTree.families.size} семей`);
    } catch (error) {
      console.error('Error loading file:', error);
      message.error('Ошибка при загрузке файла');
    }
    
    // Сбрасываем input
    event.target.value = '';
  };
  
  // Экспорт в GEDCOM
  const handleExportGedcom = () => {
    if (!tree) return;
    
    const content = exportToGedcom(tree);
    downloadFile(content, `${tree.name}.ged`, 'text/plain');
    message.success('Файл GEDCOM сохранён');
  };
  
  // Экспорт в JSON
  const handleExportJson = () => {
    if (!tree) return;
    
    const content = exportToJson(tree);
    downloadFile(content, `${tree.name}.json`, 'application/json');
    message.success('Файл JSON сохранён');
  };
  
  // Экспорт в PNG
  const handleExportPng = async () => {
    if (!tree || !treeContainerRef.current) return;
    
    try {
      const flowElement = treeContainerRef.current.querySelector('.react-flow') as HTMLElement;
      if (!flowElement) {
        message.error('Не удалось найти элемент дерева');
        return;
      }
      
      const dataUrl = await exportTreeToPng(flowElement, { scale: exportScale });
      
      // Скачиваем
      const link = document.createElement('a');
      link.download = `${tree.name}.png`;
      link.href = dataUrl;
      link.click();
      
      message.success('Изображение сохранено');
      setExportModalOpen(false);
    } catch (error) {
      console.error('Error exporting PNG:', error);
      message.error('Ошибка при экспорте изображения');
    }
  };
  
  // Вспомогательная функция для скачивания файла
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  // Меню экспорта
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'gedcom',
      label: 'Экспорт в GEDCOM (.ged)',
      icon: <FileOutlined />,
      onClick: handleExportGedcom,
    },
    {
      key: 'json',
      label: 'Экспорт в JSON',
      icon: <FileOutlined />,
      onClick: handleExportJson,
    },
    {
      key: 'png',
      label: 'Экспорт в PNG',
      icon: <CameraOutlined />,
      onClick: () => setExportModalOpen(true),
    },
  ];
  
  return (
    <div className={styles.toolbar}>
      <Space>
        <Tooltip title="Создать новое дерево">
          <Button icon={<PlusOutlined />} onClick={onNewTree}>
            Новое
          </Button>
        </Tooltip>
        
        <Tooltip title="Импортировать GEDCOM или JSON">
          <Button 
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
          >
            Импорт
          </Button>
        </Tooltip>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".ged,.json"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <Dropdown menu={{ items: exportMenuItems }} disabled={!tree}>
          <Button icon={<DownloadOutlined />}>
            Экспорт
          </Button>
        </Dropdown>
        
        <div className={styles.divider} />
        
        <Tooltip title="Отменить (Ctrl+Z)">
          <Button 
            icon={<UndoOutlined />} 
            onClick={onUndo}
            disabled={!canUndo}
          />
        </Tooltip>
        
        <Tooltip title="Повторить (Ctrl+Shift+Z)">
          <Button 
            icon={<RedoOutlined />} 
            onClick={onRedo}
            disabled={!canRedo}
          />
        </Tooltip>
      </Space>
      
      <div className={styles.title}>
        {tree ? (
          <>
            <Text strong>{tree.name}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              ({tree.persons.size} человек)
            </Text>
          </>
        ) : (
          <Text type="secondary">Загрузите или создайте дерево</Text>
        )}
      </div>
      
      <Space>
        <Tooltip title="Информация о человеке">
          <Button 
            icon={<UserOutlined />} 
            onClick={onPersonPanelOpen}
            disabled={!tree}
          />
        </Tooltip>
        
        <Tooltip title="Настройки дерева">
          <Button 
            icon={<SettingOutlined />} 
            onClick={onSettingsOpen}
            disabled={!tree}
          />
        </Tooltip>
      </Space>
      
      {/* Модальное окно экспорта PNG */}
      <Modal
        title="Экспорт в PNG"
        open={exportModalOpen}
        onOk={handleExportPng}
        onCancel={() => setExportModalOpen(false)}
        okText="Экспортировать"
        cancelText="Отмена"
      >
        <Form layout="vertical">
          <Form.Item label="Масштаб (качество изображения)">
            <Slider
              min={1}
              max={4}
              step={0.5}
              value={exportScale}
              onChange={setExportScale}
              marks={{
                1: '1x',
                2: '2x',
                3: '3x',
                4: '4x',
              }}
            />
            <Text type="secondary">
              Больший масштаб = выше качество и размер файла
            </Text>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Toolbar;
