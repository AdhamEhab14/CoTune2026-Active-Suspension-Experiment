import React, { useState } from "react";
import "./learn1.css";
import { Link } from "react-router-dom";

const qaItems = [
  {
    question: "What is the difference between roll, pitch, and yaw?",
    answer:
      "Roll, pitch, and yaw are the three rotational degrees of freedom for any flying object, such as a quadrotor. Roll refers to the rotation about the longitudinal axis (front to back), causing the aircraft to tilt side to side. Pitch refers to the rotation about the lateral axis (left to right), causing the aircraft to tilt up or down. Yaw refers to the rotation about the vertical axis, causing the aircraft to rotate left or right horizontally. Together, these control the orientation of the quadrotor in 3D space.",
  },
  {
    question: "Why use a cascaded PID instead of a single PID?",
    answer:
      "A cascaded PID controller divides the control system into two loops: an outer loop and an inner loop. This approach improves precision and stability by addressing different dynamics in each loop. For example, the outer loop controls the desired pitch angle, while the inner loop controls the pitch angular velocity to achieve those angles. Using a single PID for both tasks would result in a slower response and might lead to instability, as the system cannot effectively handle varying time scales or dynamics.",
  },
  {
    question: "What are Kp, Ki, and Kd in PID control?",
    answer:
      "Kp, Ki, and Kd are the three gains in a PID (Proportional-Integral-Derivative) controller:\n• Kp: Determines the correction based on the current error. Higher Kp results in a faster response but can lead to overshooting.\n• Ki: Addresses cumulative error by integrating past errors over time. It eliminates steady-state errors but can cause oscillations if too high.\n• Kd: Predicts future error by considering the rate of change of the error. It helps reduce overshooting and improves stability.",
  },
  {
    question:
      "Why do we need to control angular position and angular velocity?",
    answer:
      "Controlling angular position (pitch or roll angle) ensures that the quadrotor achieves the desired orientation. Controlling angular velocity (pitch or roll rate) ensures that the quadrotor's movements are smooth and responsive. Combining these controls in a cascaded PID helps maintain precise and stable flight dynamics, as angular velocity is closely tied to the rate of orientation changes.",
  },
  {
    question: "What is a plant in control systems?",
    answer:
      "The plant refers to the physical system being controlled—in this case, the quadrotor. It includes the motors, propellers, frame, and the dynamics that describe how these components respond to inputs. Understanding the plant is crucial for designing an effective control system because the controller must compensate for the plant's behavior to achieve the desired performance.",
  },
  {
    question: "How do you tune a cascaded PID?",
    answer:
      "Tuning a cascaded PID involves optimizing the gains for both the inner and outer loops. Start by tuning the inner loop first ,as its performance directly affects the outer loop. Use trial and error, step responses, or techniques like Ziegler-Nichols to find stable Kp, Ki, and Kd values. Once the inner loop is stable, tune the outer loop gains to ensure smooth and accurate orientation tracking.",
  },
  {
    question: "How do you tune a double cascaded PID?",
    answer:
      "1. Inner-Inner Loop (pitch angular velocity): Tune the angular velocity control loop for stability and fast response.\n2. Outer-Inner Loop (roll angular velocity): Adjust the angular velocity control for roll, ensuring it interacts correctly with the pitch control.\n3. Inner-Outer Loop (pitch angle): Tune the pitch angle control for precise and stable orientation changes.\n4. Outer-Outer Loop (roll angle): Finalize the roll angle control to achieve a balanced response. Iteratively fine-tune all loops for smooth coordination.",
  },
  {
    question:
      "What are some advantages of using double cascaded PID for quadrotors?",
    answer:
      "Double cascaded PID controllers offer several advantages:\n• Enhanced stability due to separate handling of angles and angular velocities.\n• Faster response times, as each loop addresses a specific dynamic.\n• Improved robustness, allowing the quadrotor to handle external disturbances more effectively.\n• Precise control of orientation and rates, resulting in smoother flight performance.",
  },
  {
    question: "What are the challenges in tuning cascaded controllers?",
    answer:
      "• Interdependency between loops: Changes in one loop can affect the performance of the other.\n• Sensitivity to model inaccuracies: If the plant model is not accurate, tuning may be suboptimal.\n• Time-consuming process: Tuning multiple loops requires patience and careful observation.",
  },
  {
    question: "Can cascaded PID be used for other applications?",
    answer:
      "Yes, cascaded PID controllers are widely used in robotics, automotive systems, and industrial automation. For example, they can control robotic arms, temperature in multi-zone processes, or speed and torque in electric motors.",
  },
];

const QandA = () => {
  // State to track which question is open
  const [openIndex, setOpenIndex] = useState(null);

  // Toggle answer visibility
  const toggleAnswer = (index) => {
    if (openIndex === index) {
      setOpenIndex(null); // Close if the same question is clicked again
    } else {
      setOpenIndex(index); // Open the clicked question
    }
  };

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-4">Q&A </h1>
      <div>
        {qaItems.map((item, index) => (
          <div key={index} className="mb-4">
            <button
              onClick={() => toggleAnswer(index)}
              className="w-full text-left bg-gray-800 text-white p-4 rounded-lg"
            >
              <h2 className="text-xl">{item.question}</h2>
            </button>
            {openIndex === index && (
              <div className="p-4 bg-gray-700 text-white rounded-lg mt-2">
                <pre>{item.answer}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
      <Link to="/Pubsub">
        <button className="learnbtn">Start Experiment</button>
      </Link>
    </div>
  );
};

export default QandA;
