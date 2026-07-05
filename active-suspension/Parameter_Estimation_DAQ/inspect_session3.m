load('Param_est_model_spesession2.mat');
data = SDOSessionData.Data;
disp(properties(data));
try
    disp(data.Parameters);
catch
end
try
    disp(data.Workspaces);
catch
end
exit;
