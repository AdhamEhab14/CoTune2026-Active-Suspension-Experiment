%% AEKF_params.m
%% Active Suspension Digital Twin — Parameter Initialization
%% Run this FIRST before opening the Simulink model

clear; clc;

%% ===== KNOWN PHYSICAL CONSTANTS (fixed) =====
Ms  = 2.45;    % kg  — sprung mass
Mus = 1.00;    % kg  — unsprung mass
Kus = 1250.0;  % N/m — tire stiffness (known, not estimated)
Bus = 14.726;  % N·s/m — tire damping (known, not estimated)

%% ===== INITIAL ESTIMATES OF UNCERTAIN PARAMETERS =====
Ks_nom = 900.0;   % N/m  — nominal spring stiffness
Bs_nom = 58.08;   % N·s/m — nominal suspension damping

%% ===== LQR GAIN (reordered for KF state ordering) =====
% KF/AEKF uses state [zs-zus, zus-zr, żs, żus]  (KF ordering)
% Reorder: [K1,  K3,      K2,     K4     ]
K_lqr = [11.3848, -206.1923, 61.4922, -4.4806];

%% ===== ROAD EXCITATION =====
RoadAmp  = 0.015;  % m  (15 mm)
RoadFreq = 25.0;   % rad/s

%% ===== SIMULATION SETTINGS =====
dt_sim = 0.002;   % s  — 500 Hz (matches ESP32 KF prediction rate)
T_sim  = 120;     % s  — 2 minutes for test (use 300 for full session)

%% ===== AEKF INITIALIZATION =====
% Augmented state: [d1, d2, vs, vus, Ks, Bs]  (6×1)
x_aug0 = [0; 0; 0; 0; Ks_nom; Bs_nom];

% Initial covariance P0 (6×6)
P0 = diag([
    0.003^2,   % d1 uncertainty: ±3mm
    0.003^2,   % d2 uncertainty: ±3mm
    0.05^2,    % vs uncertainty: ±50mm/s
    0.05^2,    % vus uncertainty: ±50mm/s
    150^2,     % Ks uncertainty: ±150 N/m
    20^2       % Bs uncertainty: ±20 N·s/m
    ]);

% Process noise Q0 (6×6, Sage-Husa will adapt this)
Q0 = diag([
    (2e-4)^2,  % d1 dynamics
    (2e-4)^2,  % d2 dynamics
    (0.01)^2,  % vs dynamics
    (0.01)^2,  % vus dynamics
    5.0^2,     % Ks random walk: ±5 N/m per step
    0.5^2      % Bs random walk: ±0.5 N·s/m per step
    ]);

% Measurement noise R (4×4, fixed — from sensor characterization)
R_meas = diag([
    0.001^2,   % d1: 1mm std (EMA-filtered ToF output)
    0.001^2,   % d2: 1mm std
    0.003^2,   % vs: 3mm/s std (bandpass-filtered KF output)
    0.003^2    % vus: 3mm/s std
    ]);

% Sage-Husa forgetting factor
b_sh = 0.97;

%% ===== PARAMETER INJECTION TEST =====
% At t_inject seconds, Ks drops from Ks_true_1 to Ks_true_2
% AEKF should detect and track this change
t_inject  = 60.0;    % seconds
Ks_true_1 = 900.0;   % N/m before injection
Ks_true_2 = 700.0;   % N/m after injection (20% spring softening)
Bs_true   = 58.08;   % N·s/m (constant)

%% ===== PACK INTO STRUCTS FOR SIMULINK =====
params.Ms=Ms; params.Mus=Mus; params.Kus=Kus; params.Bus=Bus;
params.K_lqr=K_lqr; params.RoadAmp=RoadAmp; params.RoadFreq=RoadFreq;
params.dt_sim=dt_sim;

fprintf('AEKF_params loaded. Simulink model is ready to open.\n');
fprintf('Simulation: %.0f seconds at %.0f Hz\n', T_sim, 1/dt_sim);
fprintf('Ks nominal = %.1f N/m, Bs nominal = %.2f N·s/m\n', Ks_nom, Bs_nom);
fprintf('Ks injection at t=%.0fs: %.0f → %.0f N/m\n', t_inject, Ks_true_1, Ks_true_2);