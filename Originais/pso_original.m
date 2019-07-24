%function pso()
%   pso busca o minimo

best_global = zeros(1,7);
iteration = 0;
max_iteration = 100;

% Hyperparams struct
hyperparams.num_particles = 10^2;
hyperparams.lb = [0 0 0 0 0 0 0];
hyperparams.ub = [2*pi 2*pi 2*pi 2*pi 30 365 30];
hyperparams.w = 0.9;
hyperparams.phip = 0.6;
hyperparams.phig = 0.8;

%function initialize_particles(num_particles, lb, ub):
for i = 1:hyperparams.num_particles
    particles(i) = Particle;
    % random_uniform here operates on arrays
    particles(i).x = random_uniform(hyperparams.lb, hyperparams.ub);
    delta = hyperparams.ub - hyperparams.lb;
    particles(i).v = random_uniform(-delta, delta);
    particles(i).best = zeros(1,length(particles(i).x));
end

while ~check_stopping_condition(iteration, max_iteration)
    iteration = iteration + 1;
    %[particles, best_iteration] = update_particles(particles,...
    %    best_global, hyperparams);
    
    %function update_particles(particles, best_global, hyperparams):
    w = hyperparams.w;
    phip = hyperparams.phip;
    phig = hyperparams.phig;
    best_iteration = zeros(1,7);
    
    for i = 1:length(particles)
        rp = random_uniform(0.0, 1.0);
        rg = random_uniform(0.0, 1.0);
        particles(i).v = w * particles(i).v + phip * rp * (particles(i).best - particles(i).x) + phig * rg * (best_global - particles(i).x);
        particles(i).x = particles(i).x + particles(i).v;
        particles(i).x = min(max(particles(i).x, hyperparams.lb), hyperparams.ub);
        if custo(particles(i).x) < custo(particles(i).best)
            particles(i).best = particles(i).x;
            if custo(particles(i).x) < custo(best_iteration)
                best_iteration = particles(i).x;
            end
        end
    end
    
    if custo(best_iteration) < custo(best_global)
        best_global = best_iteration;
    end
end

best_global
custo(best_global)

% Create a table with the data and variable names
if exist('T','var') == 1
    T = [T; table(custo(best_global), best_global(1), best_global(2), best_global(3), best_global(4), best_global(5), best_global(6), best_global(7), hyperparams.num_particles, max_iteration, 'VariableNames', { 'Custo_total', 'theta_a', 'theta_b', 'theta_c', 'theta_d', 't_ab', 't_bc', 't_cd', 'Num_particles', 'Max_iterations'} )];
elseif exist('resultados.txt', 'file') == 2
    T = readtable('resultados.txt');
else
    T = table(custo(best_global), best_global(1), best_global(2), best_global(3), best_global(4), best_global(5), best_global(6), best_global(7), hyperparams.num_particles, max_iteration, 'VariableNames', { 'Custo_total', 'theta_a', 'theta_b', 'theta_c', 'theta_d', 't_ab', 't_bc', 't_cd', 'Num_particles', 'Max_iterations'} );
end
% Write data to text file
writetable(T, 'resultados.txt')

