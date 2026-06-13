open_system('Param_est_model');
ref = 'Param_est_model/Mechanical Translational Reference';
pc = get_param(ref, 'PortConnectivity');
for i=1:length(pc)
    if ~isempty(pc(i).DstBlock)
        dsts = pc(i).DstBlock;
        for j=1:length(dsts)
            name = get_param(dsts(j), 'Name');
            if iscell(name), name = name{1}; end
            disp(['Ref connects to: ' name]);
        end
    end
end
exit;
