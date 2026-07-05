%% Clear Workspace and Set Up Parameters for Simulink
close all; clear; clc;

%% Model Parameters
m_s = 395.3;      % Sprung mass (kg)
m_u = 48.3;       % Unsprung mass (kg)
k_s = 30.01e+3;   % Suspension stiffness (N/m)
c_s = 1450;       % Damping (Ns/m)
k_t = 3.4e5;      % Tire stiffness (N/m)

%% State-Space Model
A = [0 1 0 -1;-k_s/m_s -c_s/m_s 0 c_s/m_s;...
    0 0 0 1;k_s/m_u c_s/m_u -k_t/m_u -c_s/m_u];
B = [0 0;1/m_s 0;0 -1;-1/m_u 0];
C = [-k_s/m_s -c_s/m_s 0 c_s/m_s; 1 0 0 0; 0 0 1 0];
D = [0 0;0 0;0 0];

%% System Discretization
ts = 0.01; % Sampling time (s)
sys_d = c2d(ss(A, B, C, D), ts, 'zoh');
[A_d, B_d, C_d, D_d] = ssdata(sys_d);

%% MPC Parameters
T_sim = 10;
T_c = 6;  % Control horizon
T_p = 12; % Prediction horizon
Q = diag([0.1, 5, 0.1, 5]); % Weight on states
R = 1e-7; % Weight on inputs
u_lb = -2500; % Lower bound on inputs
u_ub = 2500; % Upper bound on inputs

%% Road Profile for Simulink
V = 30 * (1000 / 3600); % Vehicle speed (m/s)
time = (0:ts:T_sim)'; % Time vector (must be a column)
bump_L = 5; bump_A = 0.1; t0 = 0.6;
road_disturbance_dot = zeros(length(time), 1);
for t_idx = 1:length(time)
    t = time(t_idx);
    if t >= t0 && t <= t0 + bump_L / V
        road_disturbance_dot(t_idx) = (bump_A * pi * V / bump_L) * sin(2 * pi * V * (t - t0) / bump_L);
    end
end
% Create a timeseries object for the 'From Workspace' block
road_ts = timeseries(road_disturbance_dot, time);

disp('Workspace is ready for Simulink. You can now run the model.');
% --- NEW: Pad the array with extra zeros to prevent preview errors ---
road_disturbance_dot_padded = [road_disturbance_dot; zeros(T_p, 1)];