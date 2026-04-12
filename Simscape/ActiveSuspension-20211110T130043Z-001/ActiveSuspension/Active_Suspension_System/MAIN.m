addpath ActiveSuspension

run(fullfile('ActiveSuspension','ACTIVESUSPENSIONSYS_OPT_DataFile.m'))
open(fullfile('ActiveSuspension','ACTIVESUSPENSIONSYS.slx'))

CT = 0;

%% Simulink Validation
load z2-z1-zr
%load mod1test
Glin_1 = LinearAnalysisToolProject.Results.Data.Value;
load z2-z1-zr10-6
Glin_1_filtered = LinearAnalysisToolProject.Results.Data.Value;
load z2-z1-Fc
Glin_2 = LinearAnalysisToolProject.Results.Data.Value;

load accZ2-zr

Glin_3 = LinearAnalysisToolProject.Results.Data.Value;
load accZ2-zr10-6
Glin_3_filtered = LinearAnalysisToolProject.Results.Data.Value;
load accZ2-Fc
Glin_4 = LinearAnalysisToolProject.Results.Data.Value;


Ms = 2.45;
Mus = 1;
Ks = 900;
Kus = 1250;
Bs = 7.5;
Bus = 5;


s = tf('s');
Div = s^4*Ms*Mus + (Ms*Bus + Bs*Mus + Ms*Bs)*s^3 + ...
    (Ms*Kus + Bs*Bus + Ks*Ms + Ks*Mus)*s^2 + (Ks*Bus + Bs*Kus)*s + Ks*Kus;

Gtheoretical_1 = -s*Ms*(Kus + s*Bus) /Div; 
Gtheoretical_2 = ((Mus + Ms)*s^2 + s*Bus + Kus) / Div;
Gtheoretical_3 = s*(Bs*s^2*Bus + (Ks*Bus + Bs*Kus)*s + Ks*Kus)/ Div;
Gtheoretical_4 = s^2*(s^2*Mus + s*Bus + Kus) / Div;


figure(1)
%bode(Glin_3/Gtheoretical_3/s,1/(1+0.001*s)^2,'--k')
bode(Glin_1,Gtheoretical_1*s,'--k')
legend('Glineariser/(Gtheoretical*s)','1/(1+0.001*s)^2'),grid
figure(2)
bode(Glin_2,Gtheoretical_2,'--k')
legend('Lineariser','Theoretical'),grid
figure(3)
bode(Glin_3,Glin_3_filtered,Gtheoretical_3*s,'--k')
legend('Lineariser: filtering time constant = 10^-3','Lineariser: filtering time constant = 10^-6','Theoretical'),grid
figure(4)
bode(Glin_4,Gtheoretical_4,'--k')
legend('Lineariser','Theoretical'),grid
shg

