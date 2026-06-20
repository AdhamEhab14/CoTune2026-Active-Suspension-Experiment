%% aekf_real_data.m — v4: 7-state AEKF [d1,d2,vs,vus,Ks,Bs,phi_r]
%% phi_r = road phase offset (rad) — estimated to remove systematic Ks/Bs bias

clear; clc;

Ms=2.45; Mus=1.00; Kus=1250.0; Bus=14.726;
b_sh = 0.97;

%% 7-state init: x = [d1, d2, vs, vus, Ks, Bs, phi_r]
x_aug = [0; 0; 0; 0; 900.0; 58.08; 0.0];

P = diag([0.005^2, 0.010^2, 0.05^2, 0.10^2, 150^2, 20^2, pi^2]);
%          d1       d2       vs       vus     Ks      Bs    phi_r (±π uncertain)

Q = diag([(1e-3)^2, (3e-2)^2, (1e-2)^2, (8e-2)^2, 0.5^2, 0.05^2, 1e-6]);
%           d1        d2        vs         vus       Ks     Bs     phi_r(constant)

R_meas = diag([0.002^2, 0.002^2, 0.005^2, 0.005^2]);

%% Load and trim
data = readtable('session_data.csv');
data = data(data.t_s >= 25, :);
t_offset = data.t_s(1);           % session time of first used row (road phase ref)
data.t_s  = data.t_s - t_offset;
N = height(data);

%% Unit conversion: d1/d2 mm→m, velocities and forces already SI
d1_arr  = data.d1_m  / 1000;
d2_arr  = data.d2_m  / 1000;
vs_arr  = data.vs_mps;
vus_arr = data.vus_mps;
u_arr   = data.u_N;
t_arr   = data.t_s;
road_amp  = data.road_amp_m(1);       % 0.015 m
road_freq = data.road_freq_rads(1);   % 25.0 rad/s

fprintf('Session: %d samples, %.1f s.  t_offset=%.2f s\n', N, t_arr(end), t_offset);

Ks_hist  = NaN(N,1); Bs_hist  = NaN(N,1);
phi_hist = NaN(N,1); inn_hist = NaN(N,1);
step_count = 0;

for i = 2:N
    dt = t_arr(i) - t_arr(i-1);
    if dt <= 0 || dt > 2.0; continue; end

    frozen = (d1_arr(i) == d1_arr(i-1)) && (d2_arr(i) == d2_arr(i-1));

    t_end   = t_arr(i) + t_offset;   % absolute session time at end of interval
    t_start = t_end - dt;            % absolute session time at start
    Fc = u_arr(i);
    z  = [d1_arr(i); d2_arr(i); vs_arr(i); vus_arr(i)];

    %% PREDICTION — update road time at each sub-step (fixes 2.5 rad error)
    N_inner = max(1, round(dt / 0.002));
    dt_i    = dt / N_inner;
    for j = 1:N_inner
        t_inner = t_start + j * dt_i;    % correct time inside interval
        dx      = f_aug_fn(x_aug, Fc, t_inner, road_amp, road_freq, Ms, Mus, Kus, Bus);
        x_aug   = x_aug + dt_i * dx;
        x_aug   = clamp_aug(x_aug);
    end

    F_cont = F_jac_fn(x_aug, t_end, road_amp, road_freq, Ms, Mus, Kus, Bus);
    F_d    = expm(F_cont * dt);
    P      = F_d * P * F_d' + Q;
    P      = (P + P') / 2;
    P      = clamp_P_diag(P);

    %% UPDATE — NIS gate, skip frozen blocks
    do_update = ~frozen;
    if do_update
        H     = [eye(4), zeros(4,3)];    % 4×7: observe first 4 states
        innov = z - x_aug(1:4);
        S     = H * P * H' + R_meas;
        NIS   = innov' / S * innov;
        if NIS > 30; do_update = false; end   % chi2(4) @ 99.99% = 27.7
    end

    if do_update
        K_g = P * H' / S;

        % Per-step limits for each parameter to prevent overcorrection
        dKs  = K_g(5,:) * innov;
        dBs  = K_g(6,:) * innov;
        dphi = K_g(7,:) * innov;
        if abs(dKs)  > 8;       K_g(5,:) = K_g(5,:) * (8      / abs(dKs));  end
        if abs(dBs)  > 0.8;     K_g(6,:) = K_g(6,:) * (0.8    / abs(dBs));  end
        if abs(dphi) > pi/20;   K_g(7,:) = K_g(7,:) * (pi/20  / abs(dphi)); end

        x_aug = x_aug + K_g * innov;
        x_aug = clamp_aug(x_aug);

        IKH = eye(7) - K_g * H;
        P   = IKH * P * IKH' + K_g * R_meas * K_g';
        P   = (P + P') / 2;
        P   = clamp_P_diag(P);

        % Bound parameter↔state cross-covariances
        P(5,1:4) = max(-0.05, min(0.05, P(5,1:4)));  P(1:4,5) = P(5,1:4)';
        P(6,1:4) = max(-0.01, min(0.01, P(6,1:4)));  P(1:4,6) = P(6,1:4)';
        P(7,1:4) = max(-0.01, min(0.01, P(7,1:4)));  P(1:4,7) = P(7,1:4)';

        % Sage-Husa adaptive Q for physical states; pin parameter Q rows
        step_count = step_count + 1;
        d_sh  = (1 - b_sh) / (1 - b_sh^step_count);
        Q_new = K_g * (innov * innov') * K_g';
        Q     = (1-d_sh)*Q + d_sh*Q_new;
        Q_floor = diag([1e-10,1e-10,1e-8,1e-8,  0.01, 0.001, 1e-12]);
        Q_ceil  = diag([5e-5, 4e-3, 5e-3, 0.02,  4,    0.25,  1e-4 ]);
        for k=1:7
            Q(k,k) = max(Q(k,k), Q_floor(k,k));
            Q(k,k) = min(Q(k,k), Q_ceil(k,k));
        end
        Q(5,5) = 0.25;    % Ks: fixed 0.5 N/m std per step
        Q(6,6) = 0.0025;  % Bs: fixed 0.05 N·s/m std per step
        Q(7,7) = 1e-6;    % phi_r: near-constant

        inn_hist(i) = norm(innov);
    end

    Ks_hist(i)  = x_aug(5);
    Bs_hist(i)  = x_aug(6);
    phi_hist(i) = x_aug(7);
end

%% Plot — 4 panels
valid = ~isnan(Ks_hist);
t_p   = t_arr(valid);
Ks_p  = Ks_hist(valid);
Bs_p  = Bs_hist(valid);
phi_p = phi_hist(valid);
inn_p = inn_hist(valid);

figure('Name','AEKF Real Data v4 — 7-state','Position',[50 50 1100 820]);

subplot(4,1,1);
plot(t_p, Ks_p,'b-','LineWidth',1.5); hold on;
yline(900,'r--','LineWidth',2);
ylabel('K_s (N/m)'); title('K_s Estimation — Road Phase Compensated'); grid on;
ylim([400 1400]);
legend('K_s estimated','Nominal 900','Location','best');

subplot(4,1,2);
plot(t_p, Bs_p,'g-','LineWidth',1.5); hold on;
yline(58.08,'r--','LineWidth',2);
ylabel('B_s (N·s/m)'); title('B_s Estimation'); grid on;
ylim([0 200]);
legend('B_s estimated','Nominal 58.08','Location','best');

subplot(4,1,3);
plot(t_p, phi_p * (180/pi),'c-','LineWidth',1.5); hold on;
yline(0,'r--','LineWidth',1);
ylabel('\phi_r (deg)'); title('Road Phase Offset \phi_r (converges = model matched)');
grid on;

subplot(4,1,4);
plot(t_p, inn_p,'m.','MarkerSize',3);
ylabel('||innovation||'); xlabel('Time from trim start (s)');
title('Innovation Norm'); grid on;

%% Best-window extraction: median of t=2-8s (before phi_r has diverged)
win_mask = (t_p >= 2) & (t_p <= 8);
if sum(win_mask) >= 3
    Ks_best  = median(Ks_p(win_mask),  'omitnan');
    Bs_best  = median(Bs_p(win_mask),  'omitnan');
    phi_best = median(phi_p(win_mask), 'omitnan');
else
    Ks_best = Ks_p(1); Bs_best = Bs_p(1); phi_best = phi_p(1);
end

% Shade extraction window on each parameter panel
subplot(4,1,1); hold on;
xregion(2, 8, 'FaceColor',[0.85 0.92 1], 'FaceAlpha',0.6);
text(5, 1350, sprintf('\\bf Ks = %.0f N/m', Ks_best), ...
    'FontSize',10, 'HorizontalAlignment','center', 'Color','b');

subplot(4,1,2); hold on;
xregion(2, 8, 'FaceColor',[0.85 0.92 1], 'FaceAlpha',0.6);
text(5, 185, sprintf('\\bf Bs = %.1f N·s/m', Bs_best), ...
    'FontSize',10, 'HorizontalAlignment','center', 'Color',[0 0.5 0]);

%% Console output
fprintf('\n--- Snapshot Estimates ---\n');
for t_check = [5, 10, 20, 30, 60]
    idx = find(t_p >= t_check, 1, 'first');
    if ~isempty(idx)
        fprintf('t=%3ds: Ks=%6.1f N/m  Bs=%5.2f N·s/m  phi_r=%6.1f deg\n',...
            t_check, Ks_p(idx), Bs_p(idx), phi_p(idx)*180/pi);
    end
end
fprintf('\n=== BEST ESTIMATE (median t=2-8s window) ===\n');
fprintf('  Ks    = %.1f N/m      (nominal 900)\n', Ks_best);
fprintf('  Bs    = %.2f N·s/m  (nominal 58.08)\n', Bs_best);
fprintf('  phi_r = %.1f deg     (road phase offset)\n\n', phi_best*180/pi);

%% ── helper functions ─────────────────────────────────────────────────────

function s = clamp_aug(x)
    s    = x;
    s(1) = max(-0.10, min(0.10, x(1)));   % d1  ±100 mm
    s(2) = max(-0.20, min(0.20, x(2)));   % d2  ±200 mm
    s(3) = max(-2.0,  min(2.0,  x(3)));   % vs  ±2 m/s
    s(4) = max(-2.0,  min(2.0,  x(4)));   % vus ±2 m/s
    s(5) = max(50,    min(2000, x(5)));    % Ks  N/m
    s(6) = max(0.5,   min(300,  x(6)));   % Bs  N·s/m
    s(7) = max(-pi,   min(pi,   x(7)));   % phi_r  ±π rad
end

function Pc = clamp_P_diag(P)
    P_max = [0.025^2, 0.06^2, 2^2, 2^2, 400^2, 60^2, (2*pi)^2];
    Pc = P;
    for k = 1:7
        Pc(k,k) = min(P(k,k), P_max(k));
    end
end

function dx = f_aug_fn(x, Fc, t_abs, road_amp, road_freq, Ms, Mus, Kus, Bus)
    Ks = x(5); Bs = x(6); phi_r = x(7);
    zr_dot = road_amp * road_freq * cos(road_freq * t_abs + phi_r);
    dx = zeros(7,1);
    dx(1) = x(3) - x(4);
    dx(2) = x(4) - zr_dot;
    dx(3) = -(Ks/Ms)*x(1) - (Bs/Ms)*(x(3)-x(4)) + Fc/Ms;
    dx(4) = (Ks/Mus)*x(1) - (Kus/Mus)*x(2) + (Bs/Mus)*(x(3)-x(4)) ...
            - (Bus/Mus)*x(4) + (Bus/Mus)*zr_dot - Fc/Mus;
    dx(5) = 0; dx(6) = 0; dx(7) = 0;
end

function F = F_jac_fn(x, t_abs, road_amp, road_freq, Ms, Mus, Kus, Bus)
    Ks = x(5); Bs = x(6); phi_r = x(7);
    F = zeros(7,7);
    F(1,3)=1;  F(1,4)=-1;
    F(2,4)=1;
    F(3,1)=-Ks/Ms;    F(3,3)=-Bs/Ms;    F(3,4)=Bs/Ms;
    F(3,5)=-x(1)/Ms;  F(3,6)=-(x(3)-x(4))/Ms;
    F(4,1)=Ks/Mus;    F(4,2)=-Kus/Mus;
    F(4,3)=Bs/Mus;    F(4,4)=-(Bs+Bus)/Mus;
    F(4,5)=x(1)/Mus;  F(4,6)=(x(3)-x(4))/Mus;
    % 7th column: ∂f/∂phi_r — road phase Jacobian
    % d(zr_dot)/d(phi_r) = -A*ω*sin(ω*t + phi_r)
    % ∂dx(2)/∂phi_r = +A*ω*sin(ω*t + phi_r)
    % ∂dx(4)/∂phi_r = -(Bus/Mus)*A*ω*sin(ω*t + phi_r)
    zr_sin = road_amp * road_freq * sin(road_freq * t_abs + phi_r);
    F(2,7) =  zr_sin;
    F(4,7) = -(Bus/Mus) * zr_sin;
end
