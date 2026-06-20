% Data Processing Script for Parameter Estimation
% This script processes sets 1, 2, and 4.
% It applies zero-phase filtering, correct zero-centering, acceleration 
% sign inversion, and time-alignment to compensate for sensor delays.

load('DATA_ACCQ_SUSPENSION.mat');

% Define sets to process and their corresponding variable suffixes
suffixes = {'', '_2', '_4'};
set_numbers = {1, 2, 4}; % The ACTUAL set numbers
set_names = {'Set 1', 'Set 2', 'Set 4'};

% Common parameters
dt = 0.01;
fc = 15; 
fs = 1 / dt; 
[b, a] = butter(2, fc/(fs/2)); 

shift_tof = 2; % ~20ms delay for ToF
shift_mpu = 1; % ~10ms delay for MPU

for s = 1:length(suffixes)
    suffix = suffixes{s};
    set_num = set_numbers{s};
    fprintf('\nProcessing %s...\n', set_names{s});
    
    % 1. Load raw data for this set (and explicitly CAST to double)
    eval(['raw_tof1 = double(pos1_raw' suffix ');']);
    eval(['raw_tof2 = double(pos2_raw' suffix ');']);
    eval(['raw_acc1 = double(acc1_raw' suffix ');']);
    eval(['raw_acc2 = double(acc2_raw' suffix ');']);
    eval(['raw_enc  = double(raw_encoder_mm' suffix ');']);
    
    t = (0:dt:(length(raw_enc)-1)*dt)';
    
    % 2. Zero-Phase Filter
    clean_tof1 = filtfilt(b, a, raw_tof1);
    clean_tof2 = filtfilt(b, a, raw_tof2);
    clean_acc1 = filtfilt(b, a, raw_acc1);
    clean_acc2 = filtfilt(b, a, raw_acc2);
    clean_enc  = filtfilt(b, a, raw_enc);
    
    % 3. Calculate Road Velocity (Central Difference - ZERO LAG)
    enc_vel_mps = zeros(size(clean_enc));
    enc_vel_mps(2:end-1) = (clean_enc(3:end) - clean_enc(1:end-2)) ./ (2*dt);
    enc_vel_mps(1)       = (clean_enc(2) - clean_enc(1)) ./ dt;
    enc_vel_mps(end)     = (clean_enc(end) - clean_enc(end-1)) ./ dt;
    enc_vel_mps = enc_vel_mps / 1000; % Convert mm/s to m/s
    
    % 4. Zero-Centering 
    % Using the first 100 samples (1 second) to define the "zero" resting state
    centered_tof1_m = clean_tof1 - mean(clean_tof1(1:100));
    centered_tof2_m = clean_tof2 - mean(clean_tof2(1:100));
    
    % MPU zero-centering AND Sign Inversion (multiplying by -1 so UP is positive)
    centered_acc1   = -(clean_acc1 - mean(clean_acc1(1:100)));
    centered_acc2   = -(clean_acc2 - mean(clean_acc2(1:100)));
    
    % 5. Hardware Time-Alignment (Shift Arrays Backwards)
    aligned_tof1 = [centered_tof1_m(shift_tof+1:end); zeros(shift_tof, 1)];
    aligned_tof2 = [centered_tof2_m(shift_tof+1:end); zeros(shift_tof, 1)];
    
    aligned_acc1 = [centered_acc1(shift_mpu+1:end); zeros(shift_mpu, 1)];
    aligned_acc2 = [centered_acc2(shift_mpu+1:end); zeros(shift_mpu, 1)];
    
    % Truncate the padded zeros off the end
    valid_len = length(t) - max(shift_tof, shift_mpu);
    t_valid = t(1:valid_len);
    
    % 6. Export Timeseries for Estimator
    % Naming dynamically based on the true set number (e.g., ToF1_target_ts_Set4)
    eval(['ToF1_target_ts_Set' num2str(set_num) ' = timeseries(aligned_tof1(1:valid_len), t_valid);']);
    eval(['ToF2_target_ts_Set' num2str(set_num) ' = timeseries(aligned_tof2(1:valid_len), t_valid);']);
    eval(['Acc1_target_ts_Set' num2str(set_num) ' = timeseries(aligned_acc1(1:valid_len), t_valid);']);
    eval(['Acc2_target_ts_Set' num2str(set_num) ' = timeseries(aligned_acc2(1:valid_len), t_valid);']);
    eval(['road_velocity_ts_Set' num2str(set_num) ' = timeseries(enc_vel_mps(1:valid_len), t_valid);']);
    
    fprintf('✅ %s processed successfully.\n', set_names{s});
end

disp('All specified sets are ready for the Parameter Estimator!');
