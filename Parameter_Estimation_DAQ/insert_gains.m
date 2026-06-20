try
    open_system('Param_est_model');
    
    % Fix ToF 1 (Out1)
    cvt1 = 'Param_est_model/PS-Simulink Converter'; % assuming this feeds Out1
    out1 = 'Param_est_model/Out1';
    
    % Find the line between cvt1 and out1
    ph_cvt1 = get_param(cvt1, 'PortHandles');
    ph_out1 = get_param(out1, 'PortHandles');
    line1 = get_param(ph_out1.Inport(1), 'Line');
    delete_line(line1);
    
    add_block('simulink/Math Operations/Gain', 'Param_est_model/Gain_ToF1');
    set_param('Param_est_model/Gain_ToF1', 'Gain', '-1');
    
    add_line('Param_est_model', 'PS-Simulink Converter/1', 'Gain_ToF1/1');
    add_line('Param_est_model', 'Gain_ToF1/1', 'Out1/1');
    
    % Fix ToF 2 (Out2)
    cvt2 = 'Param_est_model/PS-Simulink Converter1'; % assuming this feeds Out2
    out2 = 'Param_est_model/Out2';
    
    ph_cvt2 = get_param(cvt2, 'PortHandles');
    ph_out2 = get_param(out2, 'PortHandles');
    line2 = get_param(ph_out2.Inport(1), 'Line');
    delete_line(line2);
    
    add_block('simulink/Math Operations/Gain', 'Param_est_model/Gain_ToF2');
    set_param('Param_est_model/Gain_ToF2', 'Gain', '-1');
    
    add_line('Param_est_model', 'PS-Simulink Converter1/1', 'Gain_ToF2/1');
    add_line('Param_est_model', 'Gain_ToF2/1', 'Out2/1');
    
    save_system('Param_est_model');
    disp('Successfully inserted Gain blocks to invert ToF signals.');
catch ME
    disp(['Error: ' ME.message]);
end
exit;
