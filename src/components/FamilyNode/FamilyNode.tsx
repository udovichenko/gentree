// Невидимый узел семьи (точка соединения между супругами и детьми)
import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import styles from './FamilyNode.module.scss';

interface FamilyNodeData {}

const FamilyNode: React.FC<NodeProps<FamilyNodeData>> = () => {
  return (
    <div className={styles.familyNode}>
      {/* Handle для входящей линии от левого супруга */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={styles.handle}
      />
      
      {/* Handle для исходящей линии к правому супругу */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={styles.handle}
      />
      
      {/* Handle для исходящих линий к детям */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={styles.handle}
      />
    </div>
  );
};

export default memo(FamilyNode);
