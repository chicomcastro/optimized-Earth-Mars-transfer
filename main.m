%% Main
% This script run all rotines needed to provide a minimal coust estimation
% for a Earth-Mars transfer throught a PSO algorithm paremeter optimization

format short g

%% Simulation parameters
global venus_swing_by
venus_swing_by = 1;
simula_progredindo = 1;

%% Inputs
% Define optimization parameters
max_iteration = 1000;                                  % Iteractions to run
num_particles = 100;                                  % Particles in swarm

clear lower_boundary upper_boundary
lower_boundary.theta_oe_terra = 0;
upper_boundary.theta_oe_terra = 2*pi;
lower_boundary.theta_soi_terra = 0;
upper_boundary.theta_soi_terra = 2*pi;

lower_boundary.theta_soi_venus = 0;
upper_boundary.theta_soi_venus = 2*pi;
lower_boundary.deflexao_venus = 0;
upper_boundary.deflexao_venus = 2*pi;
lower_boundary.phase_venus = 0;
upper_boundary.phase_venus = 2*pi;

lower_boundary.theta_soi_marte = 0;
upper_boundary.theta_soi_marte = 2*pi;
lower_boundary.theta_oe_marte = 0;
upper_boundary.theta_oe_marte = 2*pi;
lower_boundary.phase_marte = 0;
upper_boundary.phase_marte = 2*pi;

% Tempos de transferência
lower_boundary.t_oe_terra_soi_terra = 2;
upper_boundary.t_oe_terra_soi_terra = 30;
lower_boundary.t_soi_terra_soi_venus = 15;
upper_boundary.t_soi_terra_soi_venus = 180;
lower_boundary.t_soi_venus_soi_venus = 0;
upper_boundary.t_soi_venus_soi_venus = 30;
lower_boundary.t_soi_venus_soi_marte = 30;
upper_boundary.t_soi_venus_soi_marte = 300;
lower_boundary.t_soi_marte_oe_marte = 0.5;
upper_boundary.t_soi_marte_oe_marte = 30;

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
    if tentativa > 100 && simula_progredindo == 1
        num_particles = num_particles * 10;
        tentativa = 0;
    end
end
