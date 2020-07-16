%% function value = funcao_custo(x)
% Funcao para calculo do custo total de transferencia interplanetaria
%   Considera-se 4 pontos principais, com 3 orbitas coladas, portanto
%   Ex.: x = [  ];

global venus_swing_by
banco_velocidades_chegada = [];
banco_velocidades_saida = [];
banco_velocidades_inicial = [];

% Carrega dados de referência
dados;

% Posição dos planetas
theta_oe_terra = x(1);
theta_soi_terra = x(2);
phase_terra = 0;

theta_soi_venus = x(3);
deflexao_venus = x(4);
phase_venus = x(5);

theta_soi_marte = x(6);
theta_oe_marte = x(7);
phase_marte = x(8);

% Tempos de transferência
t_oe_terra_soi_terra = x(9);
t_soi_terra_soi_venus = x(10);
t_soi_venus_soi_venus = x(11);
t_soi_venus_soi_marte = x(12);
t_soi_marte_oe_marte = x(13);

base = [1 0 0];             % Vetor de referência da base canônica de R3
M = @(a)[ cos(a)  sin(a)  0;
          -sin(a) cos(a)  0;
          0       0       1
        ];                  % Matriz de rotação

deltaV = [];        % Matriz de custo [|V_a|, |V_b|, |V_c|, |V_d|]

% Em relação à Terra
r_oe_terra = R_oe_terra * base * M(theta_oe_terra);  % Definida em projeto
r_soi_terra = R_soi_terra * base * M(theta_soi_terra);  % SOI da Terra

% Em relação à Venus
r_soi_venus = R_soi_venus * base * M(theta_soi_venus);  % Definida em projeto

% Em relação à Marte
r_soi_marte = R_soi_marte * base * M(theta_soi_marte);  % Definida em projeto
r_oe_marte = R_oe_marte * base * M(theta_oe_marte);  % SOI de Marte

% Posições e velocidades dos planetas em relacao ao Sol
r_terra_sol = r_st * base*M(phase_terra);
r_venus_sol = r_sv * base*M(phase_venus);
r_marte_sol = r_sm * base*M(phase_marte);
v_terra_sol = (mi_sol/norm(r_terra_sol))^(0.5)*base*M(phase_terra + pi/2);
v_venus_sol = (mi_sol/norm(r_venus_sol))^(0.5)*base*M(phase_venus + pi/2);
v_marte_sol = (mi_sol/norm(r_marte_sol))^(0.5)*base*M(phase_marte + pi/2);

omega = @(r,v) (cross(r,v)/norm(r)^2);
omega_terra_sol = omega(r_terra_sol, v_terra_sol);
omega_venus_sol = omega(r_venus_sol, v_venus_sol);
omega_marte_sol = omega(r_marte_sol, v_marte_sol);

%% 1. Transferência Terra - SOI(Terra)
% Em torno da Terra
r_saida = r_oe_terra;
r_chegada = r_soi_terra;
t_voo = t_oe_terra_soi_terra;
GM = mi_terra;
[v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
v_inicial = (mi_terra/norm(r_saida))^(0.5)*base*M(theta_oe_terra + pi/2);
if (norm(v_saida - v_inicial) > norm(-v_saida - v_inicial))
    v_inicial = -v_inicial;
end
deltaV(end+1) = norm(v_saida - v_inicial);
banco_velocidades_chegada(end+1,:) = v_chegada;
banco_velocidades_inicial(end+1,:) = v_inicial;
banco_velocidades_saida(end+1,:) = v_saida;

if venus_swing_by == 1
    %% 2. Transferência SOI(Terra)-SOI(Vênus)
    % Mudança de referencial: Terra -> Sol
    r_saida = r_soi_terra + r_terra_sol;
    r_chegada = r_soi_venus + r_venus_sol;
    v_inicial = v_chegada + cross(omega_terra_sol, r_saida);  % V espaçonave em rel ao Sol
    t_voo = t_soi_terra_soi_venus;
    GM = mi_sol;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    deltaV(end+1) = norm(v_saida - v_inicial);
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_inicial(end+1,:) = v_inicial;
    banco_velocidades_saida(end+1,:) = v_saida;

    %% 3. Swing by por Vênus
    % Mudança de referencial: Sol -> Vênus
    r_saida = r_soi_venus;
    r_chegada = r_soi_venus * M(deflexao_venus);
    v_inicial = v_chegada - cross(omega_venus_sol, r_saida + r_venus_sol);  % V espaçonave em rel a Venus
    t_voo = t_soi_venus_soi_venus;
    GM = mi_venus;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    deltaV(end+1) = norm(v_saida - v_inicial);
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_inicial(end+1,:) = v_inicial;
    banco_velocidades_saida(end+1,:) = v_saida;


    %% 4. Transferência SOI(Venus)-SOI(Marte)
    % Mudança de referencial: Vênus -> Sol
    r_saida = r_soi_venus * M(deflexao_venus) + r_venus_sol;
    r_chegada = r_soi_marte + r_marte_sol;
    v_inicial = v_chegada + cross(omega_venus_sol, r_saida);  % V espaçonave em rel ao Sol
    t_voo = t_soi_venus_soi_marte;
    GM = mi_sol;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    deltaV(end+1) = norm(v_saida - v_inicial);
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_inicial(end+1,:) = v_inicial;
    banco_velocidades_saida(end+1,:) = v_saida;
else
    %% 2. Transferência SOI(Terra)-SOI(Marte)
    % Mudança de referencial: Terra -> Sol
    r_saida = r_soi_terra + r_terra_sol;
    r_chegada = r_soi_marte + r_marte_sol;
    v_inicial = v_chegada + cross(omega_terra_sol, r_saida);  % V espaçonave em rel ao Sol
    t_voo = t_soi_venus_soi_marte;  % Reaproveitando variavel
    GM = mi_sol;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    deltaV(end+1) = norm(v_saida - v_inicial);
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_inicial(end+1,:) = v_inicial;
    banco_velocidades_saida(end+1,:) = v_saida;    
end

%% 5/3. Transferência SOI(Marte)-Marte
% Mudança de referencial: Sol -> Marte
r_saida = r_soi_marte;
r_chegada = r_oe_marte;
v_inicial = v_chegada - cross(omega_marte_sol, r_saida + r_marte_sol);  % V em rel a Marte
t_voo = t_soi_marte_oe_marte;
GM = mi_marte;
[v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
deltaV(end+1) = norm(v_saida - v_inicial);
banco_velocidades_chegada(end+1,:) = v_chegada;
banco_velocidades_inicial(end+1,:) = v_inicial;
banco_velocidades_saida(end+1,:) = v_saida;

%% 6. Órbita estacionamento Marte
v_inicial = v_chegada;
v_final = (mi_marte/norm(r_chegada))^(0.5)*base*M(theta_oe_marte + pi/2);
if (norm(v_final - v_inicial) > norm(-v_final - v_inicial))
    v_final = -v_final;
end
deltaV(end+1) = norm(v_final - v_inicial);
banco_velocidades_chegada(end+1,:) = v_chegada;
banco_velocidades_inicial(end+1,:) = v_inicial;
banco_velocidades_saida(end+1,:) = v_final;

%% Cálculo custo final
value = sum(deltaV);

if (isnan(value))
    value = Inf;
end
