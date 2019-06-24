%function value = funcao_custo(x)
%Funcao para calculo do custo total de transferencia interplanetaria
%   Considera-se 4 pontos principais, com 3 orbita coladas, portanto
%   Uso: x = [ theta_a, theta_b, theta_c, theta_d, t_ab, t_bc, t_cd ]
%   Ex.: x = [ pi/2 -pi/2 pi/2 -pi/2 15 270 15 ];

base = [1 0 0];             % Vetor de referência da base canônica de R3
M = @(a)[ cos(a)  sin(a)  0;
          -sin(a) cos(a)  0;
          0       0       1
        ];                  % Matriz de rotação
deltaV = zeros(4,1);                 % Custo total

% Carrega dados de referência
dados;

% Em relação à Terra
r_a_terra = r_ta * base*M(x(1));  % Definida em projeto
r_b_terra = r_tb * base*M(x(2));  % SOI da Terra

% Em relação à Marte
r_c_marte = r_mc * base*M(x(3));  % SOI de Marte
r_d_marte = r_md * base*M(x(4));  % Definida em projeto

% Posições dos planetas
r_terra_sol = r_st * [0 -1 0];
r_marte_sol = r_sm * [0 1 0];

% Tempos de transferência
t_ab = x(5);
t_bc = x(6);
t_cd = x(7);

% Transferência Terra - SOI(Terra)
% Em torno da Terra
r1 = r_a_terra;
r2 = r_b_terra;
t_voo = t_ab;
GM = mi_terra;
[V1, V2, extremal_distances, exitflag] = lambert(r1, r2, t_voo, 0, GM);
v_a_1 = (mi_terra/norm(r1))^(0.5)*[-sin(x(1)) cos(x(1)) 0];
v_a_2 = V1;
v_b_1 = V2 + (mi_sol/norm(r_terra_sol))^(0.5)*[1 0 0];  % V em rel ao Sol
if (norm(v_a_2 - v_a_1) <= norm(-v_a_2 - v_a_1))
    deltaV(1) = norm(v_a_2 - v_a_1);
else
    deltaV(1) = norm(-v_a_2 - v_a_1);
end

% Transferência SOI(Terra)-SOI(Marte)
% Em torno do Sol
r_b_sol = r_b_terra + r_terra_sol;
r_c_sol = r_c_marte + r_marte_sol;

r1 = r_b_sol;
r2 = r_c_sol;
t_voo = t_bc;
GM = mi_sol;
[V1, V2, extremal_distances, exitflag] = lambert(r1, r2, t_voo, 0, GM);
v_b_2 = V1;
v_c_1 = V2 - (mi_sol/norm(r_marte_sol))^(0.5)*[-1 0 0];  % V em rel a Marte
deltaV(2) = norm(v_b_2 - v_b_1);

% Transferência SOI(Marte)-Marte
% Em torno de Marte
r1 = r_c_marte;
r2 = r_d_marte;
t_voo = t_cd;
GM = mi_marte;
[V1, V2, extremal_distances, exitflag] = lambert(r1, r2, t_voo, 0, GM);
v_c_2 = V1;
v_d_1 = V2;
deltaV(3) = norm(v_c_2 - v_c_1);

% Órbita estacionamento Marte
v_d_2 = (mi_marte/norm(r2))^(0.5)*[-sin(x(4)) cos(x(4)) 0];
if (norm(v_d_2 - v_d_1) <= norm(-v_d_2 - v_d_1))
    deltaV(4) = norm(v_d_2 - v_d_1);
else
    deltaV(4) = norm(-v_d_2 - v_d_1);
end

deltaV;
value = sum(deltaV);

if (isnan(value))
    value = Inf;
end
