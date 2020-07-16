
function conica = orbita_from_rv(r, v, mi)

energia = norm(v)^2/2 - mi/norm(r);
h = cross(r,v);
theta = angular_coord(r);

a = -mi/(2*energia);
p = norm(h)^2/mi;
e = (1-p/a)^(0.5);
phi = theta - acos((1-a*(1-e^2)/norm(r))/e);

conica = @(nu) p./(1-e*cos(nu-phi));

% fazer r x v x r para analisar phase da orbita (phi = phi + pi)
b1 = cross(cross(r,v), r)/norm(r)^2/norm(v);
b2 = v/norm(v);
alpha = ang2vectors(b1, b2);
if alpha > pi/2
    phi = pi + phi;
    conica = @(nu) p./(1-e*cos(nu-phi));
end
end

