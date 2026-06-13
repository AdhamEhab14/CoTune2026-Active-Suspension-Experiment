load('Param_est_model_spesession2.mat');
disp(properties(SDOSessionData));
disp(properties(SDOSessionData.Workspaces));
ws = SDOSessionData.Workspaces;
for i=1:length(ws)
    disp(ws(i).Name);
end
ws1 = ws(1);
disp(properties(ws1));
disp(ws1.Variables);
exit;
