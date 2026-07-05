%%  ACTIVE SUSPENSION CONTROL
% Purpose: Initialize Simscape Data, Build Plant, and Design LQR Controller
clear; clc; close all;

%% 1. INITIALIZATION & DATA LOADING
% Load Simscape mechanical data (Transforms, Masses, etc.)
addpath ActiveSuspension
run(fullfile('ActiveSuspension', 'ACTIVESUSPENSIONSYS_OPT_DataFile.m'))

%% 2. PHYSICAL PARAMETERS (Quanser Nominal)
% Values confirmed from your main and hardware manual
Ms  = 2.45;     % Sprung mass [kg]
Mus = 1.00;     % Unsprung mass [kg]
Ks  = 900;      % Suspension stiffness [N/m]
Kus = 1250;     % Tire stiffness [N/m]
Bs  = 7.5;      % Suspension damping [N*s/m]
Bus = 5.0;      % Tire damping [N*s/m]

%% 3. STATE-SPACE REPRESENTATION (Force Input)
% States: [z_s-z_us; dz_s; z_us-z_r; dz_us]
A = [ 0        1          0           -1;
     -Ks/Ms   -Bs/Ms      0            Bs/Ms;
      0        0          0            1;
      Ks/Mus   Bs/Mus    -Kus/Mus   -(Bs+Bus)/Mus ];

% Control input u = Fc (Active Force in Newtons)
B = [0; 1/Ms; 0; -1/Mus]; 

%% 4. SYSTEM ANALYSIS (Professional Checks)
% Controllability Check: Must be rank 4
Co = ctrb(A,B);
fprintf('Controllability rank = %d/4\n', rank(Co));

%% 5. LQR DESIGN (Tuning)
% Q matrix: Penalty on states [Travel, Velocity, Deflection, Tire_Vel]
% High values on Q(1,1) and Q(3,3) prioritize stability and ride height.
Q = diag([800, 200, 800, 20]); 

% R matrix: Penalty on Force (N). Smaller R = more aggressive control.
R = 0.01; 

% Calculate Optimal Gain K
[K, S, E] = lqr(A, B, Q, R);

fprintf('\n--------------------------------------------------\n');
fprintf('LQR Gain K calculated for FORCE input (N):\n');
fprintf('K = [%.4f  %.4f  %.4f  %.4f]\n', K(1), K(2), K(3), K(4));
fprintf('Closed-loop poles:\n');
disp(E);
fprintf('--------------------------------------------------\n');

%% 6. LAUNCH SIMULINK
open(fullfile('ActiveSuspension', 'ACTIVESUSPENSIONSYS.slx'))
fprintf('Simulink model is ready. Set external Gain to 1 to activate LQR.\n');