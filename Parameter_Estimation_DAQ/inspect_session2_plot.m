load('Set2_ma2bolv2_7.mat');
ws = SDOSessionData.Data.Workspace.LocalWorkspace;
disp('Parameters estimated in Set2_ma2bolv2_7:');
try
    params = ws.Set2_ma2bolv2_7.Parameters;
    for i=1:length(params)
        disp([params(i).Name ' = ' num2str(params(i).Value)]);
        assignin('base', params(i).Name, params(i).Value);
    end
catch ME
    disp(ME.message);
end

% Ensure masses are base variables for simulation
assignin('base', 'Ms', 2.5);
assignin('base', 'Mus', 0.8);

try
    load('DATA_ACCQ_SUSPENSION.mat');
    suffix = '_2'; dt = 0.01; fc = 5; fs = 1 / dt; [b, a] = butter(2, fc/(fs/2)); 
    shift_tof = 2; shift_mpu = 1;
    
    raw_tof1 = double(pos1_raw_2);
    raw_tof2 = double(pos2_raw_2);
    raw_acc1 = double(acc1_raw_2);
    raw_acc2 = double(acc2_raw_2);
    raw_enc  = double(raw_encoder_mm_2);
    
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
    
    ToF1_target = timeseries(aligned_tof1(1:valid_len), t_valid);
    ToF2_target = timeseries(aligned_tof2(1:valid_len), t_valid);
    Acc1_target = timeseries(aligned_acc1(1:valid_len), t_valid);
    Acc2_target = timeseries(aligned_acc2(1:valid_len), t_valid);
    road_velocity = timeseries(enc_vel_mps(1:valid_len), t_valid);
    
    in = Simulink.SimulationInput('Param_est_model');
    in = in.setModelParameter('StopTime', num2str(t_valid(end)));
    ds = Simulink.SimulationData.Dataset;
    ds{1} = road_velocity;
    in = in.setExternalInput(ds);
    out = sim(in);
    
    sim_tof1 = out.yout{1}.Values;
    sim_tof2 = out.yout{2}.Values;
    sim_acc1 = out.yout{3}.Values;
    sim_acc2 = out.yout{4}.Values;
    
    fig = figure('Position', [100, 100, 1000, 800], 'Visible', 'off');
    subplot(4,1,1);
    plot(ToF1_target.Time, ToF1_target.Data, 'b', 'LineWidth', 1.2); hold on;
    plot(sim_tof1.Time, sim_tof1.Data, 'r--', 'LineWidth', 1.2);
    title('ToF1 (Bottom-Mid)'); grid on;
    
    subplot(4,1,2);
    plot(ToF2_target.Time, ToF2_target.Data, 'b', 'LineWidth', 1.2); hold on;
    plot(sim_tof2.Time, sim_tof2.Data, 'r--', 'LineWidth', 1.2);
    title('ToF2 (Mid-Top)'); grid on;
    
    subplot(4,1,3);
    plot(Acc1_target.Time, Acc1_target.Data, 'b', 'LineWidth', 1.2); hold on;
    plot(sim_acc1.Time, sim_acc1.Data, 'r--', 'LineWidth', 1.2);
    title('Acc1 (Top)'); grid on;
    
    subplot(4,1,4);
    plot(Acc2_target.Time, Acc2_target.Data, 'b', 'LineWidth', 1.2); hold on;
    plot(sim_acc2.Time, sim_acc2.Data, 'r--', 'LineWidth', 1.2);
    title('Acc2 (Mid)'); grid on;
    
    saveas(fig, 'full_ma2bolv2_check.png');
    disp('Saved full_ma2bolv2_check.png');
catch ME
    disp(ME.message);
end
exit;
