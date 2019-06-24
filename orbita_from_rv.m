
function conica = orbita_from_rv(r, v, mi)

energia = norm(v)^2/2 - mi/norm(r);
h = cross(r,v);
theta = angular_coord(r);

a = -mi/(2*energia);
p = norm(h)^2/mi;
e = (1-p/a)^(0.5);
phi = theta - acos((1-a*(1-e^2)/norm(r))/e);

conica = @(nu) p./(1-e*cos(nu-phi));
er = @(nu) [cos(nu) sin(nu) 0];

%while (phi < 0)
%    phi = phi + pi;
%end

if norm(conica(theta)*er(theta)-r)/norm(r) > 10^-2
    phi = phi+pi;
    conica = @(nu) p./(1-e*cos(nu-phi));
end

phi = mod(phi, 2*pi);

end