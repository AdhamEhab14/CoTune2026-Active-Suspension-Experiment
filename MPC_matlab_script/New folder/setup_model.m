%% Clear Workspace
clear; clc;

%% ------------------ PHYSICAL PARAMETERS ------------------
% --- Vehicle Masses ---
ms = 290;     % Sprung mass (kg)
mus = 60;     % Unsprung mass (kg)

% --- Suspension & Tire Properties ---
ks = 16812;   % Suspension stiffness (N/m)
cs = 1000;    % Suspension damping (N.s/m)
kt = 190000;  % Tire stiffness (N/m)

%% ------------------ CONTROLLER PARAMETERS ------------------
Ts = 0.01;    % Sample time (s). MPC is a digital controller.
p = 20;       % Prediction horizon (number of steps to look ahead).
m = 5;        % Control horizon (number of moves to plan).

%% ------------------ STATE-SPACE MODEL DERIVATION (Revised) ------------------
% The MPC controller needs the model in state-space format.
% We will define a model with TWO inputs:
% Input 1: Actuator force 'u' (Manipulated Variable, MV)
% Input 2: Road velocity 'dotz_r' (Measured Disturbance, MD)

A = [0, 1, 0, -1;
     -ks/ms, -cs/ms, 0, cs/ms;
     0, 0, 0, 1;
     ks/mus, cs/mus, -kt/mus, -cs/mus];

% B matrix for MV ('u') and MD ('dotz_r')
Bu = [0; 1/ms; 0; -1/mus]; % For Manipulated Variable 'u'
Bmd = [0; 0; -1; 0];      % For Measured Disturbance 'dotz_r'
B_full = [Bu, Bmd];       % Combine into a full B matrix

% Our outputs y that we want to control are:
% y = [body_acceleration; suspension_deflection; tire_deflection]
C = [-ks/ms, -cs/ms, 0, cs/ms;
     1, 0, 0, 0;
     0, 0, 1, 0];

% D matrix for MV and MD
Du = [1/ms; 0; 0];
Dmd = [0; 0; 0];
D_full = [Du, Dmd];

% Create the continuous-time state-space plant model
plant_continuous = ss(A, B_full, C, D_full);

% Explicitly label the input types for the MPC controller
plant_continuous.InputGroup.ManipulatedVariables = 1;
plant_continuous.InputGroup.MeasuredDisturbances = 2;

% Convert the plant to a discrete-time model for the MPC
plant_discrete = c2d(plant_continuous, Ts);

% Display a message to confirm completion
disp('Setup script finished with revised plant model. Workspace is ready.');
disp('Setup script finished with revised plant model. Workspace is ready.');