import React, { useState, useEffect } from "react";
import "./Modal.css";

export default function Modal() {
  const [modal, setModal] = useState(true); // 🔄 default to true (auto-open)

  const toggleModal = () => {
    setModal(!modal);
  };

  useEffect(() => {
    // Automatically handle body class on mount
    if (modal) {
      document.body.classList.add("active-modal");
    } else {
      document.body.classList.remove("active-modal");
    }
  }, [modal]);

  return (
    <>
      {modal && (
        <div className="modal">
          <div onClick={toggleModal} className="overlay"></div>
          <div className="modal-content">
            <h2>⏳ You Have Only 5 Minutes on This Page</h2>
            <p>Please follow these steps to complete your experiment:</p>
              <ol>
                <li>
                  Ensure the stream at the bottom is working. (It may take up to 30 seconds.)
                </li>
                <li>
                  If the stream doesn't appear or load properly after 30 seconds,<strong> try refreshing the page.</strong>
                </li>
                <li>
                  Enter your desired parameters and setpoints, then click <strong>Tune & Start</strong>.
                </li>
                <li>
                  Alternatively, you can use <strong>Use our PID Values</strong> button to load our PID parameters immediately.
                </li>
                <li>
                  After each time you send parameters, both buttons will be <strong>temporarily disabled for 20 seconds</strong> before allowing another submission.
                </li>
                <li>
                  Observe the real-time data and graphs while watching the live stream of the experiment (with a slight delay).
                </li>
                <li>
                  After 5 minutes, you will be automatically redirected to your <strong>Progress Page</strong> where you can view and export your past runs.
                </li>
              </ol>
            {/* <button className="close-modal" onClick={toggleModal}>
              CLOSE
            </button> */}
          </div>
        </div>
      )}
    </>
  );
}
