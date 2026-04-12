close all
clear
clc

%% Model Parameters (from paper)
m_s = 395.3;      % Sprung mass (kg)
m_u = 48.3;       % Unsprung mass (kg)
k_s = 30.01e+3;   % Suspension stiffness (N/m)
c_s = 1450;       % Damping (Ns/m)
k_t = 3.4e5;      % Tire stiffness (N/m)

%% State-Space Model Definition
% States: x = [zs-zu; dot_zs; zu-zr; dot_zu]
% (Suspension Stroke; Sprung Mass Velocity; Tyre Deflection; Unsprung Mass Velocity)
%
% Inputs: u = [F_act; dot_zr]
% (Actuator Force; Road Velocity)
%
% Outputs: y = [a_s; susTravel; tyreDeflection]
% (Sprung Mass Accel; Suspension Stroke; Tyre Deflection)

A = [0 1 0 -1; -k_s/m_s -c_s/m_s 0 c_s/m_s;...
    0 0 0 1; k_s/m_u c_s/m_u -k_t/m_u -c_s/m_u];

B = [0 0; 1/m_s 0; 0 -1; -1/m_u 0]; % CORRECTED B MATRIX (1/m_s is positive)

C = [-k_s/m_s -c_s/m_s 0 c_s/m_s;...
    1 0 0 0;...
    0 0 1 0];

D = [0 0; 0 0; 0 0]; % CORRECTED D MATRIX (to remove direct feedthrough)

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
x_lb = [-0.088; -0.163; -0.0128; -1.965]; % State lower bound
x_ub = [0.105; 0.14; 0.0128; 2.78];     % State upper bound
u_lb = -2500; % Lower bound on actuator force
u_ub = 2500; % Upper bound on actuator force

%% Road Profile (bump)
V = 30 * (1000 / 3600); % Vehicle speed (m/s)
time = 0:ts:T_sim; % Simulation time vector (s)
bump_L = 5; % Length of the bump (m)
bump_A = 0.1; % Height of the bump (m)
t0 = 0.6; % Start time of the bump (s)
road_disturbance = zeros(1, length(time));
for t_idx = 1:length(time)
    t = time(t_idx);
    if t >= t0 && t <= t0 + bump_L / V
        road_disturbance(t_idx) = (bump_A / 2) * (1 - cos(2 * pi * V * (t - t0) / bump_L));
    end
end
% The model uses road velocity as a disturbance, so we need to differentiate
road_disturbance_dot = [0, diff(road_disturbance)/ts];

%% Simulation without actuator (passive)
x_passive = zeros(4, length(time)); % State initialization
y_passive = zeros(3, length(time)); % Output initialization
u_control = zeros(1, length(time)); % No control
for k = 1:length(time)-1
    % Discrete system dynamics
    u_k = [u_control(k); road_disturbance_dot(k)]; % Inputs: control and disturbance
    x_passive(:, k+1) = A_d * x_passive(:, k) + B_d * u_k;
    y_passive(:, k) = C_d * x_passive(:, k) + D_d * u_k;
end

%% MPC Simulation
T = length(time) - T_p;  % Simulation horizon to ensure prediction is always possible
x = zeros(4, T+1);      % Initial states
u_rec = zeros(T, 1);      % Recorded control actions (only F_act)
y = zeros(3, T);          % Recorded outputs

for k = 1:T
    x_0 = x(:, k);  % Current state
    % Get the future road disturbance profile for the prediction horizon
    z_road = road_disturbance_dot(k : k + T_p - 1)';

    %% Solving the optimization problem
    u0 = zeros(T_c, 1);  % Initial guess for control sequence
    lb = repmat(u_lb, T_c, 1);  % Lower bounds on control sequence
    ub = repmat(u_ub, T_c, 1);  % Upper bounds on control sequence
    
    % Define the cost function handle
    cost_func = @(u) mpc_cost_function(u, A_d, B_d, Q, R, x_0, z_road, T_c, T_p);
    
    % Solver options
    options = optimoptions('fmincon','Display','none','Algorithm','sqp');

    % Solve for the optimal control sequence
    u_optimal = fmincon(cost_func, u0, [], [], [], [], lb, ub, [], options);

    % Apply the first optimal input
    u_rec(k) = u_optimal(1);
    
    % Update state using the calculated control and the actual road disturbance
    x(:, k+1) = A_d * x_0 + B_d * [u_rec(k); z_road(1)];
    y(:, k) = C_d * x_0 + D_d * [u_rec(k); z_road(1)];
end

%% Results Analysis
RMS_acc_pass = sqrt(mean(y_passive(1,:).^2));
RMS_acc_active = sqrt(mean(y(1,:).^2));
disp(['Passive RMS Acceleration: ', num2str(RMS_acc_pass)]);
disp(['Active RMS Acceleration: ', num2str(RMS_acc_active)]);

%% Plotting Results
time_active = time(1:T);
time_passive = time(1:length(y_passive));

% Plot 1: Sprung Mass Acceleration
figure;
plot(time_passive, y_passive(1,:), 'r--', 'LineWidth', 1.5);
hold on;
plot(time_active, y(1,:), 'b', 'LineWidth', 1.5);
title('Sprung Mass Acceleration: Active vs Passive');
xlabel('Time (s)');
ylabel('Acceleration (m/s^2)');
legend('Passive', 'Active (MPC)');
grid on;

% Plot 2: Suspension Stroke
figure;
plot(time_passive, x_passive(1,:), 'r--', 'LineWidth', 1.5);
hold on;
plot(time(1:T+1), x(1,:), 'b', 'LineWidth', 1.5);
title('Suspension Stroke: Active vs Passive');
xlabel('Time (s)');
ylabel('Stroke (m)');
legend('Passive', 'Active (MPC)');
grid on;

% Plot 3: Tyre Deflection
figure;
plot(time_passive, x_passive(3,:), 'r--', 'LineWidth', 1.5);
hold on;
plot(time(1:T+1), x(3,:), 'b', 'LineWidth', 1.5);
title('Tyre Deflection: Active vs Passive');
xlabel('Time (s)');
ylabel('Deflection (m)');
legend('Passive', 'Active (MPC)');
grid on;

% Plot 4: Actuator Force
figure;
plot(time_active, u_rec, 'k', 'LineWidth', 1.5);
title('Actuator Force');
xlabel('Time (s)');
ylabel('Force (N)');
grid on;

%% Cost Function
function cost = mpc_cost_function(u_seq, A_d, B_d, Q, R, x_0, z_road, T_c, T_p)
    cost = 0;
    x_k = x_0;
    
    % Cost over the control horizon
    for i = 1:T_c
        u_k = u_seq(i);
        dist_k = z_road(i);
        
        cost = cost + x_k'*Q*x_k + u_k'*R*u_k;
        
        % Predict next state
        x_k = A_d*x_k + B_d*[u_k; dist_k];
    end
    
    % Cost over the rest of the prediction horizon (no control action)
    for i = T_c+1 : T_p
        dist_k = z_road(i);
        cost = cost + x_k'*Q*x_k; % No R cost as u is assumed to be zero
        
        % Predict next state (with u=0)
        x_k = A_d*x_k + B_d*[0; dist_k];
    end

    % Add terminal cost
    cost = cost + x_k'*Q*x_k;
end