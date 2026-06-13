open_system('Param_est_model');
tof1 = 'Param_est_model/Bottom-Middle ToF';
pc1 = get_param(tof1, 'PortConnectivity');
for i=1:length(pc1)
    if ~isempty(pc1(i).DstBlock)
        if iscell(pc1(i).DstBlock)
            fprintf('Port Type: %s, Connects to: %s\n', string(pc1(i).Type), get_param(pc1(i).DstBlock{1}, 'Name'));
        else
            fprintf('Port Type: %s, Connects to: %s\n', string(pc1(i).Type), get_param(pc1(i).DstBlock, 'Name'));
        end
    end
end

tof2 = 'Param_est_model/Middle-Top ToF';
pc2 = get_param(tof2, 'PortConnectivity');
for i=1:length(pc2)
    if ~isempty(pc2(i).DstBlock)
        if iscell(pc2(i).DstBlock)
            fprintf('Middle-Top Port Type: %s, Connects to: %s\n', string(pc2(i).Type), get_param(pc2(i).DstBlock{1}, 'Name'));
        else
            fprintf('Middle-Top Port Type: %s, Connects to: %s\n', string(pc2(i).Type), get_param(pc2(i).DstBlock, 'Name'));
        end
    end
end
exit;
