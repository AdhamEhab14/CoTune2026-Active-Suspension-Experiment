try
    open_system('Param_est_model');
    
    % Find lines connected to Gain_ToF2
    ph_gain2 = get_param('Param_est_model/Gain_ToF2', 'PortHandles');
    line_in = get_param(ph_gain2.Inport(1), 'Line');
    line_out = get_param(ph_gain2.Outport(1), 'Line');
    
    % Delete the lines
    delete_line(line_in);
    delete_line(line_out);
    
    % Delete the block
    delete_block('Param_est_model/Gain_ToF2');
    
    % Reconnect
    add_line('Param_est_model', 'PS-Simulink Converter1/1', 'Out2/1');
    
    save_system('Param_est_model');
    disp('Successfully removed Gain_ToF2 and restored connection to Out2.');
catch ME
    disp(['Error: ' ME.message]);
end
exit;
