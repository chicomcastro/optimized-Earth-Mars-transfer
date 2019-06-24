% Dados
G = 6.67408e-20; %km3 kg-1 s-2
m_sol = 1.98892e30; %kg

r_st = 1.496e8; %km;
r_sm = 2.279e8; %km

% Definições
mi_sol = G*m_sol;

v = @(mi,r,a) (2*mi*(-1/(2*a)+1/r))^0.5;
t_voo = @(mi, a) 2*pi*(a^3/mi)^0.5;

% Velocidades notáveis
% Em relação à Terra
v_1_antes = v(mi_sol, r_st, r_st);
v_1_depois = v(mi_sol, r_st, (r_st+r_sm)/2);
v_3_antes = v(mi_sol, r_sm, (r_st+r_sm)/2);
v_3_depois = v(mi_sol, r_sm, r_sm);

% Tempos de voo
t_13 = t_voo(mi_sol, (r_st+r_sm)/2)/2;

% Resultados
dv_1 = v_1_depois - v_1_antes;
dv_3 = v_3_depois - v_3_antes;

delta_v_total = dv_1 + dv_3;
tempo_total = t_13;
tempo_total = tempo_total/3600/24/30