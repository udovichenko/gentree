// Главный компонент приложения
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, ConfigProvider, Empty, Spin, message } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import type { FamilyTree, Person, TreeSettings } from './types';
import { storage } from './utils/storage';
import { useHistory } from './hooks';
import { FamilyTreeView } from './components/FamilyTreeView';
import { TreeSettingsPanel } from './components/TreeSettingsPanel';
import { PersonPanel } from './components/PersonPanel';
import { Toolbar } from './components/Toolbar';
import './styles/global.scss';
import styles from './App.module.scss';

const { Content } = Layout;

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [treeSettingsOpen, setTreeSettingsOpen] = useState(false);
  const [personPanelOpen, setPersonPanelOpen] = useState(false);
  
  const treeContainerRef = useRef<HTMLDivElement>(null);
  
  // История изменений
  const {
    state: tree,
    setState: setTree,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
  } = useHistory<FamilyTree | null>(null);
  
  // Загрузка дерева при старте
  useEffect(() => {
    const loadTrees = async () => {
      try {
        const trees = await storage.getAllTrees();
        if (trees.length > 0) {
          // Загружаем последнее дерево
          const latestTree = trees.sort((a, b) => 
            b.updatedAt.getTime() - a.updatedAt.getTime()
          )[0];
          resetHistory(latestTree);
        }
      } catch (error) {
        console.error('Error loading trees:', error);
        message.error('Ошибка при загрузке данных');
      } finally {
        setLoading(false);
      }
    };
    
    loadTrees();
  }, [resetHistory]);
  
  // Сохранение при изменениях
  useEffect(() => {
    if (tree) {
      storage.saveTree(tree).catch(console.error);
    }
  }, [tree]);
  
  // Создание нового дерева
  const handleNewTree = useCallback(() => {
    const newTree = storage.createEmptyTree('Новое дерево');
    resetHistory(newTree);
    setSelectedPerson(null);
    message.success('Создано новое дерево');
  }, [resetHistory]);
  
  // Загрузка дерева
  const handleTreeLoad = useCallback((loadedTree: FamilyTree) => {
    resetHistory(loadedTree);
    setSelectedPerson(null);
  }, [resetHistory]);
  
  // Выбор человека
  const handlePersonSelect = useCallback((person: Person | null) => {
    setSelectedPerson(person);
    if (person) {
      setPersonPanelOpen(true);
    }
  }, []);
  
  // Обновление человека (с добавлением в историю)
  const handlePersonUpdate = useCallback((updatedPerson: Person) => {
    if (!tree) return;
    
    const newPersons = new Map(tree.persons);
    newPersons.set(updatedPerson.id, updatedPerson);
    
    setTree({
      ...tree,
      persons: newPersons,
      updatedAt: new Date(),
    });
    
    setSelectedPerson(updatedPerson);
  }, [tree, setTree]);
  
  // Перемещение людей (нескольких сразу) - только по горизонтали
  const handlePersonsMove = useCallback((moves: Array<{ personId: string; offsetX: number }>) => {
    if (!tree) return;
    
    const newPersons = new Map(tree.persons);
    
    for (const { personId, offsetX } of moves) {
      const person = newPersons.get(personId);
      if (person) {
        newPersons.set(personId, {
          ...person,
          displaySettings: {
            ...person.displaySettings,
            customPosition: {
              offsetX: offsetX,
              offsetY: 0,
            },
          },
        });
      }
    }
    
    setTree({
      ...tree,
      persons: newPersons,
      updatedAt: new Date(),
    });
  }, [tree, setTree]);
  
  // Обновление настроек дерева (с добавлением в историю)
  const handleTreeSettingsUpdate = useCallback((updates: Partial<TreeSettings>) => {
    if (!tree) return;
    
    setTree({
      ...tree,
      settings: {
        ...tree.settings,
        ...updates,
      },
      updatedAt: new Date(),
    });
  }, [tree, setTree]);
  
  // Установка корневого человека
  const handleSetRootPerson = useCallback((personId: string) => {
    handleTreeSettingsUpdate({ rootPersonId: personId });
    message.success('Корень дерева изменён');
  }, [handleTreeSettingsUpdate]);
  
  // Скрытие человека
  const handleHidePerson = useCallback((personId: string) => {
    if (!tree) return;
    
    const newHidden = [...tree.settings.hiddenPersonIds];
    if (!newHidden.includes(personId)) {
      newHidden.push(personId);
      handleTreeSettingsUpdate({ hiddenPersonIds: newHidden });
      message.success('Человек скрыт');
      setSelectedPerson(null);
      setPersonPanelOpen(false);
    }
  }, [tree, handleTreeSettingsUpdate]);
  
  // Скрытие ветки
  const handleHideBranch = useCallback((personId: string) => {
    if (!tree) return;
    
    const newHidden = [...tree.settings.hiddenBranchFromIds];
    if (!newHidden.includes(personId)) {
      newHidden.push(personId);
      handleTreeSettingsUpdate({ hiddenBranchFromIds: newHidden });
      message.success('Ветка скрыта');
    }
  }, [tree, handleTreeSettingsUpdate]);
  
  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    );
  }
  
  return (
    <ConfigProvider locale={ruRU}>
      <Layout className={styles.layout}>
        <Toolbar
          tree={tree}
          onTreeLoad={handleTreeLoad}
          onNewTree={handleNewTree}
          onSettingsOpen={() => setTreeSettingsOpen(true)}
          onPersonPanelOpen={() => setPersonPanelOpen(true)}
          treeContainerRef={treeContainerRef}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />
        
        <Content className={styles.content}>
          {tree ? (
            <div ref={treeContainerRef} className={styles.treeContainer}>
              <FamilyTreeView
                tree={tree}
                onPersonSelect={handlePersonSelect}
                onPersonsMove={handlePersonsMove}
              />
            </div>
          ) : (
            <div className={styles.empty}>
              <Empty
                description="Нет загруженного дерева"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <p>Импортируйте файл GEDCOM или создайте новое дерево</p>
              </Empty>
            </div>
          )}
        </Content>
        
        {tree && (
          <>
            <TreeSettingsPanel
              open={treeSettingsOpen}
              tree={tree}
              onClose={() => setTreeSettingsOpen(false)}
              onSettingsUpdate={handleTreeSettingsUpdate}
            />
            
            <PersonPanel
              open={personPanelOpen}
              person={selectedPerson}
              tree={tree}
              onClose={() => setPersonPanelOpen(false)}
              onPersonUpdate={handlePersonUpdate}
              onSetRootPerson={handleSetRootPerson}
              onHidePerson={handleHidePerson}
              onHideBranch={handleHideBranch}
            />
          </>
        )}
      </Layout>
    </ConfigProvider>
  );
};

export default App;
