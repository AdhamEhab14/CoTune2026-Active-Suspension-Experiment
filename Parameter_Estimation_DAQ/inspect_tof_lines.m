open_system('Param_est_model');

function trace_simscape(blk)
    ph = get_param(blk, 'PortHandles');
    disp(['--- ' blk ' ---']);
    conns = [ph.LConn ph.RConn];
    for i=1:length(conns)
        line = get_param(conns(i), 'Line');
        if line ~= -1
            src = get_param(line, 'SrcPortHandle');
            dsts = get_param(line, 'DstPortHandle'); % Can be array
            for j=1:length(dsts)
                if src == conns(i)
                    other_port = dsts(j);
                elseif dsts(j) == conns(i)
                    other_port = src;
                else
                    continue;
                end
                other_blk = get_param(other_port, 'Parent');
                disp(['Port connected to: ' other_blk]);
            end
        end
    end
end

trace_simscape('Param_est_model/Bottom-Middle ToF');
trace_simscape('Param_est_model/Middle-Top ToF');
exit;
