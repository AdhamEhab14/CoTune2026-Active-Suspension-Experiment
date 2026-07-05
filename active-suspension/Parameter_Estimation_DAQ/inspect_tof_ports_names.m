open_system('Param_est_model');
pc = get_param('Param_est_model/Bottom-Middle ToF', 'PortConnectivity');
for i=1:length(pc)
    disp(['Port ' num2str(i) ' (' pc(i).Type '):']);
    if ~isempty(pc(i).DstBlock)
        dsts = pc(i).DstBlock;
        for j=1:length(dsts)
            name = get_param(dsts(j), 'Name');
            if iscell(name), name = name{1}; end
            disp(['  -> ' name]);
        end
    end
end
exit;
