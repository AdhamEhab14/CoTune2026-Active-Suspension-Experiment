open_system('Param_est_model');
tof1 = 'Param_est_model/Bottom-Middle ToF';
tof2 = 'Param_est_model/Middle-Top ToF';
pc1 = get_param(tof1, 'PortConnectivity');
disp('Bottom-Middle ToF ports:');
for i=1:length(pc1)
    disp(['Type: ' pc1(i).Type]);
    if ~isempty(pc1(i).SrcBlock), disp('Has SrcBlock'); end;
    if ~isempty(pc1(i).DstBlock), disp('Has DstBlock'); end;
end

pc2 = get_param(tof2, 'PortConnectivity');
disp('Middle-Top ToF ports:');
for i=1:length(pc2)
    disp(['Type: ' pc2(i).Type]);
    if ~isempty(pc2(i).SrcBlock), disp('Has SrcBlock'); end;
    if ~isempty(pc2(i).DstBlock), disp('Has DstBlock'); end;
end
exit;
