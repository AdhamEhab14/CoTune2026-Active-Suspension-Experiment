try
    open_system('Param_est_model');
    
    % Get position of Out1 and Out2
    pos_out1 = get_param('Param_est_model/Out1', 'Position');
    pos_out2 = get_param('Param_est_model/Out2', 'Position');
    
    % Move Gain blocks right before the Outports
    gain_pos1 = [pos_out1(1)-60, pos_out1(2)-10, pos_out1(1)-30, pos_out1(4)+10];
    gain_pos2 = [pos_out2(1)-60, pos_out2(2)-10, pos_out2(1)-30, pos_out2(4)+10];
    
    set_param('Param_est_model/Gain_ToF1', 'Position', gain_pos1);
    set_param('Param_est_model/Gain_ToF2', 'Position', gain_pos2);
    
    save_system('Param_est_model');
    disp('Successfully repositioned Gain blocks.');
catch ME
    disp(ME.message);
end
exit;
