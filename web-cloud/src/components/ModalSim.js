import React, { useState, useEffect } from "react";
import "./Modal2.css";

export default function Modal() {
  const [modalVisible, setModalVisible] = useState(true);

  const closeModal = () => {
    setModalVisible(false);
  };

  useEffect(() => {
    document.body.classList.toggle("active-modal", modalVisible);
    return () => document.body.classList.remove("active-modal");
  }, [modalVisible]);

  return (
    <>
      {modalVisible && (
        <div className="modal">
          <div className="overlay" onClick={closeModal}></div>
          <div className="modal-content">
            <h2>🧪 Simulation Mode - Quick Guide</h2>

            <ol>
              <li>Enter your <strong>parameters</strong>, then click <strong>Start Simulation</strong>.</li>
              <li>Observe the <strong>3D simulation view</strong> and monitor the graphs in real time.</li>
              <li>Click <strong>Stop Simulation</strong> before leaving (skipping this may freeze the page on reload)</li>
            </ol>
          </div>

        </div>
      )}
    </>
  );
}
