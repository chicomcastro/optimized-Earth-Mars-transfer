%% Main
% This script run all rotines needed to provide a minimal coust estimation
% for a Earth-Mars transfer throught a PSO algorithm paremeter optimization

format short g

%% Simulation parameters
global venus_swing_by
venus_swing_by = 1;
simula_progredindo = 1;
simula_unique = 1;

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

lower_boundary.theta_entrada_venus = 0;
lower_boundary.R_impulso = 0.15;
lower_boundary.theta_impulso_r = 0;
lower_boundary.magnitude_impulso = 0;
lower_boundary.theta_impulso_v = 0;
lower_boundary.theta_saida_venus = pi;
lower_boundary.t_swing_by_start = 0;
lower_boundary.t_swing_by_end = 0;

upper_boundary.theta_entrada_venus = pi;
upper_boundary.R_impulso = 0.5;
upper_boundary.theta_impulso_r = 2*pi;
upper_boundary.magnitude_impulso = 1;
upper_boundary.theta_impulso_v = 2*pi;
upper_boundary.theta_saida_venus = 2*pi;
upper_boundary.t_swing_by_start = 10;
upper_boundary.t_swing_by_end = 10;

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

    if exist(output_file_name, 'file') == 2
        T = readtable(output_file_name);
        T = [T; T_to_append];
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
    
    if simula_unique == 1
        break;
    end
end
