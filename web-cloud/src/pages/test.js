import React, { useState } from "react";
import { lqrJS } from "../controllers/LQR/lqr_calc";

function App() {
  const [K, setK] = useState(null);

  const A = [
    [0, 1, 0, 0],
    [0, -1.96465757924125, -0.913494826736738	, 0.00856855198611895],
    [0, 0, 0, 1],
    [0, 6.40649210622148,34.9679179132720, -0.327997941221576]
  ];
  const B = [[0], [0.656922318935786], [0], [-2.14213799652974]];
  const Q = [
    [1000, 0, 0, 0],
    [0, 100, 0, 0],
    [0, 0, 500, 0],
    [0, 0, 0, 500]
  ];
  const R = [[0.2]];

  const compute = () => {
    try {
      const Kmat = lqrJS(A, B, Q, R);
      setK(Kmat);
    } catch (e) {
      console.error("LQR computation failed:", e.message);
      alert("Failed: " + e.message);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Frontend LQR via Hamiltonian</h1>
      <button onClick={compute}>Compute K</button>
      {K && (
        <div>
          <h3>Gain Matrix K:</h3>
          <pre>{JSON.stringify(K, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
