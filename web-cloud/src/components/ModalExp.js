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
            <h2>⏳ Live Mode (5min) - Quick Guide</h2>

              <ol>
                <li>Wait for the stream to load (up to 30s). If it fails, <strong>refresh the page.</strong></li>
                <li>Enter parameters and click <strong>Start Live</strong>, or use <strong>Use Recommended Parameters</strong> to load defaults.</li>
                <li>Each submission <strong>disables buttons for 30s</strong> (full run duration).</li>
                <li>Watch the live stream and real-time graphs (slight delay expected).</li>
                <li>After 5 min you'll be redirected to your <strong>Progress Page</strong> to view & export runs.</li>
              </ol>

          </div>
        </div>
      )}
    </>
  );
}
