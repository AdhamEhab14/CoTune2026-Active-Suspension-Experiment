try
    open_system('Param_est_model');
    blocks = find_system('Param_est_model', 'SearchDepth', 1, 'BlockType', 'Gain');
    disp('Gain blocks found:');
    disp(blocks);
    
    % Let's check positions
    for i=1:length(blocks)
        pos = get_param(blocks{i}, 'Position');
        disp([blocks{i} ' position: ' num2str(pos)]);
    end
catch ME
    disp(ME.message);
end
exit;
