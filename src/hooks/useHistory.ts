// Хук для управления историей изменений (Undo/Redo)
import { useState, useCallback, useEffect } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryOptions {
  maxHistoryLength?: number;
}

export function useHistory<T>(
  initialState: T,
  options: UseHistoryOptions = {}
) {
  const { maxHistoryLength = 50 } = options;
  
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });
  
  // Обновить текущее состояние (добавить в историю)
  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory((prev) => {
      const nextState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(prev.present)
        : newState;
      
      // Не добавляем в историю если состояние не изменилось
      if (JSON.stringify(nextState) === JSON.stringify(prev.present)) {
        return prev;
      }
      
      const newPast = [...prev.past, prev.present];
      // Ограничиваем длину истории
      if (newPast.length > maxHistoryLength) {
        newPast.shift();
      }
      
      return {
        past: newPast,
        present: nextState,
        future: [], // Очищаем future при новом изменении
      };
    });
  }, [maxHistoryLength]);
  
  // Обновить без добавления в историю (для промежуточных состояний)
  const setStateWithoutHistory = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory((prev) => {
      const nextState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(prev.present)
        : newState;
      
      return {
        ...prev,
        present: nextState,
      };
    });
  }, []);
  
  // Отмена (Undo)
  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      
      const newPast = [...prev.past];
      const previousState = newPast.pop()!;
      
      return {
        past: newPast,
        present: previousState,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);
  
  // Повтор (Redo)
  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      
      const newFuture = [...prev.future];
      const nextState = newFuture.shift()!;
      
      return {
        past: [...prev.past, prev.present],
        present: nextState,
        future: newFuture,
      };
    });
  }, []);
  
  // Сброс истории с новым состоянием
  const reset = useCallback((newState: T) => {
    setHistory({
      past: [],
      present: newState,
      future: [],
    });
  }, []);
  
  // Глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
  
  return {
    state: history.present,
    setState,
    setStateWithoutHistory,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historyLength: history.past.length,
  };
}
