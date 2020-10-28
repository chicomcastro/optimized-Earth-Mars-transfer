%% function value = funcao_custo(x)
% Funcao para calculo do custo total de transferencia interplanetaria
%   Considera-se 4 pontos principais, com 3 orbitas coladas, portanto
%   Ex.: x = [  ];

%% Inicializações
global venus_swing_by parametro
parametro = 0;
banco_velocidades_chegada = [];
banco_velocidades_saida = [];
banco_velocidades_inicial = [];

base = [1 0 0];             % Vetor de referência da base canônica de R3
M = @(a)[ cos(a)  sin(a)  0;
          -sin(a) cos(a)  0;
          0       0       1
        ];                  % Matriz de rotação

deltaV = [];                % Matriz de custo (|V_i|)_i

% Carrega dados de referência
dados;

%% Parâmetros
% Posição dos planetas
phase_terra = 0;
phase_marte = pega_parametro(x);

if venus_swing_by == 1
    phase_venus = pega_parametro(x);
    % Tempos de transferência
    t_terra_venus = pega_parametro(x);
    t_venus_marte = pega_parametro(x);
    % Parâmetros do swingby
    theta_entrada_venus = pega_parametro(x);
    R_impulso = pega_parametro(x) * R_soi_venus;
    theta_impulso_r = pega_parametro(x);
    magnitude_impulso = pega_parametro(x);
    theta_impulso_v = pega_parametro(x);
    theta_saida_venus = pega_parametro(x);
    t_swing_by_start = pega_parametro(x);
    t_swing_by_end = pega_parametro(x);
else
    phase_venus = 0;
    t_terra_marte = pega_parametro(x);
end

%% Definições base
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


%% Cálculo dos custos

if venus_swing_by == 1
    %% 1. Transferência Terra-Vênus
    % Referencial: Sol
    r_saida = r_terra_sol;
    r_chegada = r_venus_sol;
    t_voo = t_terra_venus;
    GM = mi_sol;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_saida(end+1,:) = v_saida;
    
    v_inicial = sqrt(mi_terra/R_oe_terra);
    v_inf = v_saida - v_terra_sol;
    v_saida = sqrt(norm(v_inf)^2 + 2*mi_terra/R_oe_terra);
    
    deltaV(end+1) = norm(v_saida - v_inicial);
    
    %% 2. Venus swing by    
    % r,v que entra na SOI(Venus)
    v_entrada = v_chegada - cross(omega_venus_sol, r_venus_sol);  % ref em Vênus
    r_entrada = R_soi_venus*[1,0,0]*M(theta_entrada_venus);
    
    % r,v que recebe impulso
    delta_v = magnitude_impulso * theta_impulso_v;
    deltaV(end+1) = norm(delta_v);
    r_impulso = R_impulso * [1,0,0]*M(theta_impulso_r);
    [v_entrada_depois, v_impulso_antes, extremal_distances, exitflag] = lambert(r_entrada, r_impulso, t_swing_by_start, 0, mi_venus);
    deltaV(end+1) = norm(v_entrada_depois - v_entrada);
    v_impulso_depois = v_impulso_antes + delta_v;
    
    % r,v que sai da SOI
    r_saida = R_soi_venus*[1,0,0]*M(theta_saida_venus);
    [v_impulso_saida, v_chegada, extremal_distances, exitflag] = lambert(r_impulso, r_saida, t_swing_by_end, 0, mi_venus);
    deltaV(end+1) = norm(v_impulso_saida - v_impulso_depois);

    %% 3. Transferência Venus-Marte
    % Mudança de referencial: Vênus -> Sol
    r_saida = r_venus_sol;
    r_chegada = r_marte_sol;
    v_inicial = v_chegada + cross(omega_venus_sol, r_venus_sol);  % V espaçonave em rel ao Sol
    t_voo = t_venus_marte;
    GM = mi_sol;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_saida(end+1,:) = v_saida;
    
    deltaV(end+1) = norm(v_saida - v_inicial);
else
    %% 1. Transferência Terra-Marte
    % Referencial: Sol
    r_saida = r_terra_sol;
    r_chegada = r_marte_sol;
    t_voo = t_terra_marte;
    GM = mi_sol;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    
    v_inicial = sqrt(mi_terra/R_oe_terra);
    v_inf = v_saida - v_terra_sol;
    v_final = sqrt(norm(v_inf)^2 + 2*mi_terra/R_oe_terra);
    
    deltaV(end+1) = norm(v_final - v_inicial);
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_inicial(end+1,:) = v_inicial;
    banco_velocidades_saida(end+1,:) = v_saida;    
end

%% 4/2. Chegada em Marte
v_inf = v_chegada - v_marte_sol; % v_inf hiperbólica de chegada em marte
v_p = sqrt(norm(v_inf)^2 + 2*mi_marte/R_oe_marte);
v_inicial = norm(v_p);
v_final = sqrt(mi_marte/R_oe_marte); % v_p necessaria para ser capturada

deltaV(end+1) = norm(v_final - v_inicial);

%% Cálculo custo final
value = sum(deltaV);

if (isnan(value))
    value = Inf;
end

function valor = pega_parametro(x)
    global parametro;
    parametro = parametro + 1;
    valor = x(parametro);
end