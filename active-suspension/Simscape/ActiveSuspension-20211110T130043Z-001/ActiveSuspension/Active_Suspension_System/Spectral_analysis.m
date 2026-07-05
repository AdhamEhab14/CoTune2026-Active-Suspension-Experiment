Ts = 1e-3;
var.signals.values= 10*repmat(randn(5000,1),2,1);
var.time=(0:(length(var.signals.values)-1))*1e-3
%var.signals.dimensions=[DimValues]

%%


y = out.simout.Data;
u = var.signals.values;

%%


y = y(5001:end);
u = u(5001:end);

g = fft(y)./fft(u);
resp = g(1:1:end/2);

w = linspace(0,2*pi*4999/5000/1e-3,5000)';

G = frd(resp,w(1:end/2),1e-3)