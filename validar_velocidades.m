%function [V1, V2] = ValidarVelocidades(V1, V2)
%Funcao para prevenir indefinicoes no vetor velocidade ao longo do calculo
%   Em determinados casos, a funcao lambert retorna V1 e V2 NaN, portanto
%   eh relativamente importante conseguir contornar esses casos para nao
%   comprometer as analises

if (~isfinite(V1))
    V1 = (GM/p)^(0.5)*(e*sin(theta)*[cos(theta) sin(theta) 0] + (1+e*cos(theta))*[-sin(theta) cos(theta) 0]);
end

if (~isfinite(V2))
    V2 = (GM/p)^(0.5)*(e*sin(theta)*[cos(theta) sin(theta) 0] + (1+e*cos(theta))*[-sin(theta) cos(theta) 0]);
end
