open_system('Param_est_model');

% Let's use Simscape API or just delete lines and add lines.
% We can find lines connected to a specific port and delete them.
% Function to get LConn/RConn of a block:
function ports = get_simscape_ports(blk)
    ph = get_param(blk, 'PortHandles');
    ports.L = ph.LConn;
    ports.R = ph.RConn;
end

% Delete lines connected to C port of ToF1 (Bottom-Middle)
% Assuming LConn(2) is C, LConn(1) is R.
% Wait, let's just hilite the blocks or find the connected line.
ph1 = get_param('Param_est_model/Bottom-Middle ToF', 'PortHandles');
% ToF1 has 1 LConn and 2 RConns according to previous output!
% Wait, previously:
% Bottom-Middle ToF ports:
% Type: LConn1 (Has DstBlock)
% Type: RConn1 (Has DstBlock)
% Type: RConn2 (Has DstBlock)
% This means it only has 1 LConn and 2 RConns.
% For `foundation.mechanical.sensors.velocity`, normally:
% R is LConn, C is RConn? Or V and P are RConn.

% Let's list the port names.
exit;