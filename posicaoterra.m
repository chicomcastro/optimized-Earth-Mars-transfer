function tetafin = posicaoterra(tetaini,t)

T_terra = 365.26; %período orbital da Terra
deltateta = 2*pi/T_terra*t;
tetafin = tetaini+deltateta; %posição final da Terra

end