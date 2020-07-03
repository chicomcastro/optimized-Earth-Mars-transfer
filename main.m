% This script run all rotines needed to provide a minimal coust estimation
% for a Earth-Mars transfer throught a PSO algorithm paremeter optimization

% Define optimization parameters
max_iteration = 100;                                % Iteractions to run
num_particles = 100;                                % Particles in swarm
lower_boundary = [0 0 0 0 0 0 0];                   % Lower boundary
upper_boundary = [2*pi 2*pi 2*pi 2*pi 30 365 30];   % Upper boundary

% Run optimization
tic
pso;
execution_time = toc;
disp("Elapsed time was " + execution_time + "seconds.")

% Print bests results
disp("Best global values: ");
disp(best_global);
disp("Minimal coust found: " + custo(best_global) + " km/s");

% Create a table with the data and variable names to store
T_to_append = table(...
    custo(best_global), ...
    best_global(1), ...
    best_global(2), ...
    best_global(3), ...
    best_global(4), ...
    best_global(5), ...
    best_global(6), ...
    best_global(7), ...
    hyperparams.num_particles, ...
    max_iteration, ...
    execution_time, ...
    'VariableNames', ...
        { ...
        'total_coust', ...
        'theta_a', ...
        'theta_b', ...
        'theta_c', ...
        'theta_d', ...
        't_ab', ...
        't_bc', ...
        't_cd', ...
        'num_particles', ...
        'max_iterations',...
        'execution_time'...
        } ...
);

output_file_name = 'results.txt';
if exist('T','var') == 1
    T = [T; T_to_append];
elseif exist(output_file_name, 'file') == 2
    T = readtable(output_file_name);
else
    T = T_to_append;
end

% Write data to text file
writetable(T, output_file_name);
