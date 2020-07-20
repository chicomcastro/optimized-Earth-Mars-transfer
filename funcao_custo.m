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
    rp = pega_parametro(x) * R_soi_venus;
else
    phase_venus = 0;
    t_terra_marte = pega_parametro(x);
end

% Delta Velocidade de impulsão para sair da Terra
% Em relação à Terra
impulso_sai_terra_magnitude = pega_parametro(x);
impulso_sai_terra_angulo = pega_parametro(x);
v_sai_terra = impulso_sai_terra_magnitude * base*M(impulso_sai_terra_angulo);

% Delta Velocidade de impulsão para chegar em Marte
% Em relação à Marte
impulso_chega_marte_magnitude = pega_parametro(x);
impulso_chega_marte_angulo = pega_parametro(x);
v_chega_marte = impulso_chega_marte_magnitude * base*M(impulso_chega_marte_angulo);

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
deltaV(end+1) = norm(v_sai_terra);

if venus_swing_by == 1
    %% 1. Transferência Terra-Vênus
    % Referencial: Sol
    r_saida = r_terra_sol;
    r_chegada = r_venus_sol;
    omega = omega_terra_sol;
    v_inicial = cross(omega, r_saida) + v_sai_terra;  % V espaçonave em rel ao Sol
    t_voo = t_terra_venus;
    GM = mi_sol;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    deltaV(end+1) = norm(v_saida) - norm(v_inicial);
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_inicial(end+1,:) = v_inicial;
    banco_velocidades_saida(end+1,:) = v_saida;

    %% 2. Swing by por Vênus
    % Mudança de referencial: Sol -> Vênus
    omega = omega_venus_sol;
    v_inicial = v_chegada - cross(omega, r_venus_sol);  % V espaçonave em rel a Venus
    sin_deflexao_venus = 1/(1 + rp*norm(v_inicial)/mi_venus);
    deflexao_venus = asin(sin_deflexao_venus);
    v_saida = v_inicial;                                % modelando sem propulsão no swingby
    v_chegada = v_inicial * M(2*deflexao_venus);
    
    % Validacao
    delta_v_swing_by_anal = 2*norm(v_inicial)*sin_deflexao_venus;
    delta_v_swing_by_comp = norm(v_chegada - v_saida);
    if delta_v_swing_by_anal - delta_v_swing_by_comp > 1e-1
        disp(...
            "Verificar swingby: " +...
            delta_v_swing_by_anal +...
            " ~= " +...
            delta_v_swing_by_comp...
        );
    end
    
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_inicial(end+1,:) = v_inicial;
    banco_velocidades_saida(end+1,:) = v_saida;


    %% 3. Transferência Venus-Marte
    % Mudança de referencial: Vênus -> Sol
    r_saida = r_venus_sol;
    r_chegada = r_marte_sol;
    v_inicial = v_chegada + cross(omega, r_venus_sol);  % V espaçonave em rel ao Sol
    t_voo = t_venus_marte;
    GM = mi_sol;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    deltaV(end+1) = norm(v_saida - v_inicial);
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_inicial(end+1,:) = v_inicial;
    banco_velocidades_saida(end+1,:) = v_saida;
else
    %% 2. Transferência Terra-Marte
    % Referencial: Sol
    r_saida = r_terra_sol;
    r_chegada = r_marte_sol;
    omega = omega_terra_sol;
    v_inicial = cross(omega, r_saida) + v_sai_terra;  % V espaçonave em rel ao Sol
    t_voo = t_terra_marte;
    GM = mi_sol;
    [v_saida, v_chegada, extremal_distances, exitflag] = lambert(r_saida, r_chegada, t_voo, 0, GM);
    deltaV(end+1) = norm(v_saida - v_inicial);
    banco_velocidades_chegada(end+1,:) = v_chegada;
    banco_velocidades_inicial(end+1,:) = v_inicial;
    banco_velocidades_saida(end+1,:) = v_saida;    
end

%% 4. Chegada em Marte
v_inicial = v_chegada + v_chega_marte;
deltaV(end+1) = norm(v_chega_marte);
v_final = v_marte_sol;
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