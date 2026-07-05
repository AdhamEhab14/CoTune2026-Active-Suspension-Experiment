# CoTune Remote Control Lab

A remote-access control systems laboratory built as a graduation project at the Faculty of Engineering, Ain Shams University (Mechatronics Program). CoTune lets a student log in from anywhere, join a queue, tune a real LQR controller, run it on physical hardware over the internet, and watch the result live — combining a mechanical testbed, an embedded real-time controller, and a cloud/web platform into one system.

**Live demo video:** https://www.youtube.com/watch?v=JONjcuDR5eo
**Live platform:** https://main.d35sofljaoe99e.amplifyapp.com/
**Full thesis (PDF):** [`docs/CoTune_Thesis.pdf`](docs/CoTune_Thesis.pdf)

## What's in this repo

This repo brings together the three parts of the CoTune graduation project:

| Folder | What it is |
|---|---|
| [`active-suspension/`](active-suspension/) | Mechanical design, system identification, LQR control, and ESP32/FreeRTOS firmware for the quarter-car active suspension rig. |
| [`rotary-pendulum/`](rotary-pendulum/) | Git submodule pointing to the standalone [Rotary-Inverted-Pendulum](https://github.com/AdhamEhab14/Rotary-Inverted-Pendulum) repo — the Furuta pendulum swing-up + LQR experiment. Kept as its own repo since it also works as a standalone project. |
| [`web-cloud/`](web-cloud/) | The React + AWS front end and cloud infrastructure (IoT Core, Cognito, DynamoDB, Amplify) that puts both experiments online. Built with the team; included here as a snapshot of the work. |
| [`docs/CoTune_Thesis.pdf`](docs/CoTune_Thesis.pdf) | The full graduation thesis this project is based on. |

## Project overview

Traditional control labs are bound by physical presence, fixed schedules, and limited hardware access. CoTune addresses that by exposing two laboratory-scale experiments — an **active suspension system** and a **rotary inverted pendulum** — through a browser-based platform that streams live telemetry and video, and lets students push real control parameters to real hardware.

### 1. Active Suspension

A bench-scale quarter-car rig (sprung mass / unsprung mass / road input, each a plate on linear guides) actuated by a capstan-driven and a lead-screw-driven 775 DC motor.

- **Model:** 2-DOF quarter-car, state vector `[suspension travel, sprung velocity, tire deflection, unsprung velocity]`.
- **System ID:** grey-box estimation of motor and mechanical parameters (`Ks = 900 N/m`, `Bs = 58.08 N·s/m`, `Kus = 1250 N/m`, `Bus = 14.73 N·s/m`) via MATLAB Parameter Estimator, validated in closed loop.
- **Control:** Linear Quadratic Regulator (LQR), gains solved from the Riccati equation, running against a discrete Kalman filter that fuses VL53L0X ToF distance sensors with MPU6050 IMUs.
- **Embedded:** multi-rate FreeRTOS on an ESP32 (500 Hz IMU/control loop, 50 Hz ToF loop), custom C++ S-Function for sensor/Kalman-filter handling, I²C mutex + bus-recovery logic, cascaded alpha/high-pass/low-pass filtering before the control law, PWM/direction output to a Cytron motor driver, and hardware limit-switch safety cutoffs.

### 2. Rotary Inverted Pendulum (standalone submodule)

A Furuta pendulum: a horizontal rotary arm (actuated) balancing a free-swinging vertical pendulum link (unactuated) — a classic underactuated, nonlinear benchmark.

- Nonlinear Euler-Lagrange dynamics, linearized about the upright equilibrium for LQR design.
- Two-stage system identification (motor first, then coupled arm-pendulum dynamics).
- Hybrid embedded controller: energy-based swing-up until the pendulum nears upright, then an automatic switch to LQR stabilization — all running on the same ESP32/FreeRTOS architecture as the suspension rig.
- Lives in its own repo ([Rotary-Inverted-Pendulum](https://github.com/AdhamEhab14/Rotary-Inverted-Pendulum)) and is linked here as a submodule so it can be browsed as part of CoTune as a whole, or used completely on its own.

### 3. Web & Cloud Platform

Turns both rigs into a remote lab, accessible from any browser:

- **Hardware tier:** ESP32 boards run the control loop locally and act as MQTT clients (mutual TLS) to AWS IoT Core.
- **Cloud tier:** AWS IoT Core (MQTT broker), Amazon Cognito (auth), DynamoDB (queue state + session/LQR parameter logging), AWS Amplify (hosting + CI/CD).
- **Client tier:** a modular React SPA — in-browser LQR solver, live Chart.js telemetry, a Twitch-embedded live camera feed, per-experiment access queues with timed sessions, URDF-based 3D pre-experiment simulations, and a Groq/Llama-powered AI assistant scoped to control-theory Q&A.
- MQTT topics separate commands from telemetry per experiment (`SUSP/Parameters` / `suspension/telemetry` at 1 Hz, `ROTARY/Parameters` / `rotary/telemetry` at 10 Hz), QoS 0, JSON payloads under 256 bytes.

### 4. Digital Twin (Active Suspension)

An offline, post-session **seven-state Augmented Extended Kalman Filter (AEKF)** that re-estimates the suspension's real spring stiffness and damping from downloaded session telemetry (augmenting the 4-state model with `Ks`, `Bs`, and a road-phase offset). On a real 140s session it converged to `Ks ≈ 936 N/m` (+4% vs. nominal) and `Bs ≈ 41.2 N·s/m` (-29% vs. nominal), and closed-loop validation against the real data cut amplitude error from 8.2% (nominal model) to 3.1% (AEKF model) — while also surfacing an unmodeled ~1.8 Hz structural resonance in the physical rig. Full derivation and results are in Chapter 6 of the thesis.

## Tech stack

**Mechanical/Electrical:** SolidWorks, Simscape Multibody, 775 DC motors, Cytron motor drivers, VL53L0X ToF sensors, MPU6050 IMUs, incremental encoders.
**Embedded:** ESP32, FreeRTOS, Simulink Support Package for Arduino, custom C++ S-Functions, discrete Kalman filtering.
**Control:** MATLAB/Simulink, LQR, Algebraic Riccati Equation solving, grey-box system identification.
**Cloud/Web:** React 18, AWS Amplify, AWS IoT Core (MQTT), Amazon Cognito, DynamoDB, Chart.js, Three.js/@react-three/fiber + urdf-loader, Groq API (Llama 3.3 70B).

## Team

Graduation project, Mechatronics Engineering Program, Faculty of Engineering – Ain Shams University (2025–2026), supervised by **Dr. Mohamed Omar**.

Adham Ehab Saleh · Abdelrahman Hany Abdelrahman · Ahmed Mohamed Ramadan · Ahmed Yasser Hosny · Khalid Amin Abdullah · Omar Mohamed Fathy

## License

MIT — see [`LICENSE`](LICENSE).
