% Script to plot simulated vs measured data and save as PNG
try
    % Ensure parameters are in workspace
    assignin('base', 'Ms', 2.5); % Assuming some nominal mass
    assignin('base', 'Mus', 0.8);
    assignin('base', 'Ks', 900);
    assignin('base', 'Kus', 1250);
    assignin('base', 'Cs', 10);
    assignin('base', 'Cus', 10);
    
    % Setup simulation input
    in = Simulink.SimulationInput('Param_est_model');
    in = in.setModelParameter('StopTime', num2str(road_velocity_ts.Time(end)));
    
    % Prepare dataset for input
    ds = Simulink.SimulationData.Dataset;
    ds{1} = road_velocity_ts;
    in = in.setExternalInput(ds);
    
    % Run simulation
    out = sim(in);
    
    % Extract simulated data
    % Assuming Out1 = ToF1 (Top pos), Out2 = ToF2 (Mid pos), Out3 = Acc1 (Top acc), Out4 = Acc2 (Mid acc)
    sim_tof1 = out.yout{1}.Values;
    sim_tof2 = out.yout{2}.Values;
    sim_acc1 = out.yout{3}.Values;
    sim_acc2 = out.yout{4}.Values;
    
    % Create plot
    fig = figure('Position', [100, 100, 1200, 800], 'Visible', 'off');
    
    subplot(4,1,1);
    plot(ToF1_target_ts.Time, ToF1_target_ts.Data, 'b', 'LineWidth', 1.5); hold on;
    plot(sim_tof1.Time, sim_tof1.Data, 'r--', 'LineWidth', 1.5);
    title('ToF1 (Top Position): Measured vs Simulated');
    legend('Measured (Aligned)', 'Simulated');
    grid on;
    
    subplot(4,1,2);
    plot(ToF2_target_ts.Time, ToF2_target_ts.Data, 'b', 'LineWidth', 1.5); hold on;
    plot(sim_tof2.Time, sim_tof2.Data, 'r--', 'LineWidth', 1.5);
    title('ToF2 (Mid Position): Measured vs Simulated');
    legend('Measured (Aligned)', 'Simulated');
    grid on;
    
    subplot(4,1,3);
    plot(Acc1_target_ts.Time, Acc1_target_ts.Data, 'b', 'LineWidth', 1.5); hold on;
    plot(sim_acc1.Time, sim_acc1.Data, 'r--', 'LineWidth', 1.5);
    title('Acc1 (Top Acceleration): Measured vs Simulated');
    legend('Measured (Aligned)', 'Simulated');
    grid on;
    
    subplot(4,1,4);
    plot(Acc2_target_ts.Time, Acc2_target_ts.Data, 'b', 'LineWidth', 1.5); hold on;
    plot(sim_acc2.Time, sim_acc2.Data, 'r--', 'LineWidth', 1.5);
    title('Acc2 (Mid Acceleration): Measured vs Simulated');
    legend('Measured (Aligned)', 'Simulated');
    grid on;
    
    % Save plot
    saveas(fig, 'sim_vs_measured.png');
    disp('Successfully created sim_vs_measured.png');
catch ME
    disp(['Error: ' ME.message]);
    for k=1:length(ME.stack)
        disp(['  In ' ME.stack(k).name ' at line ' num2str(ME.stack(k).line)]);
    end
end
exit;
