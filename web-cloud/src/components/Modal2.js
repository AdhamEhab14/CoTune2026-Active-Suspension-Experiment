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
            <h2>⏳ You Have 5 Minutes for This Experiment!</h2>
            <p>Please follow these steps to complete your experiment:</p>


              <ol>
                <li>
                  Ensure the stream at the bottom is working. (It may take up to 30 seconds.)
                </li>
                <li>
                  If the stream doesn't appear or load properly after 30 seconds, <strong>try refreshing the page.</strong>
                </li>
                <li>
                  Enter your desired parameters and setpoints, then click <strong>Tune & Start</strong>.
                </li>
                <li>
                  Alternatively, you can use <strong>Use our LQR Values</strong> button to load our LQR parameters immediately.
                </li>
                <li>
                  The full run lasts 90 seconds so each time you send parameters, both buttons will be <strong>temporarily disabled for 90 seconds</strong> before allowing another submission.
                </li>
                <li>
                  Observe the real-time data and graphs while watching the live stream of the experiment (with a slight delay).
                </li>
                <li>
                  After 5 minutes, you will be automatically redirected to your <strong>Progress Page</strong> where you can view and export your past runs.
                </li>
              </ol>


            {/* <p>🚨 <strong>Note:</strong> You only get <strong>ONE</strong> run per session. Use it wisely!</p> */}

            {/* <button className="close-modal" onClick={closeModal}>
              ✖
            </button> */}
          </div>
        </div>
      )}
    </>
  );
}
