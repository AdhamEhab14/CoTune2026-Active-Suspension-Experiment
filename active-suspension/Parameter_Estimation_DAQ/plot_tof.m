% Plot current parameter estimator results vs measured
try
    assignin('base', 'Ms', 2.5); % Assuming some nominal mass
    assignin('base', 'Mus', 0.8);
    assignin('base', 'Ks', 2770.8);
    assignin('base', 'Kus', 1807.6);
    assignin('base', 'Cs', 33.831);
    assignin('base', 'Cus', 17.643);

    load('DATA_ACCQ_SUSPENSION.mat');
    
    % Recreate Set 1 (or load from workspace if available, but doing it here to be safe)
    suffix = '';
    dt = 0.01;
    fc = 5; 
    fs = 1 / dt; 
    [b, a] = butter(2, fc/(fs/2)); 
    shift_tof = 2; shift_mpu = 1;
    
    eval(['raw_tof1 = double(pos1_raw' suffix ');']);
    eval(['raw_tof2 = double(pos2_raw' suffix ');']);
    eval(['raw_acc1 = double(acc1_raw' suffix ');']);
    eval(['raw_acc2 = double(acc2_raw' suffix ');']);
    eval(['raw_enc  = double(raw_encoder_mm' suffix ');']);
    
    t = (0:dt:(length(raw_enc)-1)*dt)';
    
    clean_tof1 = filtfilt(b, a, raw_tof1);
    clean_tof2 = filtfilt(b, a, raw_tof2);
    clean_acc1 = filtfilt(b, a, raw_acc1);
    clean_acc2 = filtfilt(b, a, raw_acc2);
    clean_enc  = filtfilt(b, a, raw_enc);
    
    enc_vel_mps = zeros(size(clean_enc));
    enc_vel_mps(2:end-1) = (clean_enc(3:end) - clean_enc(1:end-2)) ./ (2*dt);
    enc_vel_mps(1)       = (clean_enc(2) - clean_enc(1)) ./ dt;
    enc_vel_mps(end)     = (clean_enc(end) - clean_enc(end-1)) ./ dt;
    enc_vel_mps = enc_vel_mps / 1000;
    
    centered_tof1_m = clean_tof1 - mean(clean_tof1(1:100));
    centered_tof2_m = clean_tof2 - mean(clean_tof2(1:100));
    centered_acc1   = -(clean_acc1 - mean(clean_acc1(1:100)));
    centered_acc2   = -(clean_acc2 - mean(clean_acc2(1:100)));
    
    aligned_tof1 = [centered_tof1_m(shift_tof+1:end); zeros(shift_tof, 1)];
    aligned_tof2 = [centered_tof2_m(shift_tof+1:end); zeros(shift_tof, 1)];
    aligned_acc1 = [centered_acc1(shift_mpu+1:end); zeros(shift_mpu, 1)];
    aligned_acc2 = [centered_acc2(shift_mpu+1:end); zeros(shift_mpu, 1)];
    
    valid_len = length(t) - max(shift_tof, shift_mpu);
    t_valid = t(1:valid_len);
    
    % Crop to 3.5 seconds as ToF data dies after that
    idx_3_5 = find(t_valid <= 3.5, 1, 'last');
    t_valid = t_valid(1:idx_3_5);
    aligned_tof1 = aligned_tof1(1:idx_3_5);
    aligned_tof2 = aligned_tof2(1:idx_3_5);
    aligned_acc1 = aligned_acc1(1:idx_3_5);
    aligned_acc2 = aligned_acc2(1:idx_3_5);
    enc_vel_mps = enc_vel_mps(1:idx_3_5);
    
    ToF1_target = timeseries(aligned_tof1, t_valid);
    ToF2_target = timeseries(aligned_tof2, t_valid);
    Acc1_target = timeseries(aligned_acc1, t_valid);
    Acc2_target = timeseries(aligned_acc2, t_valid);
    road_velocity = timeseries(enc_vel_mps, t_valid);
    
    in = Simulink.SimulationInput('Param_est_model');
    in = in.setModelParameter('StopTime', num2str(3.5));
    ds = Simulink.SimulationData.Dataset;
    ds{1} = road_velocity;
    in = in.setExternalInput(ds);
    out = sim(in);
    
    sim_tof1 = out.yout{1}.Values;
    sim_tof2 = out.yout{2}.Values;
    
    fig = figure('Position', [100, 100, 1000, 600], 'Visible', 'off');
    subplot(2,1,1);
    plot(ToF1_target.Time, ToF1_target.Data, 'b', 'LineWidth', 1.5); hold on;
    plot(sim_tof1.Time, sim_tof1.Data, 'r--', 'LineWidth', 1.5);
    title('ToF1 (Top): Measured vs Simulated');
    legend('Measured', 'Simulated'); grid on;
    
    subplot(2,1,2);
    plot(ToF2_target.Time, ToF2_target.Data, 'b', 'LineWidth', 1.5); hold on;
    plot(sim_tof2.Time, sim_tof2.Data, 'r--', 'LineWidth', 1.5);
    title('ToF2 (Mid): Measured vs Simulated');
    legend('Measured', 'Simulated'); grid on;
    
    saveas(fig, 'tof_mismatch.png');
    disp('Successfully saved tof_mismatch.png');
catch ME
    disp(['Error: ' ME.message]);
end
exit;
