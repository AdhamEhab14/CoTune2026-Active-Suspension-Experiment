import { simulate } from './pendulum.js';
import fs from 'fs';

// Example K matrix
const K = [
  -70.71067811661351,
  -73.34205218612055,
  -324.339657624133,
  -74.56675475869531
]; // Replace with your actual K values
const data = simulate(K);

// Create CSV content
let csv = 'Time,XPosition,XVelocity,Angle,AngularVelocity\n';
for (let i = 0; i < data.XPos.length; i++) {
    const time = i * 0.001; // assuming dt = 0.001
    csv += `${time},${data.XPos[i]},${data.XVel[i]},${data.YPos[i]},${data.YVel[i]}\n`;
}

// Save to file
fs.writeFileSync('simulation_results.csv', csv);
console.log('Simulation results saved to simulation_results.csv');
