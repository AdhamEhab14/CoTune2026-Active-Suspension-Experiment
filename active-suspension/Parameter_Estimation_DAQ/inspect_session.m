load('Param_est_model_spesession2.mat');
try
    % Try to get optimized parameters
    disp(SDOSessionData.EstimationWorkspaces(end).Variables);
catch
    disp('Could not extract variables from workspace directly.');
end

try
    params = SDOSessionData.OptimizedParameters;
    for i=1:length(params)
        disp([params(i).Name ' = ' num2str(params(i).Value)]);
    end
catch
end
exit;
