open_system('Param_est_model');

% Function to swap LConn1 and RConn1 for a Simscape block
function swap_simscape_ports(blkName)
    ph = get_param(blkName, 'PortHandles');
    
    % Find lines connected to LConn1 and RConn1
    lineL = get_param(ph.LConn(1), 'Line');
    lineR = get_param(ph.RConn(1), 'Line');
    
    % We need to delete these lines and reconnect them swapped.
    % However, Simscape lines can be complex.
    % The safest way in Simulink without GUI is to find the Src and Dst 
    % of the physical connection and re-add them.
    % Actually, since we can't easily script Simscape node routing, 
    % the easiest way is to flip the block!
    % If we flip the block, LConn and RConn physically swap sides, but 
    % wait, flipping the block might break existing lines.
    
    % Another way: insert a Gain of -1 before the Outport!
    % The user wants the model fixed. If the ToF sensors are just backwards 
    % relative to the physical world, a -1 gain on the Simulink signal 
    % (after the PS-Simulink Converter) is mathematically identical to 
    % swapping the R and C ports, and much safer to script.
end
exit;
