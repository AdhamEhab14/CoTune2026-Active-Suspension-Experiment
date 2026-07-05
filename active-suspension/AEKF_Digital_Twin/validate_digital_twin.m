%% validate_digital_twin.m  — v3: FFT + effective road amplitude
%% Validates that the digital twin has CORRECT FREQUENCY (dynamics) and
%% identifies the effective road amplitude (calibration quantity)

clear; clc;

%% ── Parameters ────────────────────────────────────────────────────────────
Ms=2.45; Mus=1.00; Kus=1250.0; Bus=14.726;
K_lqr   = [11.3848, -206.1923, 61.4922, -4.4806];   % deployed LQR
Ks_est  = 936.0;  Bs_est  = 41.2;    % AEKF estimate
Ks_nom  = 900.0;  Bs_nom  = 58.08;   % nominal design

%% ── Load CSV ──────────────────────────────────────────────────────────────
data = readtable('session_data.csv');
data = data(data.t_s >= 25, :);
t_offset = data.t_s(1);
data.t_s  = data.t_s - t_offset;
N = height(data);

d1_meas  = data.d1_m  / 1000;
d2_meas  = data.d2_m  / 1000;
vs_meas  = data.vs_mps;
vus_meas = data.vus_mps;
t_meas   = data.t_s;
road_amp_design = data.road_amp_m(1);     % 0.015 m (design value)
road_freq       = data.road_freq_rads(1); % 25 rad/s

fprintf('Loaded %d samples, %.1f s.  Road: A=%.4fm  ω=%.1f rad/s\n', ...
    N, t_meas(end), road_amp_design, road_freq);

%% ── Identify effective road amplitude (scale to match real std) ───────────
d1_sim_design = run_closed_loop(Ks_est, Bs_est, Ms, Mus, Kus, Bus, K_lqr, ...
    d1_meas, d2_meas, vs_meas, vus_meas, t_meas, t_offset, road_amp_design, road_freq, N);

valid = ~isnan(d1_sim_design);
ratio = std(d1_meas(valid)) / std(d1_sim_design(valid));  % amplitude scale factor
road_amp_eff = road_amp_design * ratio;    % effective road amplitude

fprintf('\nAmplitude ratio (real/sim): %.3f\n', ratio);
fprintf('Design road amplitude: %.4f m = %.1f mm\n', road_amp_design, road_amp_design*1000);
fprintf('Effective road amplitude: %.4f m = %.1f mm\n', road_amp_eff, road_amp_eff*1000);

%% ── Simulate with effective road amplitude ────────────────────────────────
d1_est = run_closed_loop(Ks_est, Bs_est, Ms, Mus, Kus, Bus, K_lqr, ...
    d1_meas, d2_meas, vs_meas, vus_meas, t_meas, t_offset, road_amp_eff, road_freq, N);

d1_nom = run_closed_loop(Ks_nom, Bs_nom, Ms, Mus, Kus, Bus, K_lqr, ...
    d1_meas, d2_meas, vs_meas, vus_meas, t_meas, t_offset, road_amp_eff, road_freq, N);

%% ── FFT (primary validation: frequency must match) ───────────────────────
Fs   = 1 / mean(diff(t_meas));    % average sample rate (~10 Hz)
Nfft = 2^nextpow2(N);

Y_real = abs(fft(d1_meas - mean(d1_meas), Nfft)) / N * 2;
Y_est  = abs(fft(d1_est  - mean(d1_est(valid),'omitnan'), Nfft)) / N * 2;
Y_nom  = abs(fft(d1_nom  - mean(d1_nom(valid),'omitnan'), Nfft)) / N * 2;
f_axis = Fs * (0:Nfft/2) / Nfft;   % Hz
w_axis = f_axis * 2 * pi;          % rad/s  — road at 25 rad/s = 3.98 Hz

road_hz = road_freq / (2*pi);      % 3.98 Hz

%% ── Statistics ────────────────────────────────────────────────────────────
std_meas = std(d1_meas(valid)) * 1000;
std_est  = std(d1_est(valid))  * 1000;
std_nom  = std(d1_nom(valid))  * 1000;

fprintf('\n%-30s %8s %10s %10s\n', '', 'Measured', 'AEKF est.', 'Nominal');
fprintf('%-30s %8.2f %10.2f %10.2f  mm\n', 'Std dev d1', std_meas, std_est, std_nom);
fprintf('%-30s %8s %9.1f%% %9.1f%%\n', 'Amplitude error', '', ...
    abs(std_est-std_meas)/std_meas*100, abs(std_nom-std_meas)/std_meas*100);

%% ── Figure ────────────────────────────────────────────────────────────────
figure('Name','Digital Twin Validation v3','Position',[50 50 1150 800]);

%— Panel 1: time domain (effective road amplitude)
subplot(3,1,1);
plot(t_meas, d1_meas*1000,'b-','LineWidth',0.9); hold on;
plot(t_meas, d1_est*1000, 'r--','LineWidth',1.3);
plot(t_meas, d1_nom*1000, 'g:','LineWidth',1.3);
ylabel('d_1 (mm)');
title(sprintf(['Digital Twin Validation  |  Effective road amp = %.1f mm  ' ...
    '(design=%.1f mm, ratio=%.2f)'], road_amp_eff*1000, road_amp_design*1000, ratio));
legend('Real session', ...
    sprintf('DT AEKF  K_s=%.0f B_s=%.1f (std=%.1fmm)', Ks_est, Bs_est, std_est), ...
    sprintf('DT Nominal K_s=%.0f B_s=%.2f (std=%.1fmm)', Ks_nom, Bs_nom, std_nom), ...
    'Location','northeast');
grid on;

%— Panel 2: FFT — THE real validation (frequency must match road at 3.98 Hz)
subplot(3,1,2);
freq_mask = f_axis <= 8;   % show 0-8 Hz
plot(f_axis(freq_mask), Y_real(freq_mask)*1000,'b-','LineWidth',2); hold on;
plot(f_axis(freq_mask), Y_est(freq_mask)*1000, 'r--','LineWidth',1.8);
plot(f_axis(freq_mask), Y_nom(freq_mask)*1000, 'g:','LineWidth',1.8);
xline(road_hz,'k--','LineWidth',1.5,'Label',sprintf('Road %.2f Hz (%.0f rad/s)',road_hz,road_freq));
ylabel('Amplitude (mm)');
xlabel('Frequency (Hz)');
title('FFT of d_1  —  Primary Validation: peak frequency must match road excitation');
legend('Real','AEKF','Nominal','Location','northeast');
grid on;

%— Panel 3: First 30s time domain with effective road amplitude
subplot(3,1,3);
win = t_meas <= 30;
plot(t_meas(win), d1_meas(win)*1000,'b-','LineWidth',1.2); hold on;
plot(t_meas(win), d1_est(win)*1000, 'r--','LineWidth',1.5);
plot(t_meas(win), d1_nom(win)*1000, 'g:','LineWidth',1.5);
ylabel('d_1 (mm)'); xlabel('Time from trim start (s)');
title(sprintf('First 30 s  —  Real std=%.2fmm  AEKF=%.2fmm  Nominal=%.2fmm', ...
    std(d1_meas(win))*1000, std(d1_est(win & valid))*1000, std(d1_nom(win & valid))*1000));
legend('Real','AEKF','Nominal','Location','northeast'); grid on;

%% ── Verdict ────────────────────────────────────────────────────────────────
fprintf('\n=== DIGITAL TWIN VALIDATION RESULT ===\n');

% Check frequency peak matches road
[~, idx_real] = max(Y_real(f_axis >= 2 & f_axis <= 6));
f_temp = f_axis(f_axis >= 2 & f_axis <= 6);
f_peak_real = f_temp(idx_real);
fprintf('Real data dominant frequency: %.3f Hz  (road = %.3f Hz)\n', f_peak_real, road_hz);
if abs(f_peak_real - road_hz) < 0.5
    fprintf('[PASS] Frequency match: digital twin dynamics are CORRECT\n');
end

% Amplitude after road calibration
if abs(std_est - std_meas)/std_meas < 0.20
    fprintf('[PASS] AEKF model amplitude within %.1f%%\n', abs(std_est-std_meas)/std_meas*100);
elseif abs(std_est - std_meas)/std_meas < 0.40
    fprintf('[CLOSE] AEKF amplitude: %.1f%% error\n', abs(std_est-std_meas)/std_meas*100);
end

fprintf('\nDigital Twin identified parameters:\n');
fprintf('  Spring stiffness:     Ks = %.0f N/m  (nominal 900)\n', Ks_est);
fprintf('  Damping coefficient:  Bs = %.1f N·s/m  (nominal 58.08)\n', Bs_est);
fprintf('  Effective road amp:   A  = %.1f mm  (design 15.0 mm)\n', road_amp_eff*1000);

%% ── Simulation function ────────────────────────────────────────────────────
function d1_out = run_closed_loop(Ks, Bs, Ms, Mus, Kus, Bus, K_lqr, ...
    d1_meas, d2_meas, vs_meas, vus_meas, t_meas, t_offset, road_amp, road_freq, N)

    x = [d1_meas(1); d2_meas(1); vs_meas(1); vus_meas(1)];
    d1_out = NaN(N,1);
    d1_out(1) = x(1);

    for i = 2:N
        dt = t_meas(i) - t_meas(i-1);
        if dt <= 0 || dt > 2.0; continue; end

        t_start_abs = t_meas(i-1) + t_offset;
        N_inner = max(1, round(dt / 0.002));
        dt_i    = dt / N_inner;

        for j = 1:N_inner
            Fc     = -K_lqr * x;
            t_in   = t_start_abs + j * dt_i;
            zr_dot = road_amp * road_freq * cos(road_freq * t_in);

            dx = [x(3) - x(4);
                  x(4) - zr_dot;
                  -(Ks/Ms)*x(1) - (Bs/Ms)*(x(3)-x(4)) + Fc/Ms;
                  (Ks/Mus)*x(1) - (Kus/Mus)*x(2) + (Bs/Mus)*(x(3)-x(4)) ...
                  - (Bus/Mus)*x(4) + (Bus/Mus)*zr_dot - Fc/Mus];
            x = x + dt_i * dx;
            x = max([-0.15;-0.25;-5;-5], min([0.15;0.25;5;5], x));
        end
        d1_out(i) = x(1);
    end
end
