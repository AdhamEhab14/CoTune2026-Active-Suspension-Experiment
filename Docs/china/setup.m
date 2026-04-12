%% Active Suspension Model Setup
% This script initializes parameters, defines the system model,
% converts it to discrete-time for the MPC, and runs the simulation.

close all;
clear;
clc;

%% Parameters of the Suspension
ms = 500;    % Sprung Mass (kg) 
mu = 66.7;   % Unsprung Mass (kg)
ks = 27000;  % Suspension Stiffness (N/m) 
kw = 268000; % Wheel stiffness (N/m)
cs = 1500;   % Suspension Inherent Damping coefficient (N-s/m)

%% State-Space Model (Continuous-Time)
% dot_x = A*x + B*u + E*zr_dot
% state vector x = [zs-zu; dot_zs; zu-zr; dot_zu]
A = [ 0      1      0      -1    ;
     -ks/ms -cs/ms   0     cs/ms  ;
      0      0      0       1    ; 
      ks/mu  cs/mu  -kw/mu -cs/mu ];

% Input matrix for actuator force (u)
B = [0 ; 1/ms; 0; -1/mu];

% Input matrix for road disturbance (zr_dot)
E = [0; 0; -1; 0];

% Output matrix y = C*x + D*u
C = [-ks/ms -cs/ms 0 cs/ms;  % Sprung mass acceleration (ddot_Zs)
        1      0    0   0;   % Suspension travel (Zs-Zus)
        0      0    1   0];  % Tyre deflection (Zus-Zr)
      
D = [1/ms; 0; 0];

T = [0; 0; 0]; % D matrix for disturbance (not used in this C)

%% Convert to Discrete-Time Model for MPC
% This method discretizes only the core state-space dynamics (A and B)
% to avoid issues with the c2d function and direct feedthrough (D matrix).
Ts = 0.01; % Sample time for the controller (100 Hz).

% Create a temporary system with only the core dynamics
% C=eye(4) and D=zeros(4,2) makes the states the outputs for conversion purposes
core_sys_ct = ss(A, [B E], eye(4), zeros(4,2));

% Convert the core system to discrete-time
core_sys_dt = c2d(core_sys_ct, Ts);

% Extract the discrete-time A and B matrices for the MPC
Ad = core_sys_dt.A;
Bd = core_sys_dt.B; % Note: Bd will have two columns, one for the actuator and one for the road.

%% MPC Controller Tuning Weights
% A balanced set of weights for better performance.
% Q penalizes: [suspension travel, sprung mass velocity, tire deflection, unsprung mass velocity]
Q = diag([2600000 600 20000 100]); 

% Terminal state error weight (less impact on random roads)
F = diag([1 1 1 1]);  

% R is the penalty on actuator force. A larger value leads to smoother control.
R = 2e-5; 

%% Run the Simulink Model
sim('mpc_active_suspension2323');

%% Analyze Optimization Results
PAS_Accleration = rms(Acceleration_PAS);
ACT_Accleration = rms(Acceleration_ACT);
percent = abs(PAS_Accleration - ACT_Accleration)/PAS_Accleration;
fprintf("Sprung mass acceleration improved by %f%%.\n", percent*100);

%% Plot Results
% Sprung Mass Acceleration
figure (1)
p = plot(Time, Acceleration_ACT, 'r', Time, Acceleration_PAS, 'b');
p(1).LineWidth = 1.7;
p(2).LineStyle  = '--';
p(2).LineWidth = 0.8;
grid on;
title ('\fontsize{17}Sprung Mass Acceleration') 
xlabel('\fontsize{12}Time (s)') 
ylabel('\fontsize{12}Acceleration (m/s^2)'); 
legend({'Active','Passive'},'FontSize',12,'FontWeight','bold')

% Suspension Travel
figure (2)
p = plot(Time, Suspension_Travel_ACT, 'r', Time, Suspension_Travel_PAS, 'b');
p(1).LineWidth = 1.7;
p(2).LineStyle  = '--';
p(2).LineWidth = 0.8;
grid on;
title ('\fontsize{17}Suspension Travel') 
xlabel('\fontsize{12}Time (s)') 
ylabel('\fontsize{12}Displacement (m)'); 
legend({'Active','Passive'},'FontSize',12,'FontWeight','bold')

% Dynamic Tyre Load
Fact = Deflection_ACT*kw;
Fpas = Deflection_PAS*kw;
figure (3)
p = plot(Time, Fact, 'r', Time, Fpas, 'b');
p(1).LineWidth = 1.7;
p(2).LineStyle  = '--';
p(2).LineWidth = 0.8;
grid on;
title ('\fontsize{17}Dynamic Tyre Load') 
xlabel('\fontsize{12}Time (s)') 
ylabel('\fontsize{12}Dynamic Tyre Load (N)'); 
legend({'Active','Passive'},'FontSize',12,'FontWeight','bold')

% Actuator Force
figure (4)
p = plot(Time, ACTUATOR_FORCE, 'r');
p(1).LineWidth = 1.3;
grid on;
title ('\fontsize{17}Actuator Force') 
xlabel('\fontsize{12}Time (s)') 
ylabel('\fontsize{12}Actuator Force (N)'); 
legend({'Actuator force'},'FontSize',12,'FontWeight','bold')