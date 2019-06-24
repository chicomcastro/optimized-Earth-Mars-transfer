function theta = angularCoord(pos)
%Retorna a coordenada angular a partir de uma coordenada carteseana
%   pos e a posicao do ponto em coord cartesianas (x,y)

x = pos(1);
y = pos(2);

if (x == 0)
    if (y > 0)
        theta = pi/2;
    end
    if (y < 0)
        theta = 3*pi/2;
    end
    if (y == 0)
        theta = 0;
    end
    return;
end

if (y == 0)
    if (x > 0)
        theta = 0;
    else
        theta = pi;
    end
    return;
end

theta = mod(atan(y/x), 2*pi);

end

