function tetafin = posicaomarte(tetaini,t)

T_marte = 686.971; %período orbital de Marte
deltateta = 2*pi/T_marte*t;
tetafin = tetaini+deltateta; %posição final de Marte

end