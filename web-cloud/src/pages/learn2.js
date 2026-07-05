import React, { useState } from "react";
import "./learn2.css";
import { Link } from "react-router-dom";

const qaItems = [
  {
    question: "What is LQR (Linear Quadratic Regulator)?",
    answer:
      "LQR is an optimal control strategy that computes feedback gains to minimize a cost function. It balances minimizing the deviation of system states and control effort by using a quadratic cost function. It is commonly used for linear systems represented in state-space form.",
  },
  {
    question: "What is the LQR equation?",
    answer:
      "The LQR equation involves solving the Riccati equation to compute the feedback gain K. The control input is given by u = -Kx, where x is the state vector.",
  },
  {
    question: "What are the differences between LQR and PID controllers?",
    answer:
      "LQR:\n- Designed for multi-input, multi-output systems.\n- Uses state-space models.\n- Optimizes a cost function for both performance and control effort.\n\nPID:\n- Works with single-input, single-output systems.\n- Uses simple proportional, integral, and derivative terms.\n- Does not explicitly optimize control effort.",
  },
  {
    question: "Why use LQR to control an inverted pendulum?",
    answer:
      "LQR is well-suited for controlling systems with multiple states like the inverted pendulum because:\n- It stabilizes the pendulum in an optimal way.\n- It handles state coupling (e.g., angle and position).\n- It minimizes control effort while achieving stability.",
  },
  {
    question: 'What is meant by the "swing-up" of an inverted pendulum?',
    answer:
      "Swing-up refers to the process of moving the pendulum from its stable downward position to its unstable upright position. This requires applying controlled forces to increase the pendulum's energy until it reaches the upright position.",
  },
  {
    question: "What are the dynamics of an inverted pendulum system?",
    answer:
      "The dynamics describe how the system evolves based on its physical properties. For a cart-pole system, the equations are derived from Newton's laws:\n- Linear motion of the cart.\n- Angular motion of the pendulum.",
  },
  {
    question: "What is state-space representation, and how is it used in LQR?",
    answer:
      "State-space representation models a system with a set of first-order differential equations:\n\u0001x = Ax + Bu\ny = Cx + Du\nLQR uses this representation to design controllers by solving the Riccati equation and computing the feedback gain K.",
  },
  {
    question:
      "Explain the role of the Q and R matrices in LQR. How do they influence system performance?",
    answer:
      "Q: Penalizes deviations of states from the desired trajectory. Larger values prioritize state accuracy.\nR: Penalizes the control input effort. Larger values prioritize minimizing control effort.\nAdjusting Q and R balances precision and energy efficiency.",
  },
  {
    question:
      "What is controllability, and why is it important for designing an LQR controller?",
    answer:
      "Controllability determines whether it is possible to drive the system to any state using an appropriate input. A system must be controllable for LQR to work effectively. This is verified by the controllability matrix.",
  },
  {
    question:
      "What is observability, and how does it relate to state estimation in an inverted pendulum system?",
    answer:
      "Observability determines whether the system states can be inferred from outputs. If the system is not observable, a full-state feedback controller like LQR requires a state observer (e.g., Kalman filter) to estimate the states.",
  },
  {
    question:
      "Describe the difference between stabilizing and swing-up control for an inverted pendulum.",
    answer:
      "Stabilizing control: Keeps the pendulum balanced in its upright position.\nSwing-up control: Moves the pendulum from its downward position to upright, typically by adding energy.",
  },
  {
    question:
      "What is the linearization process, and why is it used in LQR design?",
    answer:
      "Linearization approximates a non-linear system around an equilibrium point using a Taylor series. LQR requires a linear model, so systems like the inverted pendulum must be linearized around the upright position.",
  },
  {
    question:
      "How does feedback work in LQR to maintain stability in an inverted pendulum?",
    answer:
      "Feedback in LQR modifies the control input based on the current state. The controller uses the gain K to compute u = -Kx, ensuring the system corrects deviations and remains stable.",
  },
  {
    question: "What are the assumptions made in the LQR approach?",
    answer:
      "- The system is linear or linearized.\n- The system is fully controllable.\n- States are measurable or can be estimated.\n- Noise and disturbances are minimal.",
  },
];

const QandA = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleAnswer = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-4">Q&A</h1>
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
      <Link to="/inv">
        <button className="learnbtn">Start Experiment</button>
      </Link>
    </div>
  );
};

export default QandA;
