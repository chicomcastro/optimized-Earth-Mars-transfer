% Dados
G = 6.67408e-20; %km3 kg-1 s-2
m_terra = 5.972e24; %kg
m_sol = 1.98892e30; %kg
m_marte = 6.39e23; %kg

R_t = 6.371e3; %km
R_m = 3.389e3; %km

r_st = 1.496e8; %km;
r_sm = 2.279e8; %km

% Definições
mi_terra = G*m_terra;
mi_sol = G*m_sol;
mi_marte = G*m_marte;

v = @(mi,r,a) (2*mi*(-1/(2*a)+1/r))^0.5;
soi = @(a, m, M) 0.9431*a*(m/M)^(2/5);
t_voo = @(mi, a) 2*pi*(a^3/mi)^0.5;

% Parâmetros de projeto
h_o = 0.1*R_t; % Altitude da órbita de saída
h_f = 0.3*R_m; % Altitude da orbita de chegada

r_ta = R_t + h_o;
r_tb = soi(r_st, m_terra, m_sol);
r_sb = r_st - soi(r_st, m_terra, m_sol);
r_sc = r_sm - soi(r_sm, m_marte, m_sol);
r_mc = soi(r_sm, m_marte, m_sol);
r_md = R_m + h_f;

% Velocidades notáveis
% Em relação à Terra
v_a1 = v(mi_terra, r_ta, r_ta);
v_a2 = v(mi_terra, r_ta, (r_ta+r_tb)/2);
v_b1 = v(mi_terra, r_tb, (r_ta+r_tb)/2);
% Em relação ao Sol
v_b1 = v_b1 + v(mi_sol, r_st, r_st);
v_b2 = v(mi_sol, r_sb, (r_sb+r_sc)/2);
v_c1 = v(mi_sol, r_sc, (r_sb+r_sc)/2);
% Em relação à Marte
v_c1 = v_c1 - v(mi_sol, r_sm, r_st);
v_c2 = v(mi_marte, r_mc, (r_mc+r_md)/2);
v_d1 = v(mi_marte, r_md, (r_mc+r_md)/2);
v_d2 = v(mi_marte, r_md, r_md);

% Tempos de voo
t_a = t_voo(mi_terra, (r_ta+r_tb)/2) / 2 /3600/24/30;
t_b = t_voo(mi_sol, (r_sb+r_sc)/2) / 2 /3600/24/30;
t_c = t_voo(mi_marte, (r_mc+r_md)/2) / 2 /3600/24/30;

% Resultados
dv_a = v_a2 - v_a1
dv_b = v_b2 - v_b1
dv_c = v_c2 - v_c1
dv_d = v_d2 - v_d1

delta_v_total = abs(dv_a) + abs(dv_b) + abs(dv_c) + abs(dv_d)
tempo_total = t_a + t_b + t_c