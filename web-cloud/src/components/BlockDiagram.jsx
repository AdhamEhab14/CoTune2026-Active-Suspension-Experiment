import { useState } from 'react';
import './BlockDiagram.css';

// Block Component
function Block({ x, y, label, value, onChange }) {
  return (
    <g>
      {/* Block Rectangle */}
      <rect
        x={x}
        y={y}
        width="120"
        height="60"
        fill="#e0f7fa"
        stroke="#0288d1"
        strokeWidth="2"
        rx="5"
      />
      {/* Label Text */}
      <text
        x={x + 60}
        y={y + 20}
        textAnchor="middle"
        fill="#000"
        fontSize="14"
        fontFamily="Arial"
      >
        {label}
      </text>
      {/* Input Field via foreignObject */}
      <foreignObject x={x + 10} y={y + 30} width="100" height="20">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block-input"
          placeholder="Enter value"
        />
      </foreignObject>
    </g>
  );
}

// Arrow Component
function Arrow({ startX, startY, endX, endY }) {
  const midX = startX + (endX - startX) * 0.5;
  return (
    <g>
      <path
        d={`M${startX},${startY} H${midX} V${endY} H${endX}`}
        stroke="#0288d1"
        strokeWidth="2"
        fill="none"
      />
      <polygon
        points={`${endX},${endY} ${endX - 8},${endY - 5} ${endX - 8},${endY + 5}`}
        fill="#0288d1"
      />
    </g>
  );
}

// BlockDiagram Component
function BlockDiagram({ blocks, arrows, onInputChange }) {
  return (
    <div className="block-diagram-container">
      <svg width="600" height="400" className="block-diagram-svg">
        {blocks.map((block, index) => (
          <Block
            key={`block-${index}`}
            x={block.x}
            y={block.y}
            label={block.label}
            value={block.value || ''}
            onChange={(value) => onInputChange(index, value)}
          />
        ))}
        {arrows.map((arrow, index) => (
          <Arrow
            key={`arrow-${index}`}
            startX={arrow.startX}
            startY={arrow.startY}
            endX={arrow.endX}
            endY={arrow.endY}
          />
        ))}
      </svg>
    </div>
  );
}

export default BlockDiagram;