function shouldStop = check_stopping_condition(iteration, max_iteration)
%Check if a analysis should stop
%   Passes max_iteration

if (iteration < max_iteration)
    shouldStop = false;
else
    shouldStop = true;
end

end

