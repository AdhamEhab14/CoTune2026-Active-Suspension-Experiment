import { useState } from "react";
import { motion } from "framer-motion";

const AnimatedControl = () => {
  // Animation states
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [direction, setDirection] = useState(1);

  return (
    <div className="control-container">
      {/* Animated Box */}
      <motion.div
        className="animated-box"
        animate={{
          x: running ? [0, 100 * direction, -100 * direction, 0] : 0,
          rotate: running ? [0, 360, 0] : 0,
        }}
        transition={{ duration: 2 / speed, repeat: running ? Infinity : 0 }}
      />

      {/* Control Panel */}
      <div className="controls">
        <button onClick={() => setRunning(!running)}>
          {running ? "Pause" : "Start"}
        </button>
        <label>Speed: {speed}x</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
        />
        <button onClick={() => setDirection(direction * -1)}>Reverse</button>
      </div>
    </div>
  );
};

export default AnimatedControl;
