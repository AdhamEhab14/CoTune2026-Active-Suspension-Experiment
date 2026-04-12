close all
clear
clc

%% Model Parameters (from the paper)
m_s = 2.45;       % Sprung mass (kg)
m_u = 1.0;        % Unsprung mass (kg)
k_s = 980;        % Suspension stiffness (490 * 2) (N/m)
c_s = 7.5;        % Suspension damping (Ns/m)
k_t = 2500;       % Tire stiffness (1250 * 2) (N/m)
cw = 5.0;         % Tire damping (Ns/m) - NEW PARAMETER

% Inputs: u = [F_act dot_zr]                   
% States: x = [zs-zu; dot_zs; zt; dot_zu]    
% Output: y= [a_s; susTravel; zt]
% y(1) = a_s = dotdot_zs = [-k_s/m_s -c_s/m_s k_s/m_s c_s/m_s]x + [1/m_s 0]u
% y(2) = susTravel = zs - zu = [1 0 -1 0]x +[0 0]u
% y(3) = zt = zu-zr = [0 0 1 0]x + [0 -1]

% Equation: dot_x = Ax + Bu
% Measurements: y = Cx + Du 

A = [0 1 0 -1;-k_s/m_s -c_s/m_s 0 c_s/m_s;...
    0 0 0 1;k_s/m_u c_s/m_u -k_t/m_u -c_s/m_u];
B = [0 0;-1/m_s 0;0 -1;-1/m_u 0];    
C = [-k_s/m_s -c_s/m_s 0 c_s/m_s;...
    1 0 0 0;...
    0 0 1 0];                             
D = [1/m_s 0;0 0;0 0];

%% System discretization
ts = 0.01; % Sampling time (s)
sys_d = c2d(ss(A, B, C, D), ts,'zoh');
[A_d, B_d,C_d,D_d] = ssdata(sys_d);

%% MPC Parameters
T_sim = 10;
T_c = 6;
T_p =12; % Prediction horizon
Q = diag([0.1, 5, 0.1, 5]); % Weight on states
R = 0.0000001; % Weight on inputs
[K, P] = dlqr(A_d, B_d,Q,R);
% calculates the optimal gain matrix K such that the state-feedback law
% minimizes the quadratic cost function; P is the infinite horizon solution 
% of the associated discrete-time Riccati equation
K = -K; % Sign convention.
Q_f= Q+K'*R*K;

% MODIFICATION: Actuator limits updated to match Quanser hardware
u_lb = -38; % Input lower bounds
u_ub = 38; % Input upper bounds

%% Road profile (bump) - Scaled for smaller model
V = 5 * (1000 / 3600); % Vehicle speed (m/s)
time = 0:ts:T_sim; % Road profile duration (s)
bump_L = 0.5; % Bump length (m)
bump_A = 0.01; % Bump height (m)
t0 = 0.6; % Bump start time (s)
road_disturbance = zeros(1, length(time));
for t_idx = 1:length(time)
    t = time(t_idx);
    if t >= t0 && t <= t0 + bump_L / V
        road_disturbance(t_idx) = (bump_A / 2) * (1 - cos(2 * pi * V * (t - t0) / bump_L));
    end
end

%% Simulation without actuator (passive)
x_passive = zeros(4, length(time)); % State initialization
y_passive = zeros(3, length(time)); % Output initialization
u_control = zeros(1, length(time)); % No control
u_disturbance = road_disturbance; % Road disturbance
for k = 1:length(time)-1
    % Discrete system dynamics
    u_k = [u_control(k); u_disturbance(k)]; % Inputs: control and disturbance
    x_passive(:, k+1) = A_d * x_passive(:, k) + B_d * u_k;
    y_passive(:,k) = C_d * x_passive(:,k) + D_d * u_k;
end

%% MPC Simulation
T = length(time) - T_c;  % Simulation horizon
x = zeros(4, T+1); % Initial states
x(:, 1) = [0; 0; 0; 0]; % Initial condition
u_rec = zeros(T, 1); % Control actions (only F_act)
y = zeros(3, T); % Output initialization

for k = 1:T
    x_0 = x(:, k);  % Current state
    z_road = road_disturbance(k:k+T_c-1)';  % Predicted road profile (disturbance)
    %% Construction of prediction matrices T and S
    nx = 4;  % Number of states
    nu = 1;  % Optimize only F_act (one input)
    T_mat = zeros(T_c*nx, nx);  % Free evolution matrix
    S_mat = zeros(T_c*nx, nu*T_c);  % Forced evolution matrix
    for i = 1:T_c
        T_mat((i-1)*nx+1:i*nx, :) = A_d^i;
        for j = 1:i
            S_mat((i-1)*nx+1:i*nx, j) = A_d^(i-j) * B_d(:, 1);  % Only F_act
        end
    end
    %% State constraints as function of u_1
    % Constraints: F * u <= e
    FS = [S_mat; -S_mat];  % Input constraints
    e = [repmat(x_ub, T_c, 1) - T_mat * x_0;
         -repmat(x_lb, T_c, 1) + T_mat * x_0];
    %% Optimization problem solution
    u0 = zeros(T_c, 1);  % Input initialization (only F_act)
    lb = repmat(u_lb, T_c, 1);  % Input lower bounds
    ub = repmat(u_ub, T_c, 1);  % Input upper bounds
    % Solution with fmincon
    options = optimoptions('fmincon','Display','none'); % Added options to prevent text output
    [u, fval] = fmincon(@(u_1) mpc_cost(u_1, A_d, B_d, Q, R, Q_f, x_0, z_road, T_c, T_p), ...
                            u0, FS, e, [], [], lb, ub, [], options);
    % Apply first optimal input
    u_rec(k) = u(1);  % Save only F_act (u_1)
    % Update state
    x(:, k+1) = A_d * x_0 + B_d * [u_rec(k); z_road(1)];
    y(:,k) = C_d * x_0 + D_d * [u_rec(k); z_road(1)];
    
end
RMS_acc_pass = sqrt(1/100*(sum((y_passive(1,1:100)))^2))
RMS_acc_att = sqrt(1/100*(sum((y(1,1:100)))^2))

%% Results
time_mpc = time(1:T+1); % Time for simulation with actuator
figure;
for i = 1:nx
    subplot(nx, 1, i);
    hold on;
    plot(time_mpc, x(i, :), 'b', 'LineWidth', 1.5); % Current state
    plot(time_mpc, repmat(x_lb(i), 1, length(time_mpc)), 'r--', 'LineWidth', 1); % Lower bound
    plot(time_mpc, repmat(x_ub(i), 1, length(time_mpc)), 'g--', 'LineWidth', 1); % Upper bound
    hold off;
    ylabel(['x_' num2str(i)]);
    xlabel('Time (s)');
    title(['State x_' num2str(i) ' Evolution']);
    legend('State', 'Lower Bound', 'Upper Bound');
end
%% Results
% Correct time vector for MPC simulation
time_mpc = time(1:T+1); % Time for simulation with actuator
time_passive = time; % Time for passive simulation
% Plots
figure;
subplot(2, 1, 1);
hold on;
plot(time_mpc, x(1, :), 'b', 'LineWidth', 1.5); % Suspension with actuator
plot(time_passive, x_passive(1, :), 'r--', 'LineWidth', 1.5); % Suspension without actuator
hold off;
ylabel('Suspension Stroke (m)');
xlabel('Time (s)');
title('Suspension Stroke with and without Actuator');
legend('Active Suspension', 'Passive Suspension');
subplot(2, 1, 2);
plot(time(1:T), u_rec(1:T), 'r', 'LineWidth', 1.5);
ylabel('Actuator Force (N)');
xlabel('Time (s)');
title('Actuator Force (Discrete)');
grid on;
%% Calculation of sprung mass acceleration
acc_passive = y_passive(1,1:T);  % Passive suspension acceleration
acc_active = y(1,1:T);  % Active suspension acceleration (using first T values of y)
%% Calculation of tire deflection
tyre_deflection_passive = x_passive(3, 1:T);  % Passive tire
tyre_deflection_active = x(3, 1:T);  % Active tire (using first T values)
%% Plot of sprung mass acceleration
figure;
hold on;
plot(time(1:T), acc_passive, 'r--', 'LineWidth', 1.5); % Passive suspension acceleration
plot(time(1:T), acc_active, 'b', 'LineWidth', 1.5); % Active suspension acceleration
hold off;
ylabel('Acceleration of Sprung Mass (m/s^2)');
xlabel('Time (s)');
title('Acceleration of Sprung Mass: Active vs Passive Suspension');
legend('Passive Suspension', 'Active Suspension');
grid on;
%% Plot of tire deflection
figure;
hold on;
plot(time(1:T), tyre_deflection_passive, 'r--', 'LineWidth', 1.5); % Passive tire deflection
plot(time(1:T), tyre_deflection_active, 'b', 'LineWidth', 1.5); % Active tire deflection
hold off;
ylabel('Tyre Deflection (m)');
xlabel('Time (s)');
title('Tyre Deflection: Active vs Passive Suspension');
legend('Passive Suspension', 'Active Suspension');
grid on;
%% Cost function
function f = mpc_cost(u,A_d, B_d, Q, R,Q_f,x_0,z_road,T_c,T_p)
    f = 0;
    x = x_0;
    
    for ii = 1:T_c
        my_sum_i = [];
        for ll = 0:ii-1
            my_sum_i(:,ll+1) = A_d^(ll)*B_d*[u(ii-ll);z_road(ii-ll)];
        end
        x = A_d^(ii)*(x) + sum(my_sum_i,2);
        f(ii) = R*u(ii)^2 + (x)'*Q*(x);
    end
    x_Tc = x;
    for ii = T_c+1:T_p-1
        x = A_d^(ii)*x_Tc;
        f(ii) = (x)'*Q*(x);
    end
    x_Tp = A_d*x;
    f = sum(f)+(x_Tp)'*Q_f*(x_Tp);
end

