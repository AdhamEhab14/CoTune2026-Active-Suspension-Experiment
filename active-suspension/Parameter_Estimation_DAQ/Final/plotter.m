% =========================================================================
% THE ULTIMATE ACTIVE SUSPENSION THESIS PLOTTER (NO BLACK COLORS)
% =========================================================================

% 1. Extract and format the data from the Timeseries objects
time = d1_data.Time;
time = time - time(1); % Normalize time to start at 0

% Convert displacements from meters to millimeters for readability
d1       = d1_data.Data * 1000;      % Top plate relative gap
road_enc = road_data_enc.Data * 1000; % Actual road disturbance from encoder

% Velocities (keep in m/s)
vs  = vs_data.Data;  % Top plate absolute velocity (Sprung Mass)
vus = vus_data.Data; % Middle plate absolute velocity (Unsprung Mass)

% Control Effort
pwm = pwm_data.Data; % Cytron PWM command

% 2. Define a premium, "No-Black" color palette
color_road      = [0.55 0.55 0.60]; % Slate Gray
color_top_plate = [0.00 0.30 0.60]; % Deep Navy Blue
color_unsprung  = [0.85 0.33 0.10]; % Rich Orange
color_skyhook   = [0.49 0.18 0.56]; % Deep Purple
color_pwm       = [0.00 0.50 0.50]; % Dark Teal
color_text      = [0.20 0.25 0.30]; % Charcoal/Dark Blue-Gray (For titles)
color_line      = [0.80 0.10 0.10]; % Crimson Red (For the 'Controller ON' line)

% The time your Step block turned the LQR on
lqr_on_time = 10; 

% 3. Create the Master Figure
fig = figure('Name', 'Active Suspension Disturbance Rejection', ...
    'Color', 'w', 'Position', [100, 50, 950, 900]);

% -------------------------------------------------------------------------
% PLOT 1: Input vs Output (The Money Shot)
% Shows the road bouncing underneath while the top plate holds steady
% -------------------------------------------------------------------------
ax1 = subplot(3,1,1);
plot(time, road_enc, 'Color', color_road, 'LineWidth', 1.5);
hold on;
plot(time, d1, 'Color', color_top_plate, 'LineWidth', 2.0);
xl1 = xline(lqr_on_time, '--', 'Controller ON', 'Color', color_line, 'LineWidth', 2, 'LabelHorizontalAlignment', 'left', 'FontSize', 11);
xl1.FontColor = color_line;

grid on;
title('System Response: Road Disturbance vs. Sprung Mass', 'Color', color_text, 'FontSize', 14, 'FontWeight', 'bold');
ylabel('Displacement (mm)', 'Color', color_text, 'FontSize', 12, 'FontWeight', 'bold');
legend('Road (Encoder)', 'Top Plate ($d_1$)', 'Location', 'best', 'TextColor', color_text);
xlim([0 max(time)]);
ax1.XColor = color_text; ax1.YColor = color_text; % Color the axes lines

% -------------------------------------------------------------------------
% PLOT 2: The Skyhook Proof (Velocities)
% Proves the suspension absorbs the energy instead of transferring it
% -------------------------------------------------------------------------
ax2 = subplot(3,1,2);
plot(time, vus, 'Color', color_unsprung, 'LineWidth', 1.2); % Show the tire bouncing
hold on;
plot(time, vs, 'Color', color_skyhook, 'LineWidth', 2.0);   % Show the top plate freezing
xl2 = xline(lqr_on_time, '--', 'Color', color_line, 'LineWidth', 2);

grid on;
title('Absolute Velocities: Sprung vs. Unsprung Mass', 'Color', color_text, 'FontSize', 14, 'FontWeight', 'bold');
ylabel('Velocity (m/s)', 'Color', color_text, 'FontSize', 12, 'FontWeight', 'bold');
legend('Middle Plate ($v_{us}$)', 'Top Plate ($v_s$)', 'Location', 'best', 'TextColor', color_text);
xlim([0 max(time)]);
ax2.XColor = color_text; ax2.YColor = color_text;

% -------------------------------------------------------------------------
% PLOT 3: Control Effort (PWM)
% Proves your controller respects hardware limits
% -------------------------------------------------------------------------
ax3 = subplot(3,1,3);
plot(time, pwm, 'Color', color_pwm, 'LineWidth', 1.5);
hold on;
xl3 = xline(lqr_on_time, '--', 'Color', color_line, 'LineWidth', 2);

grid on;
title('Actuator Control Effort', 'Color', color_text, 'FontSize', 14, 'FontWeight', 'bold');
ylabel('PWM Command', 'Color', color_text, 'FontSize', 12, 'FontWeight', 'bold');
xlabel('Time (Seconds)', 'Color', color_text, 'FontSize', 12, 'FontWeight', 'bold');
xlim([0 max(time)]);
ax3.XColor = color_text; ax3.YColor = color_text;

% Set Y-limits for PWM just to make it look clean (Assuming 8-bit limits)
ylim([-270 270]); 

% 4. Final Polish: Apply global font settings
set(findall(fig, '-property', 'FontName'), 'FontName', 'Helvetica');
set(findall(fig, '-property', 'FontSize'), 'FontSize', 11);