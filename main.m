%% Main
% This script run all rotines needed to provide a minimal coust estimation
% for a Earth-Mars transfer throught a PSO algorithm paremeter optimization

format short g

%% Simulation parameters
global venus_swing_by
venus_swing_by = 0;
simula_progredindo = 1;

%% Inputs
% Define optimization parameters
max_iteration = 100;                                  % Iteractions to run
num_particles = 100;                                  % Particles in swarm

clear lower_boundary upper_boundary
% Posição dos planetas
lower_boundary.phase_venus = 0;
upper_boundary.phase_venus = 2*pi;
lower_boundary.phase_marte = 0;
upper_boundary.phase_marte = 2*pi;

% Tempos de transferência
% Com swing by
lower_boundary.t_terra_venus = 30;
upper_boundary.t_terra_venus = 180;
lower_boundary.t_venus_marte = 30;
upper_boundary.t_venus_marte = 240;

lower_boundary.rp = 0.05;
upper_boundary.rp = 1;

% Sem swing by
lower_boundary.t_terra_marte = 120;
upper_boundary.t_terra_marte = 360;
%%
lower_boundary = struct_2_boundary(lower_boundary);
upper_boundary = struct_2_boundary(upper_boundary); % Upper boundary

%% Optimization
% Run optimization
if venus_swing_by swing_by = "com"; else swing_by = "sem"; end
if simula_progredindo progressao = "com"; else progressao = "sem"; end
disp("<<< Simulação " + swing_by + " swing-by " + progressao + " progressão >>>");
tentativa = 0;
while true
    disp("Tentativa: " + tentativa);
    disp("Rodando para num_particles = " + num_particles);
    tic
    pso;
    execution_time = toc;
    disp("Elapsed time was " + execution_time + "seconds.")

    %% Results
    % Print bests results
    disp("Best global values: ");
    disp(best_global);
    disp("Minimal coust found: " + custo(best_global) + " km/s");

    %% Storage
    % Create a table with the data and variable names to store
    data_to_store = [
        custo(best_global), ...
        best_global(:)', ...
        num_particles, ...
        max_iteration, ...
        execution_time
    ];
    T_to_append = array2table(...
        data_to_store...
    );
    %% Load current existing data
    
    if venus_swing_by == 1
        data_title = "-swing-by";
    else
        data_title = "-direct-transfer";
    end

    output_file_name = "results" + data_title + ".txt";

    if exist('T','var') == 1
        T = [T; T_to_append];
    elseif exist(output_file_name, 'file') == 2
        T = readtable(output_file_name);
    else
        T = T_to_append;
    end

    %% Write data to text file
    writetable(T, output_file_name);

    %% Images
    % call Plotter for x = best_global
    tentativa = tentativa + 1;
    if tentativa > 10 && simula_progredindo == 1
        num_particles = num_particles * 10;
        tentativa = 0;
    end
end
