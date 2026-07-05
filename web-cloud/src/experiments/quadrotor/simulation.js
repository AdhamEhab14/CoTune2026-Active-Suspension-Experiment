const B_l = 0.5;
const B_u = 0.5;
const FilterCoeffN = 10.0;
const J_l = 0.071440709;
const J_u = 0.049103;
const JointX_InitialPositionCondition = 0.27;
const JointY_InitialPositionCondition = -0.33;
const L_cg_l = 0.102366;
const L_cg_u = 0.066301;
const L_l = 0.223793;
const L_u = 0.227293;
const PitchLowerLimit = -0.37;
const PitchUpperLimit = 0.27;
const PitchXMotorSaturation = 50.0;
const PitchXStartThrust = 50.0;
const RollLowerLimit = -0.33;
const RollUpperLimit = 0.4;
const RollYMotorSaturation = 30.0;
const RollYStartThrust = 40.0;
const g = 9.81;
var ixposkd = 0.0;
var ixposki = 1.0;
var ixposkp = 9.6;
var ixvelkd = 0.0;
var ixvelki = 2.0;
var ixvelkp = 12.0;
var iyposkd = 0.0;
var iyposki = 1.0;
var iyposkp = 10.0;
var iyvelkd = 0.0;
var iyvelki = 5.0;
var iyvelkp = 20.0;
const mass_l = 2.495;
const mass_u = 2.024;

class DW_TwoDOF {
  constructor() {
    this.Delay1_DSTATE = new Array(4).fill(0);
    this.DiscreteTimeIntegrator1_DSTATE = 0;
    this.Integrator_DSTATE = 0;
    this.Filter_DSTATE = 0;
    this.Delay_DSTATE = new Array(4).fill(0);
    this.DiscreteTransferFcn_states = 0;
    this.Integrator_DSTATE_h = 0;
    this.Filter_DSTATE_p = 0;
    this.Delay3_DSTATE = new Array(4).fill(0);
    this.DiscreteTimeIntegrator_DSTATE = 0;
    this.Integrator_DSTATE_o = 0;
    this.Filter_DSTATE_m = 0;
    this.Delay2_DSTATE = new Array(4).fill(0);
    this.DiscreteTransferFcn1_states = 0;
    this.Integrator_DSTATE_b = 0;
    this.Filter_DSTATE_h = 0;
    this.DiscreteTimeIntegrator4_DSTATE = 0;
    this.DiscreteTimeIntegrator3_DSTATE = 0;
    this.FrontMotor_states = 0;
    this.BackMotor_states = 0;
    this.LeftMotor_states = 0;
    this.RightMotor_states = 0;
    this.DiscreteTimeIntegrator5_DSTATE = 0;
    this.DiscreteTimeIntegrator2_DSTATE = 0;
  }
}

class ExtU_TwoDOF {
  constructor() {
    this.Y_setpoint = 0;
    this.X_setpoint = 0;
  }
}

class ExtY_TwoDOF {
  constructor() {
    this.thetaYDot = 0;
    this.Y_posPID_ControlAction = 0;
    this.Y_velPID_ControlAction = 0;
    this.thetaY = 0;
    this.thetaX = 0;
    this.X_posPID_ControlAction = 0;
    this.X_velPID_ControlAction = 0;
    this.thetaXDot = 0;
  }
}

let TwoDOF_DW = new DW_TwoDOF();
let TwoDOF_U = new ExtU_TwoDOF();
let TwoDOF_Y = new ExtY_TwoDOF();

function TwoDOF_initialize() {
  TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE = JointY_InitialPositionCondition;
  TwoDOF_DW.DiscreteTimeIntegrator2_DSTATE = JointX_InitialPositionCondition;
}

function TwoDOF_step() {
  let Add17;
  let Add18;
  let Add21;
  let Add22;
  let Sum;
  let Sum1;
  let numAccum;
  let numAccum_0;
  let numAccum_1;
  let numAccum_2;
  let rtb_Cos;
  let rtb_Filter;
  let rtb_FilterCoefficient;
  let rtb_FilterCoefficient_b;
  let rtb_FilterCoefficient_d;
  let rtb_FilterCoefficient_h;
  let rtb_Filter_b;
  let rtb_Filter_m;
  let rtb_Switch_b;
  let tmp;
  let tmp_0;
  let tmp_1;
  let tmp_2;
  let rtb_AND3_p;
  let rtb_RelationalOperator;
  let rtb_RelationalOperator_m;

  Add17 = RollYStartThrust - TwoDOF_Y.Y_velPID_ControlAction;
  Add18 = RollYStartThrust + TwoDOF_Y.Y_velPID_ControlAction;
  rtb_Filter_m =
    TwoDOF_DW.DiscreteTimeIntegrator1_DSTATE - TwoDOF_DW.Delay1_DSTATE[0];
  rtb_Filter = iyposki * rtb_Filter_m;
  rtb_FilterCoefficient =
    (iyposkd * rtb_Filter_m - TwoDOF_DW.Filter_DSTATE) * FilterCoeffN;
  TwoDOF_Y.Y_posPID_ControlAction =
    iyposkp * rtb_Filter_m +
    TwoDOF_DW.Integrator_DSTATE +
    rtb_FilterCoefficient;
  if (TwoDOF_Y.Y_posPID_ControlAction > 1.0) {
    rtb_Filter_m = TwoDOF_Y.Y_posPID_ControlAction - 1.0;
    tmp = 1;
  } else {
    if (TwoDOF_Y.Y_posPID_ControlAction >= -1.0) {
      rtb_Filter_m = 0.0;
    } else {
      rtb_Filter_m = TwoDOF_Y.Y_posPID_ControlAction - -1.0;
    }

    tmp = -1;
  }

  rtb_RelationalOperator = rtb_Filter_m != 0.0;
  if (TwoDOF_Y.Y_posPID_ControlAction > 1.0) {
    TwoDOF_Y.Y_posPID_ControlAction = 1.0;
  } else if (TwoDOF_Y.Y_posPID_ControlAction < -1.0) {
    TwoDOF_Y.Y_posPID_ControlAction = -1.0;
  }

  numAccum = 0.0165 * TwoDOF_DW.DiscreteTransferFcn_states;
  rtb_Filter_m =
    numAccum + TwoDOF_Y.Y_posPID_ControlAction - TwoDOF_DW.Delay_DSTATE[0];
  rtb_FilterCoefficient_d =
    (iyvelkd * rtb_Filter_m - TwoDOF_DW.Filter_DSTATE_p) * FilterCoeffN;
  TwoDOF_Y.Y_velPID_ControlAction =
    iyvelkp * rtb_Filter_m +
    TwoDOF_DW.Integrator_DSTATE_h +
    rtb_FilterCoefficient_d;
  if (TwoDOF_Y.Y_velPID_ControlAction > RollYMotorSaturation) {
    rtb_Filter_b = TwoDOF_Y.Y_velPID_ControlAction - RollYMotorSaturation;
  } else if (TwoDOF_Y.Y_velPID_ControlAction >= -RollYMotorSaturation) {
    rtb_Filter_b = 0.0;
  } else {
    rtb_Filter_b = TwoDOF_Y.Y_velPID_ControlAction - -RollYMotorSaturation;
  }

  rtb_Filter_m *= iyvelki;
  if (rtb_Filter_b > 0.0) {
    tmp_0 = 1;
  } else {
    tmp_0 = -1;
  }

  if (rtb_Filter_m > 0.0) {
    tmp_1 = 1;
  } else {
    tmp_1 = -1;
  }

  if (rtb_Filter_b != 0.0 && tmp_0 == tmp_1) {
    rtb_Switch_b = 0.0;
  } else {
    rtb_Switch_b = rtb_Filter_m;
  }

  if (TwoDOF_Y.Y_velPID_ControlAction > RollYMotorSaturation) {
    TwoDOF_Y.Y_velPID_ControlAction = RollYMotorSaturation;
  } else if (TwoDOF_Y.Y_velPID_ControlAction < -RollYMotorSaturation) {
    TwoDOF_Y.Y_velPID_ControlAction = -RollYMotorSaturation;
  }

  Sum = TwoDOF_U.Y_setpoint - TwoDOF_DW.DiscreteTimeIntegrator1_DSTATE;
  Add21 = PitchXStartThrust - TwoDOF_Y.X_velPID_ControlAction;
  Add22 = PitchXStartThrust + TwoDOF_Y.X_velPID_ControlAction;
  rtb_Filter_b =
    TwoDOF_DW.DiscreteTimeIntegrator_DSTATE - TwoDOF_DW.Delay3_DSTATE[0];
  rtb_Filter_m = ixposki * rtb_Filter_b;
  rtb_FilterCoefficient_h =
    (ixposkd * rtb_Filter_b - TwoDOF_DW.Filter_DSTATE_m) * FilterCoeffN;
  TwoDOF_Y.X_posPID_ControlAction =
    ixposkp * rtb_Filter_b +
    TwoDOF_DW.Integrator_DSTATE_o +
    rtb_FilterCoefficient_h;
  if (TwoDOF_Y.X_posPID_ControlAction > 1.0) {
    rtb_Filter_b = TwoDOF_Y.X_posPID_ControlAction - 1.0;
    tmp_0 = 1;
  } else {
    if (TwoDOF_Y.X_posPID_ControlAction >= -1.0) {
      rtb_Filter_b = 0.0;
    } else {
      rtb_Filter_b = TwoDOF_Y.X_posPID_ControlAction - -1.0;
    }

    tmp_0 = -1;
  }

  rtb_RelationalOperator_m = rtb_Filter_b != 0.0;
  if (TwoDOF_Y.X_posPID_ControlAction > 1.0) {
    TwoDOF_Y.X_posPID_ControlAction = 1.0;
  } else if (TwoDOF_Y.X_posPID_ControlAction < -1.0) {
    TwoDOF_Y.X_posPID_ControlAction = -1.0;
  }

  numAccum_0 = 0.0165 * TwoDOF_DW.DiscreteTransferFcn1_states;
  rtb_Filter_b =
    numAccum_0 + TwoDOF_Y.X_posPID_ControlAction - TwoDOF_DW.Delay2_DSTATE[0];
  rtb_FilterCoefficient_b =
    (ixvelkd * rtb_Filter_b - TwoDOF_DW.Filter_DSTATE_h) * FilterCoeffN;
  TwoDOF_Y.X_velPID_ControlAction =
    ixvelkp * rtb_Filter_b +
    TwoDOF_DW.Integrator_DSTATE_b +
    rtb_FilterCoefficient_b;
  if (TwoDOF_Y.X_velPID_ControlAction > PitchXMotorSaturation) {
    rtb_Cos = TwoDOF_Y.X_velPID_ControlAction - PitchXMotorSaturation;
  } else if (TwoDOF_Y.X_velPID_ControlAction >= -PitchXMotorSaturation) {
    rtb_Cos = 0.0;
  } else {
    rtb_Cos = TwoDOF_Y.X_velPID_ControlAction - -PitchXMotorSaturation;
  }

  rtb_Filter_b *= ixvelki;
  if (rtb_Cos > 0.0) {
    tmp_1 = 1;
  } else {
    tmp_1 = -1;
  }

  if (rtb_Filter_b > 0.0) {
    tmp_2 = 1;
  } else {
    tmp_2 = -1;
  }

  rtb_AND3_p = rtb_Cos != 0.0 && tmp_1 == tmp_2;
  if (TwoDOF_Y.X_velPID_ControlAction > PitchXMotorSaturation) {
    TwoDOF_Y.X_velPID_ControlAction = PitchXMotorSaturation;
  } else if (TwoDOF_Y.X_velPID_ControlAction < -PitchXMotorSaturation) {
    TwoDOF_Y.X_velPID_ControlAction = -PitchXMotorSaturation;
  }

  Sum1 = TwoDOF_U.X_setpoint - TwoDOF_DW.DiscreteTimeIntegrator_DSTATE;
  TwoDOF_Y.thetaYDot = TwoDOF_DW.DiscreteTimeIntegrator4_DSTATE;
  TwoDOF_Y.thetaY = TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE;
  rtb_Cos = Math.cos(TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE);
  numAccum_1 = 0.00634 * TwoDOF_DW.LeftMotor_states;
  numAccum_2 = 0.00634 * TwoDOF_DW.RightMotor_states;
  TwoDOF_Y.thetaXDot = TwoDOF_DW.DiscreteTimeIntegrator5_DSTATE;
  TwoDOF_Y.thetaX = TwoDOF_DW.DiscreteTimeIntegrator2_DSTATE;
  TwoDOF_DW.DiscreteTimeIntegrator1_DSTATE += 0.005 * numAccum;
  if (rtb_Filter > 0.0) {
    tmp_1 = 1;
  } else {
    tmp_1 = -1;
  }

  if (rtb_RelationalOperator && tmp == tmp_1) {
    rtb_Filter = 0.0;
  }

  TwoDOF_DW.Integrator_DSTATE += 0.005 * rtb_Filter;
  TwoDOF_DW.Filter_DSTATE += 0.005 * rtb_FilterCoefficient;
  TwoDOF_DW.DiscreteTransferFcn_states =
    Sum - -0.9835 * TwoDOF_DW.DiscreteTransferFcn_states;
  TwoDOF_DW.Integrator_DSTATE_h += 0.005 * rtb_Switch_b;
  TwoDOF_DW.Filter_DSTATE_p += 0.005 * rtb_FilterCoefficient_d;
  TwoDOF_DW.DiscreteTimeIntegrator_DSTATE += 0.005 * numAccum_0;
  if (rtb_Filter_m > 0.0) {
    tmp = 1;
  } else {
    tmp = -1;
  }

  if (rtb_RelationalOperator_m && tmp_0 == tmp) {
    rtb_Filter_m = 0.0;
  }

  TwoDOF_DW.Integrator_DSTATE_o += 0.005 * rtb_Filter_m;
  TwoDOF_DW.Filter_DSTATE_m += 0.005 * rtb_FilterCoefficient_h;
  TwoDOF_DW.Delay1_DSTATE[0] = TwoDOF_DW.Delay1_DSTATE[1];
  TwoDOF_DW.Delay_DSTATE[0] = TwoDOF_DW.Delay_DSTATE[1];
  TwoDOF_DW.Delay3_DSTATE[0] = TwoDOF_DW.Delay3_DSTATE[1];
  TwoDOF_DW.Delay2_DSTATE[0] = TwoDOF_DW.Delay2_DSTATE[1];
  TwoDOF_DW.Delay1_DSTATE[1] = TwoDOF_DW.Delay1_DSTATE[2];
  TwoDOF_DW.Delay_DSTATE[1] = TwoDOF_DW.Delay_DSTATE[2];
  TwoDOF_DW.Delay3_DSTATE[1] = TwoDOF_DW.Delay3_DSTATE[2];
  TwoDOF_DW.Delay2_DSTATE[1] = TwoDOF_DW.Delay2_DSTATE[2];
  TwoDOF_DW.Delay1_DSTATE[2] = TwoDOF_DW.Delay1_DSTATE[3];
  TwoDOF_DW.Delay_DSTATE[2] = TwoDOF_DW.Delay_DSTATE[3];
  TwoDOF_DW.Delay3_DSTATE[2] = TwoDOF_DW.Delay3_DSTATE[3];
  TwoDOF_DW.Delay2_DSTATE[2] = TwoDOF_DW.Delay2_DSTATE[3];
  TwoDOF_DW.Delay1_DSTATE[3] = TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE;
  TwoDOF_DW.Delay_DSTATE[3] = TwoDOF_DW.DiscreteTimeIntegrator4_DSTATE;
  TwoDOF_DW.Delay3_DSTATE[3] = TwoDOF_DW.DiscreteTimeIntegrator2_DSTATE;
  TwoDOF_DW.Delay2_DSTATE[3] = TwoDOF_DW.DiscreteTimeIntegrator5_DSTATE;
  TwoDOF_DW.DiscreteTransferFcn1_states =
    Sum1 - -0.9835 * TwoDOF_DW.DiscreteTransferFcn1_states;
  if (rtb_AND3_p) {
    rtb_Filter_b = 0.0;
  }

  TwoDOF_DW.Integrator_DSTATE_b += 0.005 * rtb_Filter_b;
  TwoDOF_DW.Filter_DSTATE_h += 0.005 * rtb_FilterCoefficient_b;
  TwoDOF_DW.DiscreteTimeIntegrator4_DSTATE +=
    (mass_u * g * L_cg_u * Math.sin(TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE) -
      B_u * TwoDOF_DW.DiscreteTimeIntegrator4_DSTATE +
      (0.00634 * TwoDOF_DW.BackMotor_states -
        0.00634 * TwoDOF_DW.FrontMotor_states) *
        L_u) *
    (1.0 / J_u) *
    0.005;
  TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE += 0.005 * TwoDOF_Y.thetaYDot;
  if (TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE > RollUpperLimit) {
    TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE = RollUpperLimit;
  } else if (TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE < RollLowerLimit) {
    TwoDOF_DW.DiscreteTimeIntegrator3_DSTATE = RollLowerLimit;
  }

  TwoDOF_DW.FrontMotor_states = Add17 - -0.9512 * TwoDOF_DW.FrontMotor_states;
  TwoDOF_DW.BackMotor_states = Add18 - -0.9512 * TwoDOF_DW.BackMotor_states;
  TwoDOF_DW.LeftMotor_states = Add21 - -0.9512 * TwoDOF_DW.LeftMotor_states;
  TwoDOF_DW.RightMotor_states = Add22 - -0.9512 * TwoDOF_DW.RightMotor_states;
  TwoDOF_DW.DiscreteTimeIntegrator5_DSTATE +=
    (mass_l * g * L_cg_l * Math.sin(TwoDOF_DW.DiscreteTimeIntegrator2_DSTATE) -
      B_l * TwoDOF_DW.DiscreteTimeIntegrator5_DSTATE +
      (numAccum_2 * rtb_Cos - numAccum_1 * rtb_Cos) * L_l) *
    (1.0 / J_l) *
    0.005;
  TwoDOF_DW.DiscreteTimeIntegrator2_DSTATE += 0.005 * TwoDOF_Y.thetaXDot;
  if (TwoDOF_DW.DiscreteTimeIntegrator2_DSTATE > PitchUpperLimit) {
    TwoDOF_DW.DiscreteTimeIntegrator2_DSTATE = PitchUpperLimit;
  } else if (TwoDOF_DW.DiscreteTimeIntegrator2_DSTATE < PitchLowerLimit) {
    TwoDOF_DW.DiscreteTimeIntegrator2_DSTATE = PitchLowerLimit;
  }
}

function simulate(data) {
  // Assign the new parameter values
  ixposkp = data.xposkp;
  iyposkp = data.yposkp;
  ixposki = data.xposki;
  iyposki = data.yposki;
  ixposkd = data.xposkd;
  iyposkd = data.yposkd;
  ixvelkp = data.xvelkp;
  iyvelkp = data.yvelkp;
  ixvelki = data.xvelki;
  iyvelki = data.yvelki;
  ixvelkd = data.xvelkd;
  iyvelkd = data.yvelkd;
  iyvelkd = data.yvelkd;
  iyvelkd = data.yvelkd;
  TwoDOF_U.X_setpoint = data.xposSet;
  TwoDOF_U.Y_setpoint = data.yposSet;
  TwoDOF_initialize();
  let i = 0;
  const iterations = 2000;
  var SIO = {
    XPos: [],
    XVel: [],
    YPos: [],
    YVel: [],
  };
  while (i < iterations) {
    TwoDOF_step();
    //console.log(Subsystem_Y.thetaX, Subsystem_Y.thetaY);
    SIO.XPos.push(TwoDOF_Y.thetaX);
    SIO.YPos.push(TwoDOF_Y.thetaY);
    SIO.XVel.push(TwoDOF_Y.thetaXDot);
    SIO.YVel.push(TwoDOF_Y.thetaYDot);
    i++;
  }

  return SIO;
}

export { simulate };
